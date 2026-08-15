/**
 * Cart Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getCart, addItem, updateItem, removeItem, clearCart, itemCount } from './cart.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.get('/count', itemCount);
router.post('/items', addItem);
router.patch('/items/:itemId', updateItem);
router.delete('/items/:itemId', removeItem);
router.delete('/', clearCart);

export default router;
