import { supabase, supabaseAdmin } from '../../config/supabase.js';
import db from '../../config/knex.js';
import { success, created } from '../../shared/utils.js';
import { AppError } from '../../shared/errors.js';

/**
 * POST /api/v1/auth/register
 * Creates a Supabase Auth user + application profile.
 * Supabase owns the password and JWT — we own the RBAC profile.
 */
export async function register(req, res, next) {
  try {
    const { email, password, full_name, phone, date_of_birth } = req.body;

    // 1. Create Supabase Auth user (password hashing done by Supabase)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name }, // metadata stored in auth.users
      },
    });

    if (authError) {
      throw new AppError(authError.message, 400);
    }

    if (!authData.user) {
      throw new AppError('Registration failed. Please try again.', 400);
    }

    // 2. Create application profile (our RBAC data)
    const [profile] = await db('profiles').insert({
      id: authData.user.id,
      full_name,
      phone: phone || null,
      role: 'CUSTOMER',
      is_active: true,
      email: email,
      date_of_birth: date_of_birth || null,
    }).returning('*');

    // 3. Return Supabase session (JWT + refresh token)
    return created(res, {
      user: {
        id: profile.id,
        email: authData.user.email,
        full_name: profile.full_name,
        phone: profile.phone,
        role: profile.role,
        date_of_birth: profile.date_of_birth,
      },
      session: authData.session,
    }, 'Account created successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 * Authenticates via Supabase Auth. Returns Supabase JWT.
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Fetch profile for role info
    const profile = await db('profiles').where({ id: data.user.id, is_active: true }).first();
    if (!profile) {
      throw new AppError('Account not found or deactivated.', 401);
    }

    return success(res, {
      user: {
        id: profile.id,
        email: data.user.email,
        full_name: profile.full_name,
        phone: profile.phone,
        role: profile.role,
        date_of_birth: profile.date_of_birth,
      },
      session: data.session,
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user's profile.
 * Auto-creates profile for Google OAuth / SSO users on first access.
 */
export async function getMe(req, res, next) {
  try {
    let profile = await db('profiles').where({ id: req.user.id }).first();

    // Auto-create profile for OAuth users (Google, etc.) on first login
    if (!profile) {
      // Extract name from Supabase auth metadata (set during OAuth)
      const fullName = req.user.fullName || req.user.email?.split('@')[0] || 'SmartCart User';

      [profile] = await db('profiles').insert({
        id: req.user.id,
        full_name: fullName,
        email: req.user.email,
        role: 'CUSTOMER',
        is_active: true,
        // DOB intentionally left null — will require customer to complete profile
      }).returning('*');
    }

    return success(res, {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      phone: profile.phone,
      role: profile.role,
      is_active: profile.is_active,
      date_of_birth: profile.date_of_birth,
      profile_image_url: profile.profile_image_url,
      needs_profile_completion: !profile.date_of_birth && profile.role === 'CUSTOMER',
      created_at: profile.created_at,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Signs out from Supabase Auth.
 */
export async function logout(req, res, next) {
  try {
    await supabase.auth.signOut();
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}
