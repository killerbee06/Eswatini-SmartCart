import db from '../../config/knex.js';
import { success, created, paginate } from '../../shared/utils.js';
import { AppError, NotFoundError } from '../../shared/errors.js';

/**
 * GET /api/v1/products
 * Public — browse products with optional filters.
 */
export async function listProducts(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    let query = db('products')
      .join('stores', 'stores.id', 'products.store_id')
      .select(
        'products.*',
        'stores.name as store_name'
      )
      .where('products.is_available', true)
      .where('stores.is_active', true);

    // Filters
    if (req.query.store_id) query = query.where('products.store_id', req.query.store_id);
    if (req.query.category_id) query = query.where('products.category_id', req.query.category_id);
    if (req.query.search) {
      query = query.where('products.name', 'ilike', `%${req.query.search}%`);
    }

    const [{ count: total }] = await query.clone().clearSelect().count('products.id as count');

    const products = await query
      .orderBy('products.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return paginate(res, { data: products, total: parseInt(total, 10), page, limit });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/merchant
 * Merchant — view products belonging to their store(s).
 */
export async function listMerchantProducts(req, res, next) {
  try {
    const storeIds = await db('store_users')
      .where({ profile_id: req.user.id, is_active: true })
      .pluck('store_id');

    const products = await db('products')
      .whereIn('store_id', storeIds)
      .orderBy('created_at', 'desc');

    return success(res, products);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/:id
 * Public — view single product.
 */
export async function getProduct(req, res, next) {
  try {
    const product = await db('products')
      .join('stores', 'stores.id', 'products.store_id')
      .select('products.*', 'stores.name as store_name')
      .where('products.id', req.params.id)
      .first();

    if (!product) throw new NotFoundError('Product');

    return success(res, product);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/products
 * Merchant — create a product in their store.
 */
export async function createProduct(req, res, next) {
  try {
    // Verify merchant has access to the store
    const membership = await db('store_users')
      .where({ profile_id: req.user.id, store_id: req.body.store_id, is_active: true })
      .first();

    if (!membership && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('You do not have access to this store.', 403);
    }

    const [product] = await db('products').insert({
      store_id: req.body.store_id,
      name: req.body.name,
      description: req.body.description || null,
      category_id: req.body.category_id || null,
      price: req.body.price,
      discount_price: req.body.discount_price || null,
      stock_quantity: req.body.stock_quantity ?? 0,
      image_url: req.body.image_url || null,
      is_available: req.body.is_available ?? true,
      is_combo: req.body.is_combo ?? false,
      requires_rewards_card: req.body.requires_rewards_card ?? false,
    }).returning('*');

    return created(res, product, 'Product created');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/products/:id
 * Merchant — update own product.
 */
export async function updateProduct(req, res, next) {
  try {
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) throw new NotFoundError('Product');

    // Verify ownership
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: product.store_id, is_active: true })
        .first();
      if (!membership) throw new AppError('Access denied.', 403);
    }

    const [updated] = await db('products')
      .where({ id: req.params.id })
      .update({ ...req.body, updated_at: new Date() })
      .returning('*');

    return success(res, updated, 'Product updated');
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/products/:id
 * Merchant — delete own product.
 */
export async function deleteProduct(req, res, next) {
  try {
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) throw new NotFoundError('Product');

    // Verify ownership
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: product.store_id, is_active: true })
        .first();
      if (!membership) throw new AppError('Access denied.', 403);
    }

    await db('products').where({ id: req.params.id }).del();

    return success(res, null, 'Product deleted');
  } catch (err) {
    next(err);
  }
}
