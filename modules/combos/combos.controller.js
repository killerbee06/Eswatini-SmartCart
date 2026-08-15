/**
 * Combos Controller
 */

import comboService from '../../services/combo.service.js';
import { success, paginate } from '../../shared/utils.js';

/** GET /api/v1/combos */
export async function listCombos(req, res, next) {
  try {
    const result = await comboService.listCombos({
      store_id: req.query.store_id,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    });
    return paginate(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/combos/:id */
export async function getCombo(req, res, next) {
  try {
    const combo = await comboService.getCombo(req.params.id);
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });
    return success(res, combo);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/combos */
export async function createCombo(req, res, next) {
  try {
    const combo = await comboService.createCombo(req.body);
    return success(res, combo, 'Combo created', 201);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/combos/:id */
export async function updateCombo(req, res, next) {
  try {
    const combo = await comboService.updateCombo(req.params.id, req.body);
    return success(res, combo, 'Combo updated');
  } catch (err) {
    next(err);
  }
}
