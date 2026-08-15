/**
 * Promotions Engine
 * 
 * Evaluates applicable promotions for a given set of products, store, and customer.
 * Supports: percentage, fixed discount, fixed price, loyalty-only, product-specific,
 * category-specific, min-basket, min-quantity, date-range, and per-customer usage limits.
 */

import db from '../config/knex.js';

/**
 * Find all active, applicable promotions for given items
 * @param {Array} items - [{ product_id, store_id, quantity, effective_price }]
 * @param {Object} context - { profile_id, loyaltyCards, promo_code }
 * @returns {Array} promotions with discount amounts per item
 */
async function evaluatePromotions(items, context = {}) {
  const { profile_id, loyaltyCards = [], promo_code } = context;
  const now = new Date();

  // Build query for active promotions
  let query = db('promotions')
    .where('is_active', true)
    .where('status', 'ACTIVE')
    .where('starts_at', '<=', now)
    .where('expires_at', '>', now);

  // If a promo code was entered, only match that code
  if (promo_code) {
    query = query.where('promo_code', promo_code);
  }

  const promotions = await query;

  const applicablePromotions = [];
  const totalBasketValue = items.reduce(
    (sum, item) => sum + item.effective_price * (item.quantity || 1), 0
  );

  for (const promo of promotions) {
    // Check usage limits
    if (promo.max_uses_total && promo.current_uses >= promo.max_uses_total) {
      continue;
    }

    // Check per-customer limit
    if (promo.max_uses_per_customer && profile_id) {
      const [{ count }] = await db('order_status_events')
        .join('orders', 'orders.id', 'order_status_events.order_id')
        .where('order_status_events.actor_id', profile_id)
        .where('order_status_events.to_status', 'PAID')
        .where('order_status_events.notes', 'LIKE', `%promo:${promo.id}%`)
        .count('id as count');
      if (parseInt(count, 10) >= promo.max_uses_per_customer) continue;
    }

    // Check min basket value
    if (promo.min_basket_value && totalBasketValue < Number(promo.min_basket_value)) {
      continue;
    }

    // Loyalty-only promotions require matching loyalty card
    if (promo.discount_type === 'LOYALTY_ONLY') {
      const hasLoyalty = loyaltyCards.some(card =>
        card.loyalty_provider_name === promo.name || card.store_id === promo.store_id
      );
      if (!hasLoyalty) continue;
    }

    // Evaluate per-item discounts
    const discounts = [];
    for (const item of items) {
      let matches = false;

      // Product-specific
      if (promo.product_id && promo.product_id === item.product_id) {
        matches = true;
      }

      // Category-specific
      if (promo.category_id && item.category_id === promo.category_id) {
        matches = true;
      }

      // Store-specific (promo belongs to a store)
      if (promo.store_id && promo.store_id !== item.store_id) {
        continue; // store-specific promo, item from different store
      }

      // Store-wide promo (no product/category filter) applies to all items in store
      if (!promo.product_id && !promo.category_id && promo.store_id) {
        matches = true;
      }

      // Platform-wide promo (no store filter)
      if (!promo.store_id && !promo.product_id && !promo.category_id) {
        matches = true;
      }

      if (!matches) continue;

      // Calculate discount
      let discountAmount = 0;
      const lineTotal = item.effective_price * (item.quantity || 1);

      switch (promo.discount_type) {
        case 'PERCENTAGE':
          discountAmount = lineTotal * (Number(promo.discount_value) / 100);
          break;
        case 'FIXED':
          discountAmount = Math.min(Number(promo.discount_value), lineTotal);
          break;
        case 'FIXED_PRICE':
          // Set a fixed price per unit
          const savings = item.effective_price - Number(promo.discount_value);
          discountAmount = savings > 0 ? savings * (item.quantity || 1) : 0;
          break;
        case 'LOYALTY_ONLY':
          // Same as percentage for loyalty pricing
          discountAmount = lineTotal * (Number(promo.discount_value) / 100);
          break;
        default:
          break;
      }

      if (discountAmount > 0) {
        discounts.push({
          product_id: item.product_id,
          store_id: item.store_id,
          promotion_id: promo.id,
          promotion_name: promo.name,
          discount_type: promo.discount_type,
          discount_amount: Number(discountAmount.toFixed(2)),
        });
      }
    }

    if (discounts.length > 0) {
      applicablePromotions.push({
        id: promo.id,
        name: promo.name,
        description: promo.description,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        discounts,
        total_discount: discounts.reduce((s, d) => s + d.discount_amount, 0),
      });
    }
  }

  return applicablePromotions;
}

/**
 * Apply promotion discounts to checkout items
 * @returns {Object} { totalDiscount, itemDiscounts, applicablePromotions }
 */
async function applyPromotions(items, context = {}) {
  const promotions = await evaluatePromotions(items, context);

  // Flatten all item-level discounts
  const itemDiscounts = {};
  let totalDiscount = 0;

  for (const promo of promotions) {
    for (const d of promo.discounts) {
      const key = `${d.product_id}`;
      if (!itemDiscounts[key]) {
        itemDiscounts[key] = { product_id: d.product_id, total_discount: 0, promotions: [] };
      }
      itemDiscounts[key].total_discount += d.discount_amount;
      itemDiscounts[key].promotions.push({
        promotion_id: d.promotion_id,
        name: d.promotion_name,
        type: d.discount_type,
        amount: d.discount_amount,
      });
      totalDiscount += d.discount_amount;
    }
  }

  return {
    total_discount: Number(totalDiscount.toFixed(2)),
    item_discounts: Object.values(itemDiscounts),
    applicable_promotions: promotions,
  };
}

/**
 * Admin: create a promotion
 */
async function createPromotion(data) {
  const [promo] = await db('promotions').insert({
    store_id: data.store_id || null,
    name: data.name,
    description: data.description,
    promo_code: data.promo_code || null,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    product_id: data.product_id || null,
    category_id: data.category_id || null,
    min_basket_value: data.min_basket_value || null,
    min_quantity: data.min_quantity || null,
    max_uses_total: data.max_uses_total || null,
    max_uses_per_customer: data.max_uses_per_customer || null,
    starts_at: data.starts_at,
    expires_at: data.expires_at,
    status: data.status || 'ACTIVE',
  }).returning('*');

  return promo;
}

/**
 * Admin: list promotions
 */
async function listPromotions({ store_id, status, page = 1, limit = 20 } = {}) {
  let query = db('promotions').select('*');
  if (store_id) query = query.where('store_id', store_id);
  if (status) query = query.where('status', status);

  const [{ count: total }] = await query.clone().count('id as count');
  const data = await query.orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit);

  return { data, total: parseInt(total, 10), page, limit };
}

/**
 * Admin: update a promotion
 */
async function updatePromotion(id, data) {
  const allowed = ['name', 'description', 'discount_value', 'status', 'max_uses_total', 'expires_at'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  updates.updated_at = new Date();

  const updated = await db('promotions').where({ id }).update(updates).returning('*');
  return updated[0];
}

export default {
  evaluatePromotions,
  applyPromotions,
  createPromotion,
  listPromotions,
  updatePromotion,
};
