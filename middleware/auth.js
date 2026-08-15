import { supabase } from '../config/supabase.js';
import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';

/**
 * Verify Supabase JWT and attach user profile to req.user.
 * This is the ONLY authentication middleware. No custom JWT.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Access denied. No token provided.', 401));
    }

    const token = authHeader.split(' ')[1];

    // Verify token via Supabase Auth — this is authoritative
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return next(new AppError('Invalid or expired token.', 401));
    }

    // Fetch application profile (our RBAC data)
    const profile = await db('profiles').where({ id: user.id, is_active: true }).first();

    if (!profile) {
      return next(new AppError('User profile not found or deactivated.', 401));
    }

    // Attach both auth user and profile to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      fullName: profile.full_name,
    };

    next();
  } catch (err) {
    next(new AppError('Authentication failed.', 401));
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't fail if missing.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return next();

    const profile = await db('profiles').where({ id: user.id, is_active: true }).first();
    if (profile) {
      req.user = {
        id: user.id,
        email: user.email,
        role: profile.role,
        fullName: profile.full_name,
      };
    }

    next();
  } catch {
    next(); // Don't fail on optional auth errors
  }
}
