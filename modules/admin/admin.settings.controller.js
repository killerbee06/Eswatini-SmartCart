/**
 * Admin Settings Controller
 *
 * REST endpoints for platform settings management:
 *  - GET    /              – list all settings
 *  - GET    /:key          – get a single setting
 *  - PATCH  /:key          – update a setting
 */

import db from '../../config/knex.js';
import { success } from '../../shared/utils.js';
import { AppError, NotFoundError } from '../../shared/errors.js';

/**
 * GET /api/v1/admin/settings
 * List all platform settings.
 */
export async function listSettings(req, res, next) {
  try {
    const settings = await db('system_settings')
      .orderBy('key', 'asc');

    return success(res, settings);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/settings/:key
 * Get a single setting by key.
 */
export async function getSetting(req, res, next) {
  try {
    const setting = await db('system_settings')
      .where({ key: req.params.key })
      .first();

    if (!setting) throw new NotFoundError('Setting');

    return success(res, setting);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/settings/:key
 * Update a platform setting.
 */
export async function updateSetting(req, res, next) {
  try {
    const setting = await db('system_settings')
      .where({ key: req.params.key })
      .first();

    if (!setting) throw new NotFoundError('Setting');

    const { value, description } = req.body;
    const updates = { updated_at: new Date() };

    if (value !== undefined) updates.value = value;
    if (description !== undefined) updates.description = description;
    updates.updated_by = req.user.id;

    const [updated] = await db('system_settings')
      .where({ key: req.params.key })
      .update(updates)
      .returning('*');

    return success(res, updated, 'Setting updated');
  } catch (err) {
    next(err);
  }
}
