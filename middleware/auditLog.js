/**
 * Audit Logging Middleware
 *
 * Intercepts mutations (POST, PATCH, PUT, DELETE) and records them
 * to the audit_logs table for compliance and debugging.
 *
 * Usage:
 *   app.use(auditLogger);  // global — logs all mutations
 *   router.post('/', auditLog('order', 'create'), handler);  // specific
 */

import db from '../config/knex.js';

/**
 * Global audit logger middleware.
 * Captures before/after snapshots for key entities.
 */
export function auditLogger(req, res, next) {
  // Only log mutations
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip health checks and static files
  if (req.originalUrl.startsWith('/api/health') || !req.originalUrl.startsWith('/api/')) {
    return next();
  }

  // Capture the original res.json to intercept the response
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Log the audit entry asynchronously (don't block the response)
    const entityType = _extractEntityType(req.originalUrl);
    const entityId = req.params?.id || null;

    db('audit_logs').insert({
      actor_id: req.user?.id || null,
      action: `${req.method.toLowerCase()}_${entityType}`,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      after: body?.data ? JSON.stringify(body.data) : null,
      ip_address: req.ip || req.connection?.remoteAddress || null,
      user_agent: req.headers?.['user-agent'] || null,
    }).catch((err) => {
      console.error('[AUDIT] Failed to write audit log:', err.message);
    });

    return originalJson(body);
  };

  next();
}

/**
 * Specific audit log function for use in controllers.
 *
 * @param {string} entityType  – e.g. 'order', 'payment', 'payout'
 * @param {string} action      – e.g. 'status_changed', 'refund_initiated'
 * @returns {Function}         – middleware-like function
 */
export function auditLog(entityType, action) {
  return async (req, res, next) => {
    // We'll log after the response is sent
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      db('audit_logs').insert({
        actor_id: req.user?.id || null,
        action: `${entityType}.${action}`,
        entity_type: entityType,
        entity_id: req.params?.id ? String(req.params.id) : null,
        after: body?.data ? JSON.stringify(body.data) : null,
        ip_address: req.ip || req.connection?.remoteAddress || null,
        user_agent: req.headers?.['user-agent'] || null,
      }).catch((err) => {
        console.error('[AUDIT] Failed to write audit log:', err.message);
      });

      return originalJson(body);
    };

    next();
  };
}

// ── Internal helpers ───────────────────────────────────────

/**
 * Extract entity type from URL path.
 * e.g. /api/v1/orders/123/status → 'order'
 */
function _extractEntityType(url) {
  const segments = url.split('/').filter(Boolean);
  const apiIdx = segments.indexOf('api');
  if (apiIdx === -1) return 'unknown';

  // After 'api' and 'v1', the next segment is the entity
  const entitySegment = segments[apiIdx + 2];
  if (!entitySegment) return 'unknown';

  // Remove trailing 's' for plural → singular
  return entitySegment.replace(/s$/, '');
}
