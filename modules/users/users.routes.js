import { Router } from 'express';
import { listUsers, getUser, updateMyProfile, updateUser, listStoreStaff, addStoreStaff, removeStoreStaff } from './users.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { validate, userSchemas } from '../../middleware/validate.js';

const router = Router();

// ============================================================
// CUSTOMER / SELF SERVICE
// ============================================================

// GET /api/v1/users/me — get own profile (alias)
router.get('/me', authenticate, (req, res) => {
  // Redirect to GET /users/:id with own ID
  req.params.id = req.user.id;
  getUser(req, res, () => {});
});

// PATCH /api/v1/users/me — update own profile
router.patch('/me', authenticate, validate(userSchemas.updateMe), updateMyProfile);

// ============================================================
// STORE STAFF MANAGEMENT
// ============================================================

// GET /api/v1/users/stores/:storeId/staff — list store staff
router.get('/stores/:storeId/staff', authenticate, requirePermission('merchant.staff.manage'), listStoreStaff);

// POST /api/v1/users/stores/:storeId/staff — add staff
router.post('/stores/:storeId/staff', authenticate, requirePermission('merchant.staff.manage'), validate(userSchemas.addStaff), addStoreStaff);

// DELETE /api/v1/users/stores/:storeId/staff/:staffId — remove staff
router.delete('/stores/:storeId/staff/:staffId', authenticate, requirePermission('merchant.staff.manage'), removeStoreStaff);

// ============================================================
// ADMIN ROUTES
// ============================================================

// GET /api/v1/users — list users (admin only)
router.get('/', authenticate, requirePermission('admin.users.manage'), listUsers);

// GET /api/v1/users/:id — get user by ID
router.get('/:id', authenticate, getUser);

// PATCH /api/v1/users/:id — update user (admin only)
router.patch('/:id', authenticate, requirePermission('admin.users.manage'), updateUser);

export default router;
