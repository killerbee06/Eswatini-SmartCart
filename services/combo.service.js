/**
 * Combo / Bundle Service
 *
 * Manages product bundles offered by merchants.
 * Each combo belongs to a store and has component products with snapshot prices.
 */

import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';

/**
 * List active combos, optionally filtered by store
 */
async function listCombos({ store_id, page = 1, limit = 20 } = {}) {
  let query = db('combos')
    .join('stores', 'stores.id', 'combos.store_id')
    .where('combos.is_active', true)
    .select('combos.*', 'stores.name as store_name', 'stores.logo_url as store_logo');

  const now = new Date();
  query = query.where(function () {
    this.whereNull('combos.starts_at').orWhere('combos.starts_at', '<=', now);
  }).andWhere(function () {
    this.whereNull('combos.expires_at').orWhere('combos.expires_at', '>', now);
  });

  if (store_id) query = query.where('combos.store_id', store_id);

  const [{ count: total }] = await query.clone().count('combos.id as count');
  const data = await query.orderBy('combos.created_at', 'desc').limit(limit).offset((page - 1) * limit);

  // Attach combo items to each combo
  const comboIds = data.map(c => c.id);
  const items = comboIds.length > 0
    ? await db('combo_items')
        .join('products', 'products.id', 'combo_items.product_id')
        .whereIn('combo_items.combo_id', comboIds)
        .select('combo_items.*', 'products.name as product_name', 'products.image_url')
    : [];

  const itemsByCombo = {};
  for (const item of items) {
    if (!itemsByCombo[item.combo_id]) itemsByCombo[item.combo_id] = [];
    itemsByCombo[item.combo_id].push(item);
  }

  const result = data.map(combo => ({
    ...combo,
    items: itemsByCombo[combo.id] || [],
    savings: Number(combo.original_price) - Number(combo.combo_price),
  }));

  return { data: result, total: parseInt(total, 10), page, limit };
}

/**
 * Get a single combo with its items
 */
async function getCombo(id) {
  const combo = await db('combos')
    .join('stores', 'stores.id', 'combos.store_id')
    .where('combos.id', id)
    .select('combos.*', 'stores.name as store_name', 'stores.logo_url as store_logo')
    .first();

  if (!combo) return null;

  const items = await db('combo_items')
    .join('products', 'products.id', 'combo_items.product_id')
    .where('combo_items.combo_id', id)
    .select('combo_items.*', 'products.name as product_name', 'products.image_url', 'products.is_available');

  return {
    ...combo,
    items,
    savings: Number(combo.original_price) - Number(combo.combo_price),
  };
}

/**
 * Admin/Merchant: create a combo
 */
async function createCombo(data) {
  // Calculate original_price from component products
  let originalPrice = 0;
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const product = await db('products').where({ id: item.product_id }).first();
      if (!product) throw new AppError(`Product ${item.product_id} not found.`, 404);
      originalPrice += Number(product.price) * (item.quantity || 1);
    }
  }

  const [combo] = await db('combos').insert({
    store_id: data.store_id,
    name: data.name,
    description: data.description || null,
    image_url: data.image_url || null,
    combo_price: data.combo_price,
    original_price: originalPrice,
    min_items: data.min_items || null,
    max_items: data.max_items || null,
    is_customizable: data.is_customizable || false,
    starts_at: data.starts_at || null,
    expires_at: data.expires_at || null,
  }).returning('*');

  // Insert combo items
  if (data.items && data.items.length > 0) {
    const comboItems = data.items.map(item => ({
      combo_id: combo.id,
      product_id: item.product_id,
      quantity: item.quantity || 1,
      individual_price: item.individual_price || 0,
    }));
    await db('combo_items').insert(comboItems);
  }

  return getCombo(combo.id);
}

/**
 * Admin/Merchant: update a combo
 */
async function updateCombo(id, data) {
  const allowed = ['name', 'description', 'image_url', 'combo_price', 'is_active', 'starts_at', 'expires_at'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  updates.updated_at = new Date();

  const updated = await db('combos').where({ id }).update(updates).returning('*');
  if (!updated[0]) throw new AppError('Combo not found.', 404);
  return getCombo(id);
}

export default {
  listCombos,
  getCombo,
  createCombo,
  updateCombo,
};
