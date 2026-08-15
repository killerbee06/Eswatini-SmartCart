/**
 * Standard API response helpers.
 */

export function success(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function created(res, data = null, message = 'Created') {
  return success(res, data, message, 201);
}

export function paginate(res, { data, total, page, limit }) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

/**
 * Generate a unique order reference.
 * Format: SC-YYYY-NNNNNN (e.g. SC-2026-000123)
 */
export function generateOrderRef() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `SC-${year}-${random}`;
}

/**
 * Generate a 4-digit delivery OTP.
 */
export function generateDeliveryOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Generate a unique idempotency key.
 */
export function generateIdempotencyKey() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `pay_${timestamp}_${random}`;
}
