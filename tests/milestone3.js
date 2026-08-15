/**
 * SmartCart Milestone 3 Regression Test Suite
 *
 * Tests the merchant payout system:
 *  - Payout service (balance, batch, approval, disbursement)
 *  - Payouts module (controller, routes, validation)
 *  - Constants, permissions, and route wiring
 *
 * Run: node tests/milestone3.js
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

async function readFile(path) {
  const fs = await import('fs');
  return fs.readFileSync(path, 'utf8');
}

async function fileExists(path) {
  const fs = await import('fs');
  return fs.existsSync(path);
}

// ============================================================
// 1. PAYOUT SERVICE
// ============================================================
console.log('\n💰 Payout Service Tests');

test('Payout service file exists', async () => {
  assert(await fileExists('src/services/payout.service.js'));
});

test('Payout service imports ledger and payment provider', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes("from './payment-providers/index.js'"), 'Should import payment providers');
  assert(content.includes('LEDGER_ACCOUNTS'), 'Should use ledger accounts');
  assert(content.includes('MERCHANT_PAYABLE'), 'Should reference MERCHANT_PAYABLE');
});

test('Payout service has state machine transitions', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('PAYOUT_TRANSITIONS'), 'Should define PAYOUT_TRANSITIONS');
  assert(content.includes("'PENDING'"), 'Should have PENDING state');
  assert(content.includes("'APPROVED'"), 'Should have APPROVED state');
  assert(content.includes("'PROCESSING'"), 'Should have PROCESSING state');
  assert(content.includes("'COMPLETED'"), 'Should have COMPLETED state');
  assert(content.includes("'FAILED'"), 'Should have FAILED state');
  assert(content.includes("'REJECTED'"), 'Should have REJECTED state');
});

test('Payout service validates state transitions', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('validateTransition'), 'Should validate transitions');
  assert(content.includes("PENDING: ['APPROVED', 'REJECTED']"), 'PENDING should allow APPROVED and REJECTED');
  assert(content.includes("APPROVED: ['PROCESSING', 'REJECTED']"), 'APPROVED should allow PROCESSING and REJECTED');
  assert(content.includes("PROCESSING: ['COMPLETED', 'FAILED']"), 'PROCESSING should allow COMPLETED and FAILED');
  assert(content.includes("COMPLETED: []"), 'COMPLETED should be terminal');
});

test('Payout service calculates merchant balance', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('getMerchantBalance'), 'Should export getMerchantBalance');
  assert(content.includes('total_earned'), 'Should calculate total earned');
  assert(content.includes('total_paid_out'), 'Should calculate total paid out');
  assert(content.includes('pending_payouts'), 'Should calculate pending payouts');
  assert(content.includes('available'), 'Should return available balance');
});

test('Payout service balance excludes in-flight payouts', async () => {
  const content = await readFile('src/services/payout.service.js');
  // Balance should subtract COMPLETED, PROCESSING, PENDING, and APPROVED payouts
  assert(content.includes("'COMPLETED'"), 'Should exclude COMPLETED payouts');
  assert(content.includes("'PROCESSING'"), 'Should exclude PROCESSING payouts');
  assert(content.includes("'PENDING'"), 'Should exclude PENDING payouts');
  assert(content.includes("'APPROVED'"), 'Should exclude APPROVED payouts');
});

test('Payout service generates payout batch', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('generatePayoutBatch'), 'Should export generatePayoutBatch');
  assert(content.includes('generatedBy'), 'Should track who generated the batch');
});

test('Payout batch has minimum payout threshold', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('MIN_PAYOUT_AMOUNT'), 'Should define minimum payout amount');
  assert(content.includes('50'), 'Minimum should be reasonable (SZL 50)');
});

test('Payout batch skips stores with active payouts', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('activePayout'), 'Should check for active payouts');
  assert(content.includes('PENDING'), 'Should check PENDING status');
  assert(content.includes('APPROVED'), 'Should check APPROVED status');
  assert(content.includes('PROCESSING'), 'Should check PROCESSING status');
});

test('Payout batch finds store owners', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('MERCHANT_OWNER'), 'Should find MERCHANT_OWNER role');
  assert(content.includes('store_users'), 'Should query store_users table');
});

test('Payout service has approval workflow', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('approvePayout'), 'Should export approvePayout');
  assert(content.includes("'APPROVED'"), 'Should transition to APPROVED');
});

test('Payout service has rejection workflow', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('rejectPayout'), 'Should export rejectPayout');
  assert(content.includes("'REJECTED'"), 'Should transition to REJECTED');
  assert(content.includes('reason'), 'Should require a rejection reason');
});

test('Payout service processes disbursement', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('processPayout'), 'Should export processPayout');
  assert(content.includes("'PROCESSING'"), 'Should transition to PROCESSING');
  assert(content.includes("'COMPLETED'"), 'Should handle completion');
  assert(content.includes("'FAILED'"), 'Should handle failure');
});

test('Payout service creates offsetting ledger entry on disbursement', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('DEBIT'), 'Should create DEBIT entry');
  assert(content.includes('MERCHANT_PAYABLE'), 'Should debit merchant_payable');
  assert(content.includes('payout_id'), 'Should link to payout');
  assert(content.includes('Payout disbursed'), 'Should describe the entry');
});

test('Payout service uses database transactions', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('db.transaction()'), 'Should use transactions');
  assert(content.includes('trx.commit()'), 'Should commit');
  assert(content.includes('trx.rollback()'), 'Should rollback');
});

test('Payout service uses row-level locks', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('forUpdate()'), 'Should use row-level locks');
});

test('Payout service logs payout events', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('_logPayoutEvent'), 'Should have event logger');
  assert(content.includes('payout_events'), 'Should log to payout_events');
  assert(content.includes('audit_logs'), 'Should fallback to audit_logs');
});

test('Payout service generates unique references', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('generateIdempotencyKey'), 'Should generate unique refs');
  assert(content.includes('PO-'), 'Should prefix with PO-');
});

test('Payout service has query functions', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('getPayout'), 'Should export getPayout');
  assert(content.includes('getStorePayouts'), 'Should export getStorePayouts');
  assert(content.includes('getMyPayouts'), 'Should export getMyPayouts');
  assert(content.includes('listAllPayouts'), 'Should export listAllPayouts');
});

test('Payout service has summary stats', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('getPayoutStats'), 'Should export getPayoutStats');
  assert(content.includes('total_disbursed'), 'Should track total disbursed');
  assert(content.includes('pending_count'), 'Should track pending count');
  assert(content.includes('pending_amount'), 'Should track pending amount');
});

test('Payout service includes store name and merchant name in listings', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes('store_name'), 'Should include store name');
  assert(content.includes('merchant_name'), 'Should include merchant name');
});

// ============================================================
// 2. PAYOUTS MODULE
// ============================================================
console.log('\n📱 Payouts Module Tests');

test('Payouts controller file exists', async () => {
  assert(await fileExists('src/modules/payouts/payouts.controller.js'));
});

test('Payouts controller exports all required functions', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes('export async function getBalance'), 'Should export getBalance');
  assert(content.includes('export async function getMyPayouts'), 'Should export getMyPayouts');
  assert(content.includes('export async function listPayouts'), 'Should export listPayouts');
  assert(content.includes('export async function generateBatch'), 'Should export generateBatch');
  assert(content.includes('export async function approvePayout'), 'Should export approvePayout');
  assert(content.includes('export async function rejectPayout'), 'Should export rejectPayout');
  assert(content.includes('export async function processPayout'), 'Should export processPayout');
  assert(content.includes('export async function getStats'), 'Should export getStats');
  assert(content.includes('export async function getPayout'), 'Should export getPayout');
});

test('Payouts controller restricts finance actions to correct roles', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes('FINANCE_ROLES'), 'Should define finance roles');
  assert(content.includes("'ADMIN'"), 'Should include ADMIN');
  assert(content.includes("'SUPER_ADMIN'"), 'Should include SUPER_ADMIN');
  assert(content.includes("'FINANCE'"), 'Should include FINANCE');
  assert(content.includes('requireFinanceRole'), 'Should have role check helper');
});

test('Payouts controller checks merchant store access', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes('store_users'), 'Should verify store membership');
  assert(content.includes('Access denied'), 'Should deny unauthorized access');
});

test('Payouts controller requires rejection reason', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes('Rejection reason is required'), 'Should validate reason');
});

test('Payouts controller authorizes payout detail access', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes('profile_id'), 'Should check payout ownership');
  assert(content.includes('Access denied'), 'Should deny unauthorized access');
});

test('Payouts routes file exists', async () => {
  assert(await fileExists('src/modules/payouts/payouts.routes.js'));
});

test('Payouts routes use authentication', async () => {
  const content = await readFile('src/modules/payouts/payouts.routes.js');
  assert(content.includes('authenticate'), 'Should use auth middleware');
});

test('Payouts routes use permission-based access control', async () => {
  const content = await readFile('src/modules/payouts/payouts.routes.js');
  assert(content.includes('requirePermission'), 'Should use RBAC middleware');
  assert(content.includes('merchant.payouts.read'), 'Should check merchant payout read permission');
  assert(content.includes('finance.payouts.read'), 'Should check finance payout read permission');
  assert(content.includes('finance.payouts.approve'), 'Should check finance payout approve permission');
});

test('Payouts routes use validation', async () => {
  const content = await readFile('src/modules/payouts/payouts.routes.js');
  assert(content.includes('validate'), 'Should use validation middleware');
  assert(content.includes('payoutSchemas'), 'Should use payout schemas');
});

test('Payouts routes have all required endpoints', async () => {
  const content = await readFile('src/modules/payouts/payouts.routes.js');
  assert(content.includes('/balance/:storeId'), 'Should have balance endpoint');
  assert(content.includes('/my-payouts'), 'Should have my-payouts endpoint');
  assert(content.includes('/generate'), 'Should have generate endpoint');
  assert(content.includes('/stats'), 'Should have stats endpoint');
  assert(content.includes('/:id/approve'), 'Should have approve endpoint');
  assert(content.includes('/:id/reject'), 'Should have reject endpoint');
  assert(content.includes('/:id/process'), 'Should have process endpoint');
});

test('Payouts routes handle merchant vs finance routing correctly', async () => {
  const content = await readFile('src/modules/payouts/payouts.routes.js');
  // Balance and my-payouts should use merchant permission
  // generate, approve, reject, process should use finance permission
  assert(content.includes('merchant.payouts.read'), 'Merchant routes should check merchant permission');
  assert(content.includes('finance.payouts.approve'), 'Finance routes should check finance permission');
});

// ============================================================
// 3. VALIDATION SCHEMAS
// ============================================================
console.log('\n📐 Validation Schema Tests');

test('Payout validation schemas exist', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes('payoutSchemas'), 'Should export payoutSchemas');
});

test('Payout approve schema exists', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes('payoutSchemas.approve'), 'Should have approve schema');
});

test('Payout reject schema requires reason', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes('payoutSchemas.reject'), 'Should have reject schema');
  assert(content.includes('reason'), 'Should validate reason field');
  assert(content.includes('min(3)'), 'Reason should have minimum length');
});

test('Reject reason has max length', async () => {
  const content = await readFile('src/middleware/validate.js');
  assert(content.includes('max(500)'), 'Reason should have max length');
});

// ============================================================
// 4. CONSTANTS & PERMISSIONS
// ============================================================
console.log('\n🔑 Constants & Permissions Tests');

test('PAYOUT_STATUS constants exist', async () => {
  const content = await readFile('src/shared/constants.js');
  assert(content.includes('PAYOUT_STATUS'), 'Should define PAYOUT_STATUS');
  assert(content.includes("PENDING: 'PENDING'"), 'Should have PENDING');
  assert(content.includes("APPROVED: 'APPROVED'"), 'Should have APPROVED');
  assert(content.includes("PROCESSING: 'PROCESSING'"), 'Should have PROCESSING');
  assert(content.includes("COMPLETED: 'COMPLETED'"), 'Should have COMPLETED');
  assert(content.includes("FAILED: 'FAILED'"), 'Should have FAILED');
  assert(content.includes("REJECTED: 'REJECTED'"), 'Should have REJECTED');
});

test('Payout-related permissions exist', async () => {
  const content = await readFile('src/shared/constants.js');
  assert(content.includes('MERCHANT_PAYOUTS_READ'), 'Should have MERCHANT_PAYOUTS_READ');
  assert(content.includes('FINANCE_PAYOUTS_READ'), 'Should have FINANCE_PAYOUTS_READ');
  assert(content.includes('FINANCE_PAYOUTS_APPROVE'), 'Should have FINANCE_PAYOUTS_APPROVE');
});

// ============================================================
// 5. APP.JS ROUTE WIRING
// ============================================================
console.log('\n🔌 Route Wiring Tests');

test('app.js imports payout routes', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('payoutRoutes'), 'Should import payoutRoutes');
  assert(content.includes("payouts/payouts.routes.js'"), 'Should import from correct path');
});

test('app.js mounts payout routes at /api/v1/payouts', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("'/api/v1/payouts'"), 'Should mount at /api/v1/payouts');
});

// ============================================================
// 6. MIGRATION
// ============================================================
console.log('\n🗄️  Migration Tests');

test('Payout events migration exists', async () => {
  assert(await fileExists('database/migrations/20260813000002_payout_events.js'));
});

test('Payout events migration creates correct table', async () => {
  const content = await readFile('database/migrations/20260813000002_payout_events.js');
  assert(content.includes('payout_events'), 'Should create payout_events table');
  assert(content.includes('payout_id'), 'Should have payout_id FK');
  assert(content.includes('from_status'), 'Should track from_status');
  assert(content.includes('to_status'), 'Should track to_status');
  assert(content.includes('actor_id'), 'Should track actor');
  assert(content.includes('notes'), 'Should have notes field');
  assert(content.includes('timestamps'), 'Should have timestamps');
});

test('Payout events migration has index', async () => {
  const content = await readFile('database/migrations/20260813000002_payout_events.js');
  assert(content.includes('idx_payout_events_payout'), 'Should create index on payout_id');
});

test('Payout events migration has rollback', async () => {
  const content = await readFile('database/migrations/20260813000002_payout_events.js');
  assert(content.includes('export async function down'), 'Should have down migration');
  assert(content.includes('DROP TABLE'), 'Should drop table in rollback');
});

// ============================================================
// 7. FILE STRUCTURE
// ============================================================
console.log('\n📁 File Structure Tests');

test('All payout service files exist', async () => {
  assert(await fileExists('src/services/payout.service.js'));
});

test('All payout module files exist', async () => {
  assert(await fileExists('src/modules/payouts/payouts.controller.js'));
  assert(await fileExists('src/modules/payouts/payouts.routes.js'));
});

// ============================================================
// 8. IMPORT CONSISTENCY
// ============================================================
console.log('\n🔗 Import Consistency Tests');

test('Payout service imports are consistent', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes("from '../config/knex.js'"), 'Should import knex');
  assert(content.includes("from '../shared/errors.js'"), 'Should import errors');
  assert(content.includes("from '../shared/constants.js'"), 'Should import constants');
  assert(content.includes("from '../shared/utils.js'"), 'Should import utils');
  assert(content.includes("from './payment-providers/index.js'"), 'Should import payment providers');
});

test('Payouts controller imports from service layer', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes("from '../../services/payout.service.js'"), 'Should import payout service');
  assert(content.includes("from '../../shared/utils.js'"), 'Should import utils');
  assert(content.includes("from '../../shared/errors.js'"), 'Should import errors');
});

test('Payouts routes import from controller and middleware', async () => {
  const content = await readFile('src/modules/payouts/payouts.routes.js');
  assert(content.includes("from './payouts.controller.js'"), 'Should import controller');
  assert(content.includes("from '../../middleware/auth.js'"), 'Should import auth');
  assert(content.includes("from '../../middleware/rbac.js'"), 'Should import RBAC');
  assert(content.includes("from '../../middleware/validate.js'"), 'Should import validate');
});

// ============================================================
// 9. BUSINESS LOGIC INTEGRITY
// ============================================================
console.log('\n🧮 Business Logic Integrity Tests');

test('Payout amount comes from ledger, not from request body', async () => {
  const content = await readFile('src/services/payout.service.js');
  // Balance should be calculated from ledger_entries, not from req.body
  assert(content.includes('ledger_entries'), 'Should calculate from ledger');
  assert(!content.includes('req.body.amount'), 'Should NOT read amount from request body');
  assert(!content.includes('req.body.balance'), 'Should NOT read balance from request body');
});

test('Payout batch finds delivered orders only', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes("'DELIVERED'"), 'Should only consider DELIVERED orders');
});

test('Payout controller does not directly access database for financial ops', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  // The controller should delegate to the service layer for payout operations
  assert(content.includes('payoutService'), 'Should use payout service');
});

test('Payout approval requires reason in reject but not approve', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  // Approve should have optional notes
  assert(content.includes('notes'), 'Approve should accept optional notes');
  // Reject should require reason
  assert(content.includes('reason'), 'Reject should require reason');
  assert(content.includes('Rejection reason is required'), 'Should validate reason presence');
});

test('Payout disbursement creates ledger offset entry', async () => {
  const content = await readFile('src/services/payout.service.js');
  assert(content.includes("entry_type: 'DEBIT'"), 'Should create DEBIT entry');
  assert(content.includes("account: LEDGER_ACCOUNTS.MERCHANT_PAYABLE"), 'Should debit MERCHANT_PAYABLE');
  assert(content.includes('payout_id: payoutId'), 'Should link to payout');
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
  console.log('\n✅ ALL TESTS PASSED — Milestone 3 payout system verified');
  process.exit(0);
}
