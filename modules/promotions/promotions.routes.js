/**
 * Promotions Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { listPromotions, evaluatePromotions, createPromotion, updatePromotion } from './promotions.controller.js';

const router = Router();

// Public — list active promotions
router.get('/', listPromotions);

// Authenticated — evaluate discounts for checkout
router.post('/evaluate', authenticate, evaluatePromotions);

// Admin — manage promotions
router.post('/', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), createPromotion);
router.patch('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), updatePromotion);

export default router;
