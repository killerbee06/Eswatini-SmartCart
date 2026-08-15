import { Router } from 'express';
import { register, login, getMe, logout } from './auth.controller.js';
import { validate, authSchemas } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', authLimiter, validate(authSchemas.register), register);

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate(authSchemas.login), login);

// GET /api/v1/auth/me — current user profile
router.get('/me', authenticate, getMe);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, logout);

export default router;
