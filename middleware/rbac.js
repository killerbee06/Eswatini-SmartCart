import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';

// In-memory cache for permissions (refreshed every 5 min)
let permissionsCache = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Load permissions from database and cache them.
 */
async function loadPermissions() {
  const now = Date.now();
  if (permissionsCache.size > 0 && now - cacheTimestamp < CACHE_TTL) {
    return permissionsCache;
  }

  const rows = await db('role_permissions')
    .join('permissions', 'permissions.name', 'role_permissions.permission_name')
    .select('role_permissions.role_name', 'permissions.name as permission');

  permissionsCache = new Map();
  for (const row of rows) {
    if (!permissionsCache.has(row.role_name)) {
      permissionsCache.set(row.role_name, new Set());
    }
    permissionsCache.get(row.role_name).add(row.permission);
  }
  cacheTimestamp = now;
  return permissionsCache;
}

/**
 * Middleware factory: requirePermission('merchant.products.write')
 * Checks if the authenticated user's role has the specified permission.
 */
export function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required.', 401));
      }

      const permissions = await loadPermissions();
      const userPermissions = permissions.get(req.user.role);

      if (!userPermissions || !userPermissions.has(permissionName)) {
        return next(new AppError(
          `Insufficient permissions. Required: ${permissionName}`,
          403
        ));
      }

      next();
    } catch (err) {
      next(new AppError('Authorization check failed.', 500));
    }
  };
}

/**
 * Middleware factory: requireRole('ADMIN', 'SUPER_ADMIN')
 * Simple role check (use requirePermission for fine-grained access).
 */
export function requireRole(...roleNames) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!roleNames.includes(req.user.role)) {
      return next(new AppError(
        `Access denied. Required role: ${roleNames.join(' or ')}`,
        403
      ));
    }

    next();
  };
}

/**
 * Check if user is a merchant who owns/manages a specific store.
 */
export async function requireStoreAccess(req, res, next) {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    // Admins can access any store
    if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const storeId = req.params.storeId || req.body.store_id;
    if (!storeId) return next(); // No store context needed

    const membership = await db('store_users')
      .where({ profile_id: req.user.id, store_id: storeId, is_active: true })
      .first();

    if (!membership) {
      return next(new AppError('You do not have access to this store.', 403));
    }

    req.storeMembership = membership;
    next();
  } catch (err) {
    next(new AppError('Store access check failed.', 500));
  }
}
