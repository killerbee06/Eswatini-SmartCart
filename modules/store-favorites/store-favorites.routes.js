/**
 * Store Favorites Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { listFavorites, addFavorite, removeFavorite } from './store-favorites.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/store-favorites — list my preferred stores
router.get('/', listFavorites);

// POST /api/v1/store-favorites — add store to favorites
router.post('/', addFavorite);

// DELETE /api/v1/store-favorites/:storeId — remove store from favorites
router.delete('/:storeId', removeFavorite);

export default router;
