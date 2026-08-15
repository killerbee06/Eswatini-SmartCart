/**
 * Payment Webhook Handler
 *
 * Receives callbacks from payment providers after processing.
 * Endpoints are NOT authenticated via JWT — they use a webhook
 * secret / HMAC signature for verification instead.
 *
 * Webhook flow:
 *  1. Provider POSTs to /api/v1/payments/webhook/:provider
 *  2. We verify the signature (provider-specific)
 *  3. We parse the event and call paymentService.handleWebhook()
 *  4. We return 200 quickly (provider retries on timeout)
 */

import * as paymentService from '../../services/payment.service.js';
import { success } from '../../shared/utils.js';
import { AppError } from '../../shared/errors.js';

/**
 * POST /api/v1/payments/webhook/:provider
 *
 * Generic webhook endpoint — the :provider param tells us which
 * provider's format to expect. Currently only 'mock' is implemented.
 *
 * In production, each provider would have its own signature
 * verification logic here.
 */
export async function handleWebhook(req, res, next) {
  try {
    const { provider } = req.params;
    const body = req.body;

    // ── 1. Signature verification ──────────────────────────
    // In production, verify HMAC signature here:
    //   const signature = req.headers['x-webhook-signature'];
    //   const expected = hmac(body, WEBHOOK_SECRET);
    //   if (signature !== expected) throw new AppError('Invalid webhook signature', 401);

    // For mock provider, accept all requests in development
    if (provider !== 'mock' && process.env.NODE_ENV === 'production') {
      throw new AppError(`Webhook verification not implemented for provider: ${provider}`, 501);
    }

    // ── 2. Parse event ─────────────────────────────────────
    const { payment_ref, status, event_type, payload } = body;

    if (!payment_ref) {
      throw new AppError('Missing payment_ref in webhook payload.', 400);
    }

    if (!status) {
      throw new AppError('Missing status in webhook payload.', 400);
    }

    // ── 3. Process webhook ─────────────────────────────────
    const payment = await paymentService.handleWebhook({
      paymentRef: payment_ref,
      providerStatus: status,
      payload: {
        event_type: event_type || 'webhook',
        provider,
        raw: payload || body,
        received_at: new Date().toISOString(),
      },
    });

    // ── 4. Respond quickly (providers retry on timeout) ────
    return success(res, { received: true, payment_id: payment.id }, 'Webhook processed');
  } catch (err) {
    // Always return 200 for webhooks to prevent retry storms,
    // but log the error. Only return non-200 for truly invalid payloads.
    if (err.statusCode === 400) {
      return next(err);
    }
    console.error(`[WEBHOOK ERROR] ${req.params.provider}:`, err);
    return success(res, { received: true, error: 'Internal processing error' }, 'Webhook acknowledged', 200);
  }
}

/**
 * POST /api/v1/payments/webhook/test
 * Test endpoint to simulate a webhook (development only).
 */
export async function testWebhook(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Test webhook not available in production.', 403);
  }

  try {
    const { payment_ref, status } = req.body;

    if (!payment_ref || !status) {
      throw new AppError('payment_ref and status are required.', 400);
    }

    const payment = await paymentService.handleWebhook({
      paymentRef: payment_ref,
      providerStatus: status,
      payload: {
        event_type: 'test_webhook',
        provider: 'mock',
        simulated: true,
        received_at: new Date().toISOString(),
      },
    });

    return success(res, { payment_id: payment.id, status: payment.status }, 'Test webhook processed');
  } catch (err) {
    next(err);
  }
}
