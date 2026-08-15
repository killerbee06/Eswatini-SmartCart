/**
 * Storefront Service
 * 
 * Powers the individual store pages — products, combos, promotions.
 * Preserves store identity throughout.
 */

import db from '../config/knex.js';

/**
 * Get store details for storefront page
 */
async function getStorefront(storeId) {
  const store = await db('stores')
    .where({ id: storeId, is_active: true })
    .first();

  if (!store) return null;

  // Get product count
  const [{ count: productCount }] = await db('products')
    .where({ store_id: storeId, is_available: true })
    .count('id as count');

  // Get categories that this store has products in
  const categories = await db('products')
    .join('categories', 'categories.id', 'products.category_id')
    .where('products.store_id', storeId)
    .where('products.is_available', true)
    .select('categories.id', 'categories.name')
    .groupBy('categories.id', 'categories.name');

  // Get active promotions for this store
  const now = new Date();
  const promotions = await db('promotions')
    .where('store_id', storeId)
    .where('is_active', true)
    .where('starts_at', '<=', now)
    .where('expires_at', '>', now)
    .select('id', 'name', 'description', 'discount_type', 'discount_value')
    .limit(5);

  // Get combos
  const combos = await db('combos')
    .where('store_id', storeId)
    .where('is_active', true)
    .select('id', 'name', 'description', 'combo_price', 'original_price', 'image_url')
    .limit(5);

  return {
    ...store,
    product_count: parseInt(productCount, 10),
    categories,
    promotions,
    combos,
  };
}

/**
 * Get featured stores for homepage
 */
async function getFeaturedStores(limit = 6) {
  return db('stores')
    .where({ is_active: true })
    .orderByRaw('is_featured DESC, created_at ASC')
    .limit(limit);
}

/**
 * Search products across all stores
 */
async function searchProducts({
  query,
  category_id,
  store_id,
  selling_method,
  age_restricted,
  min_price,
  max_price,
  is_promoted,
  sort = 'created_at',
  order = 'desc',
  page = 1,
  limit = 20,
} = {}) {
  let q = db('products')
    .join('stores', 'stores.id', 'products.store_id')
    .leftJoin('categories', 'categories.id', 'products.category_id')
    .leftJoin('product_images', function() {
      this.on('product_images.product_id', '=', 'products.id')
        .andOn('product_images.is_primary', '=', db.raw('true'));
    })
    .where('products.is_available', true)
    .select(
      'products.*',
      'stores.name as store_name',
      'stores.logo_url as store_logo',
      'categories.name as category_name',
      'product_images.image_url as primary_image'
    );

  if (query) {
    q = q.where(function() {
      this.whereILike('products.name', `%${query}%`)
        .orWhereILike('products.brand', `%${query}%`)
        .orWhereILike('products.description', `%${query}%`)
        .orWhereILike('stores.name', `%${query}%`);
    });
  }

  if (category_id) q = q.where('products.category_id', category_id);
  if (store_id) q = q.where('products.store_id', store_id);
  if (selling_method) q = q.where('products.selling_method', selling_method);
  if (age_restricted !== undefined) q = q.where('products.age_restricted', age_restricted);
  if (min_price) q = q.where('products.price', '>=', min_price);
  if (max_price) q = q.where('products.price', '<=', max_price);
  if (is_promoted) q = q.where('products.is_promoted', true);

  const [{ count: total }] = await q.clone().count('products.id as count');

  const data = await q
    .orderBy(`products.${sort}`, order)
    .limit(limit)
    .offset((page - 1) * limit);

  return { data, total: parseInt(total, 10), page: parseInt(page, 10), limit: parseInt(limit, 10) };
}

/**
 * Get single product with full details
 */
async function getProduct(productId) {
  const product = await db('products')
    .join('stores', 'stores.id', 'products.store_id')
    .leftJoin('categories', 'categories.id', 'products.category_id')
    .where('products.id', productId)
    .select(
      'products.*',
      'stores.name as store_name',
      'stores.logo_url as store_logo',
      'stores.id as store_id',
      'categories.name as category_name',
      'categories.id as category_id'
    )
    .first();

  if (!product) return null;

  // Get all images
  const images = await db('product_images')
    .where({ product_id: productId })
    .orderBy('sort_order');

  // Check for applicable promotions
  const now = new Date();
  const promotions = await db('promotions')
    .where('product_id', productId)
    .where('is_active', true)
    .where('starts_at', '<=', now)
    .where('expires_at', '>', now)
    .select('id', 'name', 'discount_type', 'discount_value');

  return { ...product, images, promotions };
}

export default {
  getStorefront,
  getFeaturedStores,
  searchProducts,
  getProduct,
};
