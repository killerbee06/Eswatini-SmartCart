/**
 * Socket.IO Authentication Middleware
 *
 * Verifies the Supabase JWT on WebSocket handshake and attaches
 * the user profile to the socket for all subsequent events.
 *
 * Clients must send the token as:
 *   socket = io({ auth: { token: "eyJ..." } })
 *
 * Or as a query parameter (less secure, fallback only):
 *   socket = io({ query: { token: "eyJ..." } })
 */

import { supabase } from '../config/supabase.js';
import db from '../config/knex.js';

/**
 * Socket.IO middleware that authenticates the connection.
 * Attaches socket.user = { id, email, role, fullName }
 */
export async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required. Provide a token in auth: { token }'));
    }

    // Verify token via Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Invalid or expired token.'));
    }

    // Fetch application profile for RBAC
    const profile = await db('profiles').where({ id: user.id, is_active: true }).first();

    if (!profile) {
      return next(new Error('User profile not found or deactivated.'));
    }

    // Attach user info to socket for all event handlers
    socket.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      fullName: profile.full_name,
    };

    next();
  } catch (err) {
    next(new Error('Authentication failed.'));
  }
}
