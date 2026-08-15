import { createClient } from '@supabase/supabase-js';
import config from './index.js';

if (!config.supabase.url || !config.supabase.anonKey) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not set. Auth will not work.');
}

// Public client — uses anon key, respects RLS
export const supabase = createClient(
  config.supabase.url || 'http://localhost:54321',
  config.supabase.anonKey || 'placeholder'
);

// Admin client — uses service role key, bypasses RLS (server-side only)
export const supabaseAdmin = createClient(
  config.supabase.url || 'http://localhost:54321',
  config.supabase.serviceRoleKey || config.supabase.anonKey || 'placeholder',
  { auth: { autoRefreshToken: false, persistSession: false } }
);
