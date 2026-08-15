import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  cors: {
    origins: process.env.CORS_ORIGINS || '*',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  platform: {
    commissionDefault: parseFloat(process.env.PLATFORM_COMMISSION_DEFAULT) || 0.03,
    defaultDeliveryFee: parseFloat(process.env.DEFAULT_DELIVERY_FEE) || 25.00,
  },

  webhook: {
    secret: process.env.PAYMENT_WEBHOOK_SECRET || '',
  },
};

export default config;
