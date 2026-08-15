/**
 * Cart Service — server-side cart management
 * 
 * Groups items by store for multi-store checkout.
 * Validates stock and pricing at checkout time.
 */

import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';

/**
 * Get or create a cart for a profile
 */
async function getOrCreateCart(profileId) {
  let cart = await db('carts').where({ profile_id: profileId }).first();
  if (!cart) {
    const [id] = await db('carts').insert({ profile_id: profileId }).returning('id');
    cart = typeof id === 'object' ? id : { id };
  }
  return cart;
}

/**
 * Get cart with all items, grouped by store
 */
async function getCart(profileId) {
  const cart = await getOrCreateCart(profileId);

  const items = await db('cart_items')
    .join('products', 'products.id', 'cart_items.product_id')
    .join('stores', 'stores.id', 'cart_items.store_id')
    .leftJoin('product_images', function() {
      this.on('product_images.product_id', '=', 'products.id')
        .andOn('product_images.is_primary', '=', db.raw('true'));
    })
    .where('cart_items.cart_id', cart.id)
    .select(
      'cart_items.*',
      'products.name as product_name',
      'products.price',
      'products.discount_price',
      'products.stock_quantity',
      'products.is_available',
      'products.selling_method',
      'products.measurement_unit',
      'products.age_restricted',
      'products.image_url as product_image',
      'stores.name as store_name',
      'stores.logo_url as store_logo',
      'product_images.image_url as primary_image'
    )
    .orderBy('stores.name');

  // Group by store
  const storeGroups = {};
  let itemsSubtotal = 0;
  let totalItems = 0;

  for (const item of items) {
    const storeId = item.store_id;
    if (!storeGroups[storeId]) {
      storeGroups[storeId] = {
        store_id: storeId,
        store_name: item.store_name,
        store_logo: item.store_logo,
        items: [],
        subtotal: 0,
      };
    }

    const effectivePrice = item.discount_price
      ? Number(item.discount_price)
      : Number(item.price);

    const quantity = item.requested_quantity
      ? Number(item.requested_quantity)
      : item.quantity;

    const lineTotal = effectivePrice * quantity;

    storeGroups[storeId].items.push({
      ...item,
      effective_price: effectivePrice,
      line_total: Number(lineTotal.toFixed(2)),
    });
    storeGroups[storeId].subtotal += lineTotal;
    itemsSubtotal += lineTotal;
    totalItems += quantity;
  }

  return {
    cart_id: cart.id,
    stores: Object.values(storeGroups),
    summary: {
      items_count: totalItems,
      stores_count: Object.keys(storeGroups).length,
      subtotal: Number(itemsSubtotal.toFixed(2)),
    },
  };
}

/**
 * Add item to cart
 * If same product already in cart, update quantity
 */
async function addItem(profileId, {
  product_id,
  quantity = 1,
  requested_quantity = null,
  unit = null,
  special_instructions = null,
  combo_id = null,
}) {
  const cart = await getOrCreateCart(profileId);

  // Validate product exists and is available
  const product = await db('products').where({ id: product_id }).first();
  if (!product) {
    throw new AppError('Product not found.', 404);
  }
  if (!product.is_available) {
    throw new AppError(`"${product.name}" is currently unavailable.`, 400);
  }

  // Server-side age enforcement — never trust the frontend
  if (product.age_restricted) {
    const profile = await db('profiles').where('id', profileId).first();
    if (!profile || !profile.date_of_birth) {
      throw new AppError(
        'Date of birth is required for age-restricted products. Please update your profile.',
        403
      );
    }
    const dob = new Date(profile.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    const requiredAge = product.minimum_age || 18;
    if (age < requiredAge) {
      throw new AppError(
        `You must be at least ${requiredAge} to purchase "${product.name}".`,
        403
      );
    }
  }

  // Check stock
  const totalQty = requested_quantity ? Number(requested_quantity) : quantity;
  if (product.stock_quantity < totalQty) {
    throw new AppError(
      `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}.`,
      400
    );
  }

  // Check if item already in cart
  const existing = await db('cart_items')
    .where({ cart_id: cart.id, product_id })
    .first();

  if (existing) {
    const newQty = existing.quantity + quantity;
    const newReqQty = requested_quantity
      ? Number(existing.requested_quantity || 0) + Number(requested_quantity)
      : existing.requested_quantity;

    await db('cart_items')
      .where({ id: existing.id })
      .update({
        quantity: newQty,
        requested_quantity: newReqQty,
        unit: unit || existing.unit,
        special_instructions: special_instructions || existing.special_instructions,
        unit_price_snapshot: product.discount_price || product.price,
        updated_at: new Date(),
      });
  } else {
    await db('cart_items').insert({
      cart_id: cart.id,
      product_id,
      store_id: product.store_id,
      quantity,
      requested_quantity: requested_quantity || null,
      unit,
      special_instructions,
      combo_id,
      unit_price_snapshot: product.discount_price || product.price,
    });
  }

  return getCart(profileId);
}

/**
 * Update cart item quantity
 */
async function updateItem(profileId, itemId, { quantity, requested_quantity }) {
  const cart = await getOrCreateCart(profileId);
  const item = await db('cart_items').where({ id: itemId, cart_id: cart.id }).first();

  if (!item) {
    throw new AppError('Cart item not found.', 404);
  }

  // Validate stock
  const product = await db('products').where({ id: item.product_id }).first();
  const totalQty = requested_quantity ? Number(requested_quantity) : quantity;
  if (product.stock_quantity < totalQty) {
    throw new AppError(`Insufficient stock. Available: ${product.stock_quantity}.`, 400);
  }

  const updates = { updated_at: new Date() };
  if (quantity !== undefined) updates.quantity = quantity;
  if (requested_quantity !== undefined) updates.requested_quantity = requested_quantity;

  await db('cart_items').where({ id: itemId }).update(updates);

  return getCart(profileId);
}

/**
 * Remove item from cart
 */
async function removeItem(profileId, itemId) {
  const cart = await getOrCreateCart(profileId);
  const deleted = await db('cart_items')
    .where({ id: itemId, cart_id: cart.id })
    .del();

  if (!deleted) {
    throw new AppError('Cart item not found.', 404);
  }

  return getCart(profileId);
}

/**
 * Clear entire cart
 */
async function clearCart(profileId) {
  const cart = await getOrCreateCart(profileId);
  await db('cart_items').where({ cart_id: cart.id }).del();
  return { message: 'Cart cleared' };
}

/**
 * Get cart item count (for badge)
 */
async function getItemCount(profileId) {
  const cart = await db('carts').where({ profile_id: profileId }).first();
  if (!cart) return { count: 0 };

  const [{ count }] = await db('cart_items')
    .where({ cart_id: cart.id })
    .sum('quantity as count');

  return { count: parseInt(count, 10) || 0 };
}

export default {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  getItemCount,
};
