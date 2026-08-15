import Joi from 'joi';
import { AppError } from '../shared/errors.js';

/**
 * Middleware factory: validates req.body against a Joi schema.
 */
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return next(new AppError(`Validation failed: ${messages.join('; ')}`, 400));
    }

    req.body = value; // Use sanitized/validated values
    next();
  };
}

// ============================================================
// Common validation schemas
// ============================================================

export const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    full_name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^\+?[0-9\s\-()]+$/).allow('', null),
    date_of_birth: Joi.date().max('now').allow(null, ''),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

export const productSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(2000).allow('', null),
    store_id: Joi.string().uuid().required(),
    category_id: Joi.number().integer().allow(null),
    price: Joi.number().min(0).precision(2).required(),
    discount_price: Joi.number().min(0).precision(2).allow(null),
    stock_quantity: Joi.number().integer().min(0).default(0),
    image_url: Joi.string().uri().allow('', null),
    is_available: Joi.boolean().default(true),
    is_combo: Joi.boolean().default(false),
    requires_rewards_card: Joi.boolean().default(false),
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(200),
    description: Joi.string().max(2000).allow('', null),
    category_id: Joi.number().integer().allow(null),
    price: Joi.number().min(0).precision(2),
    discount_price: Joi.number().min(0).precision(2).allow(null),
    stock_quantity: Joi.number().integer().min(0),
    image_url: Joi.string().uri().allow('', null),
    is_available: Joi.boolean(),
    is_combo: Joi.boolean(),
    requires_rewards_card: Joi.boolean(),
  }).min(1),
};

export const orderSchemas = {
  checkout: Joi.object({
    items: Joi.array().items(
      Joi.object({
        id: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().positive().required(),
      })
    ).min(1).required(),
    delivery_address: Joi.string().min(5).max(500).required(),
    delivery_notes: Joi.string().max(500).allow('', null),
    payment_method: Joi.string().valid(
      'MTN_MOMO', 'BANK_TRANSFER', 'CARD', 'CASH_ON_DELIVERY', 'MOCK'
    ).required(),
    promo_code: Joi.string().max(50).allow('', null),
  }),
};

export const orderStatusSchemas = {
  update: Joi.object({
    status: Joi.string().required(),
    notes: Joi.string().max(500).allow('', null),
  }),
};

export const storeSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(2000).allow('', null),
    location: Joi.string().max(500).allow('', null),
    logo_url: Joi.string().uri().allow('', null),
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(200),
    description: Joi.string().max(2000).allow('', null),
    location: Joi.string().max(500).allow('', null),
    logo_url: Joi.string().uri().allow('', null),
    is_active: Joi.boolean(),
  }).min(1),
};

// ============================================================
// PAYMENT SCHEMAS
// ============================================================

export const paymentSchemas = {
  create: Joi.object({
    order_id: Joi.number().integer().positive().required(),
    provider: Joi.string().valid('MTN_MOMO', 'BANK_TRANSFER', 'CARD', 'MOCK').default('MOCK'),
    payer_phone: Joi.string().pattern(/^\+?[0-9\s\-()]+$/).allow('', null),
  }),

  refund: Joi.object({
    amount: Joi.number().positive().precision(2).optional(),
  }),
};

// ============================================================
// DELIVERY SCHEMAS
// ============================================================

export const deliverySchemas = {
  assign: Joi.object({
    driver_id: Joi.string().uuid().required(),
  }),

  transition: Joi.object({
    status: Joi.string().valid(
      'ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PICKUP',
      'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'DELIVERED', 'FAILED'
    ).required(),
    notes: Joi.string().max(500).allow('', null),
  }),

  verifyOTP: Joi.object({
    otp: Joi.string().length(4).required(),
  }),
};

// ============================================================
// PAYOUT SCHEMAS
// ============================================================

export const payoutSchemas = {
  approve: Joi.object({
    notes: Joi.string().max(500).allow('', null),
  }),

  reject: Joi.object({
    reason: Joi.string().min(3).max(500).required(),
  }),
};

// ============================================================
// USER SCHEMAS
// ============================================================

export const userSchemas = {
  updateMe: Joi.object({
    full_name: Joi.string().min(2).max(100),
    phone: Joi.string().pattern(/^\+?[0-9\s\-()]+$/).allow('', null),
    date_of_birth: Joi.date().max('now').allow(null),
    default_address: Joi.string().max(500).allow(null),
  }).min(1),

  addStaff: Joi.object({
    profile_id: Joi.string().uuid().required(),
    role: Joi.string().valid('MERCHANT_STAFF', 'MERCHANT_OWNER').default('MERCHANT_STAFF'),
  }),
};

// ============================================================
// CATEGORY SCHEMAS
// ============================================================

export const categorySchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    parent_id: Joi.number().integer().positive().allow(null),
    is_active: Joi.boolean().default(true),
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(100),
    parent_id: Joi.number().integer().positive().allow(null),
    is_active: Joi.boolean(),
  }).min(1),
};

// ============================================================
// PLATFORM SETTINGS SCHEMAS
// ============================================================

export const settingsSchemas = {
  update: Joi.object({
    value: Joi.number().required(),
    description: Joi.string().max(500).allow('', null),
  }),
};
