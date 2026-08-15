/**
 * Cart Controller — server-side cart management
 */

import cartService from '../../services/cart.service.js';
import { success } from '../../shared/utils.js';

/** GET /api/v1/cart */
export async function getCart(req, res, next) {
  try {
    const cart = await cartService.getCart(req.user.id);
    return success(res, cart);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/cart/items */
export async function addItem(req, res, next) {
  try {
    const cart = await cartService.addItem(req.user.id, req.body);
    return success(res, cart, 'Item added to cart');
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/cart/items/:itemId */
export async function updateItem(req, res, next) {
  try {
    const cart = await cartService.updateItem(req.user.id, req.params.itemId, req.body);
    return success(res, cart, 'Cart updated');
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/cart/items/:itemId */
export async function removeItem(req, res, next) {
  try {
    const cart = await cartService.removeItem(req.user.id, req.params.itemId);
    return success(res, cart, 'Item removed');
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/cart */
export async function clearCart(req, res, next) {
  try {
    const result = await cartService.clearCart(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/cart/count */
export async function itemCount(req, res, next) {
  try {
    const result = await cartService.getItemCount(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
