/**
 * Combos Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { listCombos, getCombo, createCombo, updateCombo } from './combos.controller.js';

const router = Router();

// Public — browse active combos
router.get('/', listCombos);

// Public — view single combo
router.get('/:id', getCombo);

// Merchant/Admin — create combo
router.post('/', authenticate, requireRole('MERCHANT_OWNER', 'MERCHANT_STAFF', 'ADMIN', 'SUPER_ADMIN'), createCombo);

// Merchant/Admin — update combo
router.patch('/:id', authenticate, requireRole('MERCHANT_OWNER', 'MERCHANT_STAFF', 'ADMIN', 'SUPER_ADMIN'), updateCombo);

export default router;
