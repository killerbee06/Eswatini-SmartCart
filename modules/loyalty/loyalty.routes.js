/**
 * Loyalty Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getProviders, getMyCards, addCard, removeCard } from './loyalty.controller.js';

const router = Router();

// Public — list providers
router.get('/providers', getProviders);

// Authenticated — manage cards
router.get('/cards', authenticate, getMyCards);
router.post('/cards', authenticate, addCard);
router.delete('/cards/:id', authenticate, removeCard);

export default router;
