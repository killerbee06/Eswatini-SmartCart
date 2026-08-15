import db from '../../config/knex.js';
import { success, created } from '../../shared/utils.js';
import { AppError } from '../../shared/errors.js';

/**
 * GET /api/v1/stores
 * Public — list all active stores.
 */
export async function listStores(req, res, next) {
  try {
    const stores = await db('stores')
      .where({ is_active: true })
      .orderBy('name', 'asc');

    return success(res, stores);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/stores/:id
 * Public — get a single store.
 */
export async function getStore(req, res, next) {
  try {
    const store = await db('stores').where({ id: req.params.id }).first();
    if (!store) throw new AppError('Store not found.', 404);

    return success(res, store);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/stores
 * Create a new store.
 */
export async function createStore(req, res, next) {
  try {
    const { name, description, location, logo_url } = req.body;

    const [store] = await db('stores').insert({
      name, description, location, logo_url,
    }).returning('*');

    // If the creator is a merchant, link them to the store
    if (req.user.role === 'MERCHANT_OWNER' || req.user.role === 'MERCHANT_STAFF') {
      await db('store_users').insert({
        profile_id: req.user.id,
        store_id: store.id,
        role: 'MERCHANT_OWNER',
      });
    }

    return created(res, store, 'Store created');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/stores/:id
 * Update a store — requires ownership or admin.
 */
export async function updateStore(req, res, next) {
  try {
    // Check access: admin or store owner
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: req.params.id, role: 'MERCHANT_OWNER', is_active: true })
        .first();
      if (!membership) throw new AppError('Access denied.', 403);
    }

    const allowed = ['name', 'description', 'location', 'logo_url', 'is_active', 'commission_rate'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update.', 400);
    }

    updates.updated_at = new Date();

    const [store] = await db('stores')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*');

    if (!store) throw new AppError('Store not found.', 404);

    return success(res, store, 'Store updated');
  } catch (err) {
    next(err);
  }
}
