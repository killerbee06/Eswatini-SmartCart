import db from '../../config/knex.js';
import { success, paginate } from '../../shared/utils.js';
import { AppError } from '../../shared/errors.js';

/**
 * GET /api/v1/users
 * List all profiles (admin only).
 */
export async function listUsers(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [{ count: total }] = await db('profiles').count('id as count');
    const users = await db('profiles')
      .select('id', 'full_name', 'phone', 'role', 'is_active', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return paginate(res, { data: users, total: parseInt(total, 10), page, limit });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/users/:id
 * Get a single profile by ID.
 */
export async function getUser(req, res, next) {
  try {
    // Users can read their own profile; admins can read anyone's
    if (req.user.id !== req.params.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied.', 403);
    }

    const user = await db('profiles')
      .select('id', 'full_name', 'phone', 'role', 'is_active', 'date_of_birth', 'created_at')
      .where({ id: req.params.id })
      .first();

    if (!user) throw new AppError('User not found.', 404);

    return success(res, user);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/users/me
 * Customer updates own profile (name, phone).
 */
export async function updateMyProfile(req, res, next) {
  try {
    const allowed = ['full_name', 'phone', 'date_of_birth'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update.', 400);
    }

    updates.updated_at = new Date();

    const [user] = await db('profiles')
      .where({ id: req.user.id })
      .update(updates)
      .returning(['id', 'full_name', 'phone', 'role', 'is_active', 'date_of_birth']);

    if (!user) throw new AppError('User not found.', 404);

    return success(res, user, 'Profile updated');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/users/:id
 * Update a profile (admin only).
 */
export async function updateUser(req, res, next) {
  try {
    const allowed = ['full_name', 'phone', 'role', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update.', 400);
    }

    updates.updated_at = new Date();

    const [user] = await db('profiles')
      .where({ id: req.params.id })
      .update(updates)
      .returning(['id', 'full_name', 'phone', 'role', 'is_active']);

    if (!user) throw new AppError('User not found.', 404);

    return success(res, user, 'User updated');
  } catch (err) {
    next(err);
  }
}

// ============================================================
// STORE STAFF MANAGEMENT
// ============================================================

/**
 * GET /api/v1/users/stores/:storeId/staff
 * List staff for a store (owner or admin).
 */
export async function listStoreStaff(req, res, next) {
  try {
    const { storeId } = req.params;

    // Verify access
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: storeId, is_active: true })
        .first();
      if (!membership) throw new AppError('Access denied.', 403);
    }

    const staff = await db('store_users')
      .join('profiles', 'profiles.id', 'store_users.profile_id')
      .where({ 'store_users.store_id': storeId })
      .select(
        'store_users.id', 'store_users.role', 'store_users.is_active',
        'profiles.id as profile_id', 'profiles.full_name', 'profiles.phone', 'profiles.email'
      )
      .orderBy('store_users.created_at', 'asc');

    return success(res, staff);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/users/stores/:storeId/staff
 * Add staff to a store (owner or admin).
 */
export async function addStoreStaff(req, res, next) {
  try {
    const { storeId } = req.params;
    const { profile_id, role } = req.body;

    // Verify access (owner or admin)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: storeId, role: 'MERCHANT_OWNER', is_active: true })
        .first();
      if (!membership) throw new AppError('Only store owners can add staff.', 403);
    }

    // Check if already a member
    const existing = await db('store_users')
      .where({ profile_id, store_id: storeId })
      .first();
    if (existing) {
      if (existing.is_active) throw new AppError('User is already active staff.', 409);
      // Reactivate
      await db('store_users').where({ id: existing.id }).update({ is_active: true, role: role || 'MERCHANT_STAFF' });
      return success(res, { id: existing.id, profile_id, store_id: storeId, role: role || 'MERCHANT_STAFF' }, 'Staff reactivated');
    }

    // Verify the profile exists
    const profile = await db('profiles').where({ id: profile_id }).first();
    if (!profile) throw new AppError('User not found.', 404);

    const [staff] = await db('store_users').insert({
      profile_id,
      store_id: storeId,
      role: role || 'MERCHANT_STAFF',
      is_active: true,
    }).returning('*');

    return success(res, staff, 'Staff added');
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/users/stores/:storeId/staff/:staffId
 * Remove staff from a store (owner or admin).
 */
export async function removeStoreStaff(req, res, next) {
  try {
    const { storeId, staffId } = req.params;

    // Verify access
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: storeId, role: 'MERCHANT_OWNER', is_active: true })
        .first();
      if (!membership) throw new AppError('Only store owners can remove staff.', 403);
    }

    const staff = await db('store_users').where({ id: staffId, store_id: storeId }).first();
    if (!staff) throw new AppError('Staff member not found.', 404);

    // Don't allow removing the owner
    if (staff.role === 'MERCHANT_OWNER') {
      throw new AppError('Cannot remove the store owner.', 400);
    }

    await db('store_users').where({ id: staffId }).update({ is_active: false, updated_at: new Date() });

    return success(res, null, 'Staff removed');
  } catch (err) {
    next(err);
  }
}
