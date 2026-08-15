import { Router } from 'express';
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct, listMerchantProducts } from './products.controller.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate, productSchemas } from '../../middleware/validate.js';

const router = Router();

// GET /api/v1/products — public: browse all products
router.get('/', optionalAuth, listProducts);

// GET /api/v1/products/merchant — merchant: view own products
router.get('/merchant', authenticate, requirePermission('merchant.products.read'), listMerchantProducts);

// GET /api/v1/products/:id — public: view single product
router.get('/:id', optionalAuth, getProduct);

// POST /api/v1/products — merchant: create product
router.post('/', authenticate, requirePermission('merchant.products.write'), validate(productSchemas.create), createProduct);

// PATCH /api/v1/products/:id — merchant: update own product
router.patch('/:id', authenticate, requirePermission('merchant.products.write'), validate(productSchemas.update), updateProduct);

// DELETE /api/v1/products/:id — merchant: delete own product
router.delete('/:id', authenticate, requirePermission('merchant.products.write'), deleteProduct);

export default router;
