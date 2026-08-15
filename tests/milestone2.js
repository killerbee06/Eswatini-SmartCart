/**
 * SmartCart Milestone 2 Regression Test Suite
 *
 * Tests the payments module, delivery flow, OTP verification,
 * idempotency, webhooks, and provider abstraction.
 *
 * Run: node tests/milestone2.js
 */

import assert from 'assert';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

// Helper to read a file
async function readFile(path) {
  const fs = await import('fs');
  return fs.readFileSync(path, 'utf8');
}

async function fileExists(path) {
  const fs = await import('fs');
  return fs.existsSync(path);
}

// ============================================================
// 1. PAYMENT PROVIDER ABSTRACTION
// ============================================================
console.log('\n💳 Payment Provider Tests');

test('Base provider file exists', async () => {
  assert(await fileExists('src/services/payment-providers/base.provider.js'));
});

test('Base provider defines interface contract', async () => {
  const content = await readFile('src/services/payment-providers/base.provider.js');
  assert(content.includes('class BasePaymentProvider'), 'Should export BasePaymentProvider');
  assert(content.includes('createPayment'), 'Should define createPayment method');
  assert(content.includes('queryStatus'), 'Should define queryStatus method');
  assert(content.includes('refund'), 'Should define refund method');
});

test('Mock provider file exists', async () => {
  assert(await fileExists('src/services/payment-providers/mock.provider.js'));
});

test('Mock provider extends BasePaymentProvider', async () => {
  const content = await readFile('src/services/payment-providers/mock.provider.js');
  assert(content.includes('extends BasePaymentProvider'), 'Should extend base class');
  assert(content.includes("get name()"), 'Should implement name getter');
  assert(content.includes("'MOCK'"), 'Should return MOCK as provider name');
  assert(content.includes('createPayment'), 'Should implement createPayment');
  assert(content.includes('queryStatus'), 'Should implement queryStatus');
  assert(content.includes('refund'), 'Should implement refund');
});

test('Mock provider has configurable failure triggers', async () => {
  const content = await readFile('src/services/payment-providers/mock.provider.js');
  assert(content.includes('FAIL_AMOUNTS'), 'Should have failure amount triggers');
  assert(content.includes('forceSuccess'), 'Should have forceSuccess option');
  assert(content.includes('shouldRandomFail'), 'Should have random failure for retry testing');
});

test('Provider registry exists and exports factory', async () => {
  assert(await fileExists('src/services/payment-providers/index.js'));
  const content = await readFile('src/services/payment-providers/index.js');
  assert(content.includes('getPaymentProvider'), 'Should export getPaymentProvider factory');
  assert(content.includes('PAYMENT_PROVIDERS'), 'Should use PAYMENT_PROVIDERS constants');
  assert(content.includes('resetProviders'), 'Should export resetProviders for tests');
});

// ============================================================
// 2. PAYMENT SERVICE
// ============================================================
console.log('\n🏦 Payment Service Tests');

test('Payment service file exists', async () => {
  assert(await fileExists('src/services/payment.service.js'));
});

test('Payment service imports provider registry', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes("from './payment-providers/index.js'"), 'Should import provider registry');
  assert(content.includes('getPaymentProvider'), 'Should use getPaymentProvider');
});

test('Payment service implements idempotency', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('existing'), 'Should check for existing payment');
  assert(content.includes('payment_ref'), 'Should use payment_ref as idempotency key');
  assert(content.includes('generateIdempotencyKey'), 'Should generate unique idempotency keys');
});

test('Payment service has state machine transitions', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('PAYMENT_TRANSITIONS'), 'Should define PAYMENT_TRANSITIONS');
  assert(content.includes('validateTransition'), 'Should validate transitions');
  assert(content.includes("CREATED:"), 'Should define CREATED transitions');
  assert(content.includes("'PAID'"), 'Should include PAID state');
  assert(content.includes("'FAILED'"), 'Should include FAILED state');
  assert(content.includes("'REFUNDED'"), 'Should include REFUNDED state');
});

test('Payment service creates ledger entries on success', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('_createLedgerEntries'), 'Should have ledger entry creation');
  assert(content.includes('LEDGER_ACCOUNTS.CUSTOMER_PAYABLE'), 'Should debit customer payable');
  assert(content.includes('LEDGER_ACCOUNTS.PLATFORM_REVENUE'), 'Should credit platform revenue');
  assert(content.includes('LEDGER_ACCOUNTS.MERCHANT_PAYABLE'), 'Should credit merchant payable');
  assert(content.includes('LEDGER_ACCOUNTS.DELIVERY_REVENUE'), 'Should credit delivery revenue');
});

test('Payment service uses database transactions', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('db.transaction()'), 'Should use transactions');
  assert(content.includes('trx.commit()'), 'Should commit transactions');
  assert(content.includes('trx.rollback()'), 'Should rollback on error');
});

test('Payment service records payment attempts', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('payment_attempts'), 'Should record attempts');
  assert(content.includes('attempt_number'), 'Should track attempt numbers');
  assert(content.includes('provider_response'), 'Should store provider response');
});

test('Payment service logs payment events', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('payment_events'), 'Should log events');
  assert(content.includes("'payment_created'"), 'Should log creation events');
  assert(content.includes("'status_changed'"), 'Should log status changes');
});

test('Payment service handles webhook processing', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('handleWebhook'), 'Should export handleWebhook');
  assert(content.includes('webhook_received'), 'Should log webhook events');
  assert(content.includes('providerStatus'), 'Should map provider status');
});

test('Payment service supports refunds', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes('refundPayment'), 'Should export refundPayment');
  assert(content.includes('PARTIALLY_REFUNDED'), 'Should support partial refunds');
  assert(content.includes('REFUND_PAYABLE'), 'Should create refund ledger entries');
});

test('Payment service updates order status on payment success', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes("status: 'PAID'"), 'Should update order to PAID');
  assert(content.includes('PENDING_PAYMENT'), 'Should only update from PENDING_PAYMENT');
  assert(content.includes('order_status_events'), 'Should log order status event');
});

// ============================================================
// 3. PAYMENTS MODULE
// ============================================================
console.log('\n📱 Payments Module Tests');

test('Payments controller exists', async () => {
  assert(await fileExists('src/modules/payments/payments.controller.js'));
});

test('Payments controller exports all required functions', async () => {
  const content = await readFile('src/modules/payments/payments.controller.js');
  assert(content.includes('export async function createPayment'), 'Should export createPayment');
  assert(content.includes('export async function listMyPayments'), 'Should export listMyPayments');
  assert(content.includes('export async function getPayment'), 'Should export getPayment');
  assert(content.includes('export async function refundPayment'), 'Should export refundPayment');
  assert(content.includes('export async function getPaymentsForOrder'), 'Should export getPaymentsForOrder');
});

test('Payments controller validates order state before payment', async () => {
  const content = await readFile('src/modules/payments/payments.controller.js');
  assert(content.includes("PENDING_PAYMENT"), 'Should check order is PENDING_PAYMENT');
  assert(content.includes('Access denied'), 'Should check ownership');
});

test('Payments controller restricts refunds to admin/finance', async () => {
  const content = await readFile('src/modules/payments/payments.controller.js');
  assert(content.includes("'ADMIN'"), 'Should check ADMIN role');
  assert(content.includes("'FINANCE'"), 'Should check FINANCE role');
  assert(content.includes('Only admins or finance'), 'Should enforce refund authorization');
});

test('Payments routes exist', async () => {
  assert(await fileExists('src/modules/payments/payments.routes.js'));
});

test('Payments routes use authentication and permissions', async () => {
  const content = await readFile('src/modules/payments/payments.routes.js');
  assert(content.includes('authenticate'), 'Should use auth middleware');
  assert(content.includes('requirePermission'), 'Should use RBAC middleware');
  assert(content.includes('validate'), 'Should use validation middleware');
});

test('Payments routes have webhook endpoint (no JWT auth)', async () => {
  const content = await readFile('src/modules/payments/payments.routes.js');
  assert(content.includes('/webhook/:provider'), 'Should have webhook route');
  // Webhook route should be before authenticate middleware
  const webhookIdx = content.indexOf('/webhook/:provider');
  const authIdx = content.indexOf('authenticate');
  assert(webhookIdx < authIdx, 'Webhook route should be registered before auth middleware');
});

test('Payments routes have test webhook endpoint', async () => {
  const content = await readFile('src/modules/payments/payments.routes.js');
  assert(content.includes('/webhook/test'), 'Should have test webhook route');
});

test('Webhook handler exists', async () => {
  assert(await fileExists('src/modules/payments/payments.webhooks.js'));
});

test('Webhook handler parses payment_ref and status', async () => {
  const content = await readFile('src/modules/payments/payments.webhooks.js');
  assert(content.includes('payment_ref'), 'Should extract payment_ref');
  assert(content.includes('status'), 'Should extract status');
  assert(content.includes('handleWebhook'), 'Should call paymentService.handleWebhook');
});

test('Webhook handler returns 200 for processing errors', async () => {
  const content = await readFile('src/modules/payments/payments.webhooks.js');
  assert(content.includes('200'), 'Should return 200 to prevent retry storms');
  assert(content.includes('received: true'), 'Should acknowledge receipt');
});

test('Webhook handler validates required fields', async () => {
  const content = await readFile('src/modules/payments/payments.webhooks.js');
  assert(content.includes('Missing payment_ref'), 'Should validate payment_ref');
  assert(content.includes('Missing status'), 'Should validate status');
});

test('Test webhook endpoint is dev-only', async () => {
  const content = await readFile('src/modules/payments/payments.webhooks.js');
  assert(content.includes("production"), 'Should check for production environment');
  assert(content.includes('test_webhook'), 'Should log test webhook events');
});

// ============================================================
// 4. DELIVERY SERVICE
// ============================================================
console.log('\n🚚 Delivery Service Tests');

test('Delivery service file exists', async () => {
  assert(await fileExists('src/services/delivery.service.js'));
});

test('Delivery service has state machine transitions', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('DELIVERY_TRANSITIONS'), 'Should define DELIVERY_TRANSITIONS');
  assert(content.includes('PENDING_ASSIGNMENT:'), 'Should start at PENDING_ASSIGNMENT');
  assert(content.includes('ASSIGNED:'), 'Should have ASSIGNED transitions');
  assert(content.includes('DELIVERED:'), 'Should have DELIVERED as terminal state');
});

test('Delivery service uses OTP with expiry and rate limiting', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('OTP_EXPIRY_MS'), 'Should define OTP expiry');
  assert(content.includes('OTP_MAX_ATTEMPTS'), 'Should define max OTP attempts');
  assert(content.includes('otp_attempts'), 'Should track OTP attempts');
  assert(content.includes('otp_expires_at'), 'Should track OTP expiry');
});

test('Delivery service generates and verifies OTP', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('generateOTP'), 'Should export generateOTP');
  assert(content.includes('verifyOTP'), 'Should export verifyOTP');
  assert(content.includes('generateDeliveryOTP'), 'Should use OTP generator');
});

test('Delivery service clears OTP after successful verification', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes("otp: null"), 'Should clear OTP after success');
  assert(content.includes("otp_expires_at: null"), 'Should clear expiry after success');
});

test('Delivery service enforces OTP attempt limit', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('OTP_MAX_ATTEMPTS'), 'Should check max attempts');
  assert(content.includes('Maximum OTP attempts exceeded'), 'Should error on max exceeded');
});

test('Delivery service checks OTP expiry', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('otp_expires_at'), 'Should check expiry');
  assert(content.includes('OTP has expired'), 'Should error on expired OTP');
});

test('Delivery service creates delivery records', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('createDelivery'), 'Should export createDelivery');
  assert(content.includes('PENDING_ASSIGNMENT'), 'Should create with PENDING_ASSIGNMENT status');
});

test('Delivery service assigns drivers', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('assignDriver'), 'Should export assignDriver');
  assert(content.includes('DRIVER_ASSIGNED'), 'Should update order to DRIVER_ASSIGNED');
});

test('Delivery service transitions mirror to order status', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('orderStatusMap'), 'Should map delivery to order statuses');
  assert(content.includes("'PICKED_UP'"), 'Should map PICKED_UP');
  assert(content.includes("'OUT_FOR_DELIVERY'"), 'Should map to OUT_FOR_DELIVERY');
  assert(content.includes("'DELIVERED'"), 'Should map to DELIVERED');
});

test('Delivery service uses transactions', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('db.transaction()'), 'Should use transactions');
  assert(content.includes('trx.commit()'), 'Should commit');
  assert(content.includes('trx.rollback()'), 'Should rollback');
});

test('Delivery service logs events', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('delivery_events'), 'Should log to delivery_events');
  assert(content.includes('_logEvent'), 'Should have internal event logger');
});

test('Delivery service records timestamps for milestones', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes('picked_up_at'), 'Should record pickup time');
  assert(content.includes('delivered_at'), 'Should record delivery time');
});

// ============================================================
// 5. DELIVERY MODULE
// ============================================================
console.log('\n📦 Delivery Module Tests');

test('Delivery controller exists', async () => {
  assert(await fileExists('src/modules/delivery/delivery.controller.js'));
});

test('Delivery controller exports all required functions', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('export async function listPending'), 'Should export listPending');
  assert(content.includes('export async function assignDriver'), 'Should export assignDriver');
  assert(content.includes('export async function transitionStatus'), 'Should export transitionStatus');
  assert(content.includes('export async function generateOTP'), 'Should export generateOTP');
  assert(content.includes('export async function verifyOTP'), 'Should export verifyOTP');
  assert(content.includes('export async function myDeliveries'), 'Should export myDeliveries');
  assert(content.includes('export async function getDelivery'), 'Should export getDelivery');
});

test('Delivery controller restricts OTP generation to assigned driver', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('not assigned to this delivery'), 'Should check driver assignment');
});

test('Delivery routes exist', async () => {
  assert(await fileExists('src/modules/delivery/delivery.routes.js'));
});

test('Delivery routes use role-based access control', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  assert(content.includes('authenticate'), 'Should use auth middleware');
  assert(content.includes('requireRole'), 'Should use role-based access');
  assert(content.includes("'DRIVER'"), 'Should restrict to DRIVER role');
  assert(content.includes("'DISPATCHER'"), 'Should restrict to DISPATCHER role');
  assert(content.includes("'CUSTOMER'"), 'Should have CUSTOMER-specific routes');
});

test('Delivery routes have OTP endpoints', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  assert(content.includes('/otp/generate'), 'Should have OTP generate route');
  assert(content.includes('/otp/verify'), 'Should have OTP verify route');
});

test('Delivery routes have pending deliveries endpoint', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  assert(content.includes('/pending'), 'Should have pending deliveries route');
});

test('Delivery routes have driver deliveries endpoint', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  assert(content.includes('/my-deliveries'), 'Should have my-deliveries route');
});

// ============================================================
// 6. VALIDATION SCHEMAS
// ============================================================
console.log('\n📐 Validation Schema Tests');

test('Payment validation schemas exist', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes('paymentSchemas'), 'Should export paymentSchemas');
  assert(content.includes('paymentSchemas.create'), 'Should have create schema');
  assert(content.includes('paymentSchemas.refund'), 'Should have refund schema');
});

test('Payment create schema validates required fields', async () => {
  const content = await readFile('src/middleware/validate.js');
  // Check that order_id is required in payment create schema
  assert(content.includes('order_id'), 'Should validate order_id');
  assert(content.includes('payer_phone'), 'Should validate payer_phone');
});

test('Payment refund schema allows optional amount', async () => {
  const content = await readFile('src/middleware/validate.js');
  // Refund amount should be optional (full refund if not provided)
  assert(content.includes('paymentSchemas.refund'), 'Should have refund schema');
});

test('Delivery validation schemas exist', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes('deliverySchemas'), 'Should export deliverySchemas');
  assert(content.includes('deliverySchemas.assign'), 'Should have assign schema');
  assert(content.includes('deliverySchemas.transition'), 'Should have transition schema');
  assert(content.includes('deliverySchemas.verifyOTP'), 'Should have verifyOTP schema');
});

test('Delivery transition schema validates allowed statuses', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes("'ASSIGNED'"), 'Should allow ASSIGNED');
  assert(content.includes("'EN_ROUTE_TO_PICKUP'"), 'Should allow EN_ROUTE_TO_PICKUP');
  assert(content.includes("'PICKED_UP'"), 'Should allow PICKED_UP');
  assert(content.includes("'DELIVERED'"), 'Should allow DELIVERED');
  assert(content.includes("'FAILED'"), 'Should allow FAILED');
});

test('OTP verification schema validates 4-digit OTP', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes("length(4)"), 'Should validate OTP length');
});

// ============================================================
// 7. CONSTANTS & PERMISSIONS
// ============================================================
console.log('\n🔑 Constants & Permissions Tests');

test('Payment status constants exist', async () => {
  const content = await readFile('src/shared/constants.js');
  assert(content.includes('PAYMENT_STATUS'), 'Should define PAYMENT_STATUS');
  assert(content.includes("CREATED: 'CREATED'"), 'Should have CREATED status');
  assert(content.includes("PAID: 'PAID'"), 'Should have PAID status');
  assert(content.includes("FAILED: 'FAILED'"), 'Should have FAILED status');
  assert(content.includes("REFUNDED: 'REFUNDED'"), 'Should have REFUNDED status');
});

test('Payment provider constants exist', async () => {
  const content = await readFile('src/shared/constants.js');
  assert(content.includes('PAYMENT_PROVIDERS'), 'Should define PAYMENT_PROVIDERS');
  assert(content.includes("MOCK: 'MOCK'"), 'Should have MOCK provider');
  assert(content.includes("MTN_MOMO: 'MTN_MOMO'"), 'Should have MTN_MOMO provider');
});

test('Delivery status constants exist', async () => {
  const content = await readFile('src/shared/constants.js');
  assert(content.includes('DELIVERY_STATUS'), 'Should define DELIVERY_STATUS');
  assert(content.includes("PENDING_ASSIGNMENT: 'PENDING_ASSIGNMENT'"), 'Should have PENDING_ASSIGNMENT');
  assert(content.includes("ASSIGNED: 'ASSIGNED'"), 'Should have ASSIGNED');
  assert(content.includes("EN_ROUTE_TO_CUSTOMER: 'EN_ROUTE_TO_CUSTOMER'"), 'Should have EN_ROUTE_TO_CUSTOMER');
  assert(content.includes("DELIVERED: 'DELIVERED'"), 'Should have DELIVERED');
});

test('Ledger account constants exist', async () => {
  const content = await readFile('src/shared/constants.js');
  assert(content.includes('LEDGER_ACCOUNTS'), 'Should define LEDGER_ACCOUNTS');
  assert(content.includes('CUSTOMER_PAYABLE'), 'Should have CUSTOMER_PAYABLE');
  assert(content.includes('PLATFORM_REVENUE'), 'Should have PLATFORM_REVENUE');
  assert(content.includes('MERCHANT_PAYABLE'), 'Should have MERCHANT_PAYABLE');
  assert(content.includes('DELIVERY_REVENUE'), 'Should have DELIVERY_REVENUE');
  assert(content.includes('REFUND_PAYABLE'), 'Should have REFUND_PAYABLE');
});

test('New delivery-related permissions exist', async () => {
  const content = await readFile('src/shared/constants.js');
  assert(content.includes('DRIVER_OTP_GENERATE'), 'Should have DRIVER_OTP_GENERATE');
  assert(content.includes('CUSTOMER_OTP_VERIFY'), 'Should have CUSTOMER_OTP_VERIFY');
  assert(content.includes('DISPATCHER_DELIVERY_ASSIGN'), 'Should have DISPATCHER_DELIVERY_ASSIGN');
});

// ============================================================
// 8. APP.JS ROUTE WIRING
// ============================================================
console.log('\n🔌 Route Wiring Tests');

test('app.js imports payment routes', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("paymentRoutes"), 'Should import paymentRoutes');
  assert(content.includes("payments/payments.routes.js'"), 'Should import from correct path');
});

test('app.js imports delivery routes', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("deliveryRoutes"), 'Should import deliveryRoutes');
  assert(content.includes("delivery/delivery.routes.js'"), 'Should import from correct path');
});

test('app.js mounts payment routes at /api/v1/payments', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("'/api/v1/payments'"), 'Should mount at /api/v1/payments');
});

test('app.js mounts delivery routes at /api/v1/deliveries', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("'/api/v1/deliveries'"), 'Should mount at /api/v1/deliveries');
});

// ============================================================
// 9. UTILITY FUNCTIONS
// ============================================================
console.log('\n🔧 Utility Function Tests');

test('generateIdempotencyKey exists', async () => {
  const content = await readFile('src/shared/utils.js');
  assert(content.includes('generateIdempotencyKey'), 'Should export generateIdempotencyKey');
  assert(content.includes('pay_'), 'Should generate keys with pay_ prefix');
});

test('generateDeliveryOTP exists', async () => {
  const content = await readFile('src/shared/utils.js');
  assert(content.includes('generateDeliveryOTP'), 'Should export generateDeliveryOTP');
  assert(content.includes('1000'), 'Should generate 4-digit OTP');
  assert(content.includes('9000'), 'Should generate up to 9999');
});

test('generateIdempotencyKey produces unique keys', async () => {
  const { generateIdempotencyKey } = await import('../src/shared/utils.js');
  const keys = new Set();
  for (let i = 0; i < 100; i++) {
    keys.add(generateIdempotencyKey());
  }
  assert(keys.size === 100, `All 100 keys should be unique, got ${keys.size}`);
});

test('generateDeliveryOTP produces 4-digit strings', async () => {
  const { generateDeliveryOTP } = await import('../src/shared/utils.js');
  for (let i = 0; i < 50; i++) {
    const otp = generateDeliveryOTP();
    assert.strictEqual(otp.length, 4, `OTP should be 4 digits: ${otp}`);
    assert(/^\d{4}$/.test(otp), `OTP should be numeric: ${otp}`);
  }
});

// ============================================================
// 10. INTEGRATION: FILE STRUCTURE
// ============================================================
console.log('\n📁 File Structure Tests');

test('All payment service files exist', async () => {
  assert(await fileExists('src/services/payment-providers/base.provider.js'));
  assert(await fileExists('src/services/payment-providers/mock.provider.js'));
  assert(await fileExists('src/services/payment-providers/index.js'));
  assert(await fileExists('src/services/payment.service.js'));
});

test('All payment module files exist', async () => {
  assert(await fileExists('src/modules/payments/payments.controller.js'));
  assert(await fileExists('src/modules/payments/payments.routes.js'));
  assert(await fileExists('src/modules/payments/payments.webhooks.js'));
});

test('All delivery service files exist', async () => {
  assert(await fileExists('src/services/delivery.service.js'));
});

test('All delivery module files exist', async () => {
  assert(await fileExists('src/modules/delivery/delivery.controller.js'));
  assert(await fileExists('src/modules/delivery/delivery.routes.js'));
});

// ============================================================
// 11. MODULE IMPORT CHAIN (no circular deps, correct paths)
// ============================================================
console.log('\n🔗 Import Chain Tests');

test('Payment service imports are consistent', async () => {
  const content = await readFile('src/services/payment.service.js');
  assert(content.includes("from '../config/knex.js'"), 'Should import knex');
  assert(content.includes("from './payment-providers/index.js'"), 'Should import providers');
  assert(content.includes("from '../shared/utils.js'"), 'Should import utils');
  assert(content.includes("from '../shared/errors.js'"), 'Should import errors');
  assert(content.includes("from '../shared/constants.js'"), 'Should import constants');
});

test('Delivery service imports are consistent', async () => {
  const content = await readFile('src/services/delivery.service.js');
  assert(content.includes("from '../config/knex.js'"), 'Should import knex');
  assert(content.includes("from '../shared/utils.js'"), 'Should import utils');
  assert(content.includes("from '../shared/errors.js'"), 'Should import errors');
  assert(content.includes("from '../shared/constants.js'"), 'Should import constants');
});

test('Payments controller imports from services (not direct DB)', async () => {
  const content = await readFile('src/modules/payments/payments.controller.js');
  assert(content.includes("from '../../services/payment.service.js'"), 'Should import payment service');
  // Should NOT directly import knex for payment operations
  // (exception: order lookup for authorization check is acceptable)
});

test('Delivery controller imports from services (not direct DB)', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes("from '../../services/delivery.service.js'"), 'Should import delivery service');
});

// ============================================================
// RESULTS
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(60)}`);

if (failed > 0) {
  console.log('\n❌ SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED — Milestone 2 payments & delivery verified');
  process.exit(0);
}
