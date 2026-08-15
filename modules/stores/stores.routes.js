import { Router } from 'express';
import { listStores, getStore, createStore, updateStore } from './stores.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate, storeSchemas } from '../../middleware/validate.js';

const router = Router();

// GET /api/v1/stores — public: browse active stores
router.get('/', listStores);

// GET /api/v1/stores/:id — public: view a single store
router.get('/:id', getStore);

// POST /api/v1/stores — create store (admin or merchant owner)
router.post('/', authenticate, requirePermission('admin.merchants.approve'), validate(storeSchemas.create), createStore);

// PATCH /api/v1/stores/:id — update store (owner or admin)
router.patch('/:id', authenticate, validate(storeSchemas.update), updateStore);

export default router;
