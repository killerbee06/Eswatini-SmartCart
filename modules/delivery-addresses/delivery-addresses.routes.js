/**
 * Delivery Addresses Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { listAddresses, addAddress, updateAddress, deleteAddress } from './delivery-addresses.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/addresses — list my addresses
router.get('/', listAddresses);

// POST /api/v1/addresses — add new address
router.post('/', addAddress);

// PATCH /api/v1/addresses/:id — update address
router.patch('/:id', updateAddress);

// DELETE /api/v1/addresses/:id — delete address
router.delete('/:id', deleteAddress);

export default router;
