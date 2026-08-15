/**
 * Promotions Controller
 */

import promotionService from '../../services/promotion.service.js';
import { success, paginate } from '../../shared/utils.js';

/** GET /api/v1/promotions — list active promotions */
export async function listPromotions(req, res, next) {
  try {
    const { data, total, page, limit } = await promotionService.listPromotions({
      store_id: req.query.store_id,
      status: req.query.status || 'ACTIVE',
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    });
    return paginate(res, { data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/promotions/evaluate — evaluate discounts for checkout */
export async function evaluatePromotions(req, res, next) {
  try {
    const { items, promo_code } = req.body;
    const loyaltyCards = req.user.loyalty_cards || [];
    const result = await promotionService.applyPromotions(items, {
      profile_id: req.user.id,
      loyaltyCards,
      promo_code,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/promotions — admin create */
export async function createPromotion(req, res, next) {
  try {
    const promo = await promotionService.createPromotion(req.body);
    return success(res, promo, 'Promotion created');
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/promotions/:id — admin update */
export async function updatePromotion(req, res, next) {
  try {
    const promo = await promotionService.updatePromotion(req.params.id, req.body);
    return success(res, promo, 'Promotion updated');
  } catch (err) {
    next(err);
  }
}
