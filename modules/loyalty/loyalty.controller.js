/**
 * Loyalty Controller
 */

import loyaltyService from '../../services/loyalty.service.js';
import { success } from '../../shared/utils.js';

/** GET /api/v1/loyalty/providers — list available loyalty providers */
export async function getProviders(req, res, next) {
  try {
    const providers = await loyaltyService.getProviders();
    return success(res, providers);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/loyalty/cards — get my loyalty cards */
export async function getMyCards(req, res, next) {
  try {
    const cards = await loyaltyService.getMyCards(req.user.id);
    return success(res, cards);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/loyalty/cards — add a loyalty card */
export async function addCard(req, res, next) {
  try {
    const card = await loyaltyService.addCard(req.user.id, req.body);
    return success(res, card, 'Card added');
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/loyalty/cards/:id — remove a loyalty card */
export async function removeCard(req, res, next) {
  try {
    const result = await loyaltyService.removeCard(req.user.id, req.params.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
