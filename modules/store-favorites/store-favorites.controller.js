/**
 * Store Favorites Controller
 */

import favoritesService from '../../services/store-favorites.service.js';
import { success } from '../../shared/utils.js';

/** GET /api/v1/store-favorites */
export async function listFavorites(req, res, next) {
  try {
    const stores = await favoritesService.getFavoriteStores(req.user.id);
    return success(res, stores);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/store-favorites */
export async function addFavorite(req, res, next) {
  try {
    const result = await favoritesService.addFavorite(req.user.id, req.body.store_id);
    return success(res, result, 'Store added to favorites', 201);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/store-favorites/:storeId */
export async function removeFavorite(req, res, next) {
  try {
    const result = await favoritesService.removeFavorite(req.user.id, req.params.storeId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
