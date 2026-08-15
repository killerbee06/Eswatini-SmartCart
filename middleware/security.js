/**
 * Security Middleware Collection
 *
 * Implements multiple security layers:
 *  - Input sanitization (XSS prevention, item 15)
 *  - Response trimming (remove internal fields, item 17)
 *  - Bot protection (item 12)
 *  - Content-Type validation
 *  - Request size limiting
 */

import crypto from 'crypto';

// ── Sensitive fields to strip from API responses (item 17) ──
const SENSITIVE_FIELDS = new Set([
  'password',
  'password_hash',
  'hashed_password',
  'otp',
  'otp_expires_at',
  'otp_attempts',
  'service_role_key',
  'secret',
  'api_key',
  'token',
  'refresh_token',
  'access_token',
]);

// ── Known bot/user-agent patterns to block (item 12) ──────
const BLOCKED_BOTS = [
  /sqlmap/i,
  /nikto/i,
  /nessus/i,
  /masscan/i,
  /nmap/i,
  /dirbuster/i,
  /gobuster/i,
  /ffuf/i,
  /wfuzz/i,
  /havij/i,
  /acunetix/i,
  /netsparker/i,
  /w3af/i,
  /openvas/i,
  /zmeu/i,
  /morfeus/i,
];

// ── Dangerous patterns in input (item 15) ──────────────────
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
];

/**
 * Bot protection middleware.
 * Blocks known vulnerability scanners and attack tools.
 */
export function botProtection(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';

  // Block known attack tools
  for (const pattern of BLOCKED_BOTS) {
    if (pattern.test(userAgent)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }
  }

  // Block requests with no user-agent (common in scripts)
  if (!userAgent && !req.originalUrl.includes('/health')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied.',
    });
  }

  next();
}

/**
 * Input sanitization middleware.
 * Strips dangerous HTML/JS from string fields in req.body.
 */
export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    _sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    _sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    _sanitizeObject(req.params);
  }
  next();
}

/**
 * Response sanitizer — strips sensitive fields from JSON responses.
 * Applied as middleware after routes.
 */
export function sanitizeResponse(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (body && typeof body === 'object') {
      _stripSensitiveFields(body);
    }
    return originalJson(body);
  };

  next();
}

/**
 * Content-Type validation middleware.
 * Ensures POST/PATCH/PUT requests have proper content type.
 */
export function validateContentType(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json') &&
        !contentType.includes('application/x-www-form-urlencoded') &&
        !contentType.includes('multipart/form-data')) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported Content-Type. Use application/json.',
      });
    }
  }
  next();
}

/**
 * Request ID middleware (generates if not provided).
 */
export function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}

/**
 * Security headers middleware (supplements Helmet).
 */
export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');
  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  // Cache control for API responses
  if (req.originalUrl.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
}

// ── Internal helpers ───────────────────────────────────────

/**
 * Recursively sanitize string values in an object.
 */
function _sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      // Strip HTML tags
      obj[key] = obj[key].replace(/<[^>]*>/g, '');
      // Encode special characters
      obj[key] = obj[key]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      // Check for XSS patterns
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(obj[key])) {
          obj[key] = '';
          break;
        }
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      _sanitizeObject(obj[key]);
    }
  }
}

/**
 * Strip sensitive fields from response objects.
 */
function _stripSensitiveFields(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(_stripSensitiveFields);
    return;
  }

  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_FIELDS.has(key)) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        _stripSensitiveFields(obj[key]);
      }
    }
  }
}
