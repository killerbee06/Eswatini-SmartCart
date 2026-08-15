import db from '../../config/knex.js';
import config from '../../config/index.js';
import { success, created, paginate, generateOrderRef } from '../../shared/utils.js';
import { AppError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { ORDER_STATUS, ORDER_TRANSITIONS } from '../../shared/constants.js';
import ageService from '../../services/age.service.js';
import promotionService from '../../services/promotion.service.js';

/**
 * POST /api/v1/orders/checkout
 *
 * THE CRITICAL ENDPOINT.
 * Client sends: product IDs, quantities, delivery_address, payment_method.
 * Server calculates: prices, subtotal, commission, delivery fee, grand total.
 * Client NEVER determines financial values.
 */
export async function checkout(req, res, next) {
  const trx = await db.transaction();
  try {
    const { items, delivery_address, delivery_notes, payment_method } = req.body;
    const customerId = req.user.id;

    // 1. Fetch all requested products from database (source of truth for pricing)
    const productIds = items.map((item) => item.id);
    const dbProducts = await trx('products')
      .whereIn('id', productIds)
      .forUpdate(); // Row-level lock for inventory protection

    if (dbProducts.length !== productIds.length) {
      throw new AppError('One or more products not found.', 400);
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // 1b. Age verification for restricted products (SERVER-SIDE ONLY)
    const ageCheck = await ageService.isEligibleForOrder(customerId, dbProducts);
    if (!ageCheck.eligible) {
      throw new AppError(
        `Age restriction: ${ageCheck.ineligibleItems.map(i => i.productName).join(', ')}. ${ageCheck.ineligibleItems[0].reason}`,
        403
      );
    }

    // 2. Validate stock and calculate subtotal (server-side pricing engine)
    let itemsSubtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) {
        throw new AppError(`Product ID ${item.id} not found.`, 400);
      }
      if (!product.is_available) {
        throw new AppError(`"${product.name}" is currently unavailable.`, 400);
      }
      if (product.stock_quantity < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, requested: ${item.quantity}.`,
          400
        );
      }

      // Use effective price (discount if available, otherwise regular price)
      const effectivePrice = product.discount_price
        ? Number(product.discount_price)
        : Number(product.price);

      itemsSubtotal += effectivePrice * item.quantity;

      validatedItems.push({
        product,
        quantity: item.quantity,
        effectivePrice,
      });
    }

    // 3. Evaluate promotions server-side
    const promoItems = validatedItems.map(vi => ({
      product_id: vi.product.id,
      store_id: vi.product.store_id,
      category_id: vi.product.category_id,
      quantity: vi.quantity,
      effective_price: vi.effectivePrice,
    }));

    // Fetch customer loyalty cards for loyalty-only promo evaluation
    const loyaltyCards = await trx('customer_loyalty_cards')
      .join('loyalty_providers', 'loyalty_providers.id', 'customer_loyalty_cards.loyalty_provider_id')
      .where('customer_loyalty_cards.profile_id', customerId)
      .where('customer_loyalty_cards.is_active', true)
      .select('customer_loyalty_cards.*', 'loyalty_providers.name as loyalty_provider_name');

    const promoResult = await promotionService.applyPromotions(promoItems, {
      profile_id: customerId,
      loyaltyCards,
      promo_code: req.body.promo_code || null,
    });

    const totalDiscount = Number(promoResult.total_discount) || 0;
    const discountedSubtotal = Math.max(0, Number((itemsSubtotal - totalDiscount).toFixed(2)));

    // 4. Server-determined financial calculations
    const commissionSetting = await trx('system_settings').where({ key: 'platform_commission_rate' }).first();
    const commissionRate = commissionSetting
      ? Number(commissionSetting.value)
      : config.platform.commissionDefault;

    const deliveryFeeSetting = await trx('system_settings').where({ key: 'default_delivery_fee' }).first();
    const deliveryFee = deliveryFeeSetting
      ? Number(deliveryFeeSetting.value)
      : config.platform.defaultDeliveryFee;

    const commissionAmount = Number((discountedSubtotal * commissionRate).toFixed(2));
    const grandTotal = Number((discountedSubtotal + deliveryFee).toFixed(2));

    // 4. Create master order
    const orderRef = generateOrderRef();
    const [orderId] = await trx('orders').insert({
      main_ref: orderRef,
      customer_id: customerId,
      status: ORDER_STATUS.PENDING_PAYMENT,
      delivery_status: 'PENDING',
      items_subtotal: itemsSubtotal,
      delivery_fee: deliveryFee,
      commission_rate_snapshot: commissionRate,
      commission_amount: commissionAmount,
      grand_total: grandTotal,
      delivery_address,
      delivery_notes: delivery_notes || null,
      payment_method,
    }).returning('id');

    // 5. Group items by store for sub-orders
    const storeGroups = new Map();
    for (const item of validatedItems) {
      const storeId = item.product.store_id;
      if (!storeGroups.has(storeId)) {
        storeGroups.set(storeId, []);
      }
      storeGroups.get(storeId).push(item);
    }

    // 6. Create sub-orders, order items, deduct inventory, log status event
    for (const [storeId, storeItems] of storeGroups) {
      let storeSubtotal = 0;
      for (const item of storeItems) {
        storeSubtotal += item.effectivePrice * item.quantity;
      }

      const storePayout = Number((storeSubtotal - storeSubtotal * commissionRate).toFixed(2));

      const [subOrderId] = await trx('sub_orders').insert({
        parent_order_id: orderId,
        store_id: storeId,
        status: 'PENDING',
        subtotal: storeSubtotal,
        store_payout: storePayout,
      }).returning('id');

      // Insert order items and deduct inventory atomically
      for (const item of storeItems) {
        await trx('order_items').insert({
          order_id: orderId,
          sub_order_id: subOrderId,
          product_id: item.product.id,
          product_name: item.product.name, // Snapshot product name at order time
          store_id: storeId,
          quantity: item.quantity,
          unit_price: item.effectivePrice,
        });

        // Atomic inventory deduction (with row lock from forUpdate above)
        const updated = await trx('products')
          .where({ id: item.product.id })
          .where('stock_quantity', '>=', item.quantity)
          .decrement('stock_quantity', item.quantity);

        if (updated === 0) {
          throw new AppError(
            `Race condition: stock for "${item.product.name}" was claimed by another order. Please try again.`,
            409
          );
        }

        // Log inventory movement (audit trail)
        await trx.raw(
          `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, after, created_at)
           VALUES (?, ?, 'product', ?, ?, ?)`,
          [customerId, 'inventory.deducted', String(item.product.id),
           JSON.stringify({ stock_change: -item.quantity }), new Date().toISOString()]
        );
      }

      // Create delivery record
      await trx('deliveries').insert({
        order_id: orderId,
        status: 'PENDING_ASSIGNMENT',
      });

      // Emit real-time notification to merchant room
      if (req.io) {
        req.io.to(`store_${storeId}`).emit('new_sub_order', {
          subOrderId,
          storeId,
          amount: storeSubtotal,
          orderRef,
          timestamp: new Date(),
        });
      }
    }

    // 7. Log initial order status event
    await trx('order_status_events').insert({
      order_id: orderId,
      from_status: null,
      to_status: ORDER_STATUS.PENDING_PAYMENT,
      actor_id: customerId,
      notes: 'Order placed via checkout',
    });

    // 8. Clear customer cart after successful checkout
    const cart = await trx('carts').where({ profile_id: customerId }).first();
    if (cart) {
      await trx('cart_items').where({ cart_id: cart.id }).del();
    }

    // 9. Commit transaction (all or nothing)
    await trx.commit();

    return created(res, {
      orderRef,
      orderId,
      itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
      discount: totalDiscount,
      discountedSubtotal,
      deliveryFee,
      commissionAmount,
      grandTotal,
      paymentMethod: payment_method,
      itemsCount: items.length,
      promotions: promoResult.applicable_promotions?.length || 0,
    }, 'Order placed successfully. Awaiting payment.');
  } catch (err) {
    await trx.rollback();
    next(err);
  }
}

/**
 * GET /api/v1/orders/my-orders
 * Customer views their own orders.
 */
export async function listMyOrders(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [{ count: total }] = await db('orders')
      .where({ customer_id: req.user.id })
      .count('id as count');

    const orders = await db('orders')
      .where({ customer_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return paginate(res, { data: orders, total: parseInt(total, 10), page, limit });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders/:id
 * View a single order — customers can view own, merchants view sub-orders, admins view all.
 */
export async function getOrder(req, res, next) {
  try {
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) throw new NotFoundError('Order');

    // Authorization check
    if (req.user.role === 'CUSTOMER' && order.customer_id !== req.user.id) {
      throw new AppError('Access denied.', 403);
    }

    // Include items and sub-orders
    const items = await db('order_items').where({ order_id: order.id });
    const subOrders = await db('sub_orders').where({ parent_order_id: order.id });

    return success(res, { ...order, items, sub_orders: subOrders });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders/:id/events
 * View order status event history.
 */
export async function orderEvents(req, res, next) {
  try {
    const events = await db('order_status_events')
      .where({ order_id: req.params.id })
      .orderBy('created_at', 'asc');

    return success(res, events);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders/merchant/:storeId
 * Merchant views sub-orders for their store.
 */
export async function merchantOrders(req, res, next) {
  try {
    const { storeId } = req.params;

    // Verify merchant has access to this store
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: storeId, is_active: true })
        .first();
      if (!membership) throw new AppError('Access denied.', 403);
    }

    const subOrders = await db('sub_orders')
      .join('orders', 'orders.id', 'sub_orders.parent_order_id')
      .where('sub_orders.store_id', storeId)
      .select('sub_orders.*', 'orders.main_ref', 'orders.delivery_address', 'orders.customer_id')
      .orderBy('sub_orders.created_at', 'desc');

    return success(res, subOrders);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/orders/:id/status
 * Update order status — enforces valid state transitions.
 */
export async function updateOrderStatus(req, res, next) {
  const trx = await db.transaction();
  try {
    const { status, notes } = req.body;
    const orderId = req.params.id;

    const order = await trx('orders').where({ id: orderId }).first();
    if (!order) {
      await trx.rollback();
      throw new NotFoundError('Order');
    }

    // Validate state transition
    const allowedTransitions = ORDER_TRANSITIONS[order.status];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      await trx.rollback();
      throw new AppError(
        `Invalid status transition: ${order.status} → ${status}. Allowed: ${allowedTransitions?.join(', ') || 'none'}`,
        400
      );
    }

    // Update order status
    await trx('orders').where({ id: orderId }).update({
      status,
      updated_at: new Date(),
    });

    // Log status event
    await trx('order_status_events').insert({
      order_id: orderId,
      from_status: order.status,
      to_status: status,
      actor_id: req.user.id,
      notes: notes || null,
    });

    await trx.commit();

    // Real-time notification
    if (req.io) {
      req.io.emit('order_status_updated', { id: orderId, status });
    }

    return success(res, { orderId, from: order.status, to: status }, 'Order status updated');
  } catch (err) {
    await trx.rollback();
    next(err);
  }
}
