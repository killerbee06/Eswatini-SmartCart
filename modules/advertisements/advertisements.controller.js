/**
 * Advertisements Controller
 */

import advertisementService from '../../services/advertisement.service.js';
import { success, paginate } from '../../shared/utils.js';

/** GET /api/v1/advertisements */
export async function listAds(req, res, next) {
  try {
    const result = await advertisementService.listAds({
      placement: req.query.placement,
      store_id: req.query.store_id,
      profile_id: req.user?.id,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    });
    return paginate(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/advertisements/:id */
export async function getAd(req, res, next) {
  try {
    const ad = await advertisementService.getAd(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });
    return success(res, ad);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/advertisements/:id/click */
export async function trackClick(req, res, next) {
  try {
    await advertisementService.recordClick(req.params.id);
    return success(res, null, 'Click recorded');
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/advertisements */
export async function createAd(req, res, next) {
  try {
    const ad = await advertisementService.createAd(req.body);
    return success(res, ad, 'Advertisement created', 201);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/advertisements/:id */
export async function updateAd(req, res, next) {
  try {
    const ad = await advertisementService.updateAd(req.params.id, req.body);
    return success(res, ad, 'Advertisement updated');
  } catch (err) {
    next(err);
  }
}
