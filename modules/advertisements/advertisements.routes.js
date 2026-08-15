/**
 * Advertisements Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { listAds, getAd, createAd, updateAd, trackClick } from './advertisements.controller.js';

const router = Router();

// Public — browse ads by placement (filtered by age)
router.get('/', listAds);

// Public — view single ad
router.get('/:id', getAd);

// Public — track click (no auth needed)
router.post('/:id/click', trackClick);

// Admin/Merchant — create ad
router.post('/', authenticate, requireRole('ADMIN', 'SUPER_ADMIN', 'MERCHANT_OWNER'), createAd);

// Admin/Merchant — update ad
router.patch('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN', 'MERCHANT_OWNER'), updateAd);

export default router;
