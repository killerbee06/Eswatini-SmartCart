/**
 * Store Favorites / Preferred Stores Service
 *
 * Manages customer's preferred store selections.
 * Preferred stores influence product ordering, recommendations, and promotions.
 */

import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';

/**
 * Get customer's preferred stores
 */
async function getFavoriteStores(profileId) {
  return db('store_favorites')
    .join('stores', 'stores.id', 'store_favorites.store_id')
    .where('store_favorites.profile_id', profileId)
    .where('stores.is_active', true)
    .select(
      'store_favorites.id as favorite_id',
      'store_favorites.created_at as favorited_at',
      'stores.*'
    )
    .orderBy('store_favorites.created_at', 'desc');
}

/**
 * Add a store to favorites
 */
async function addFavorite(profileId, storeId) {
  // Verify store exists
  const store = await db('stores').where({ id: storeId, is_active: true }).first();
  if (!store) throw new AppError('Store not found.', 404);

  // Check if already favorited
  const existing = await db('store_favorites')
    .where({ profile_id: profileId, store_id: storeId })
    .first();
  if (existing) throw new AppError('Store already in your favorites.', 409);

  await db('store_favorites').insert({
    profile_id: profileId,
    store_id: storeId,
  });

  return { message: 'Store added to favorites', store };
}

/**
 * Remove a store from favorites
 */
async function removeFavorite(profileId, storeId) {
  const deleted = await db('store_favorites')
    .where({ profile_id: profileId, store_id: storeId })
    .del();

  if (!deleted) throw new AppError('Store not in your favorites.', 404);

  return { message: 'Store removed from favorites' };
}

/**
 * Check if a store is in customer's favorites
 */
async function isFavorited(profileId, storeId) {
  const fav = await db('store_favorites')
    .where({ profile_id: profileId, store_id: storeId })
    .first();
  return !!fav;
}

export default {
  getFavoriteStores,
  addFavorite,
  removeFavorite,
  isFavorited,
};
