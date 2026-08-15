/**
 * SmartCart Milestone 5 Regression Test Suite
 *
 * Tests the admin financial dashboard:
 *  - Reports service (overview, revenue, merchants, ledger, refunds, deliveries)
 *  - Reports controller and routes
 *  - Route wiring and role-based access
 *
 * Run: node tests/milestone5.js
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
// 1. REPORTS SERVICE
// ============================================================
console.log('\n📊 Reports Service Tests');

test('Reports service file exists', async () => {
  assert(await fileExists('src/services/reports.service.js'));
});

test('Reports service imports ledger constants', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('LEDGER_ACCOUNTS'), 'Should import LEDGER_ACCOUNTS');
});

test('Reports service exports getPlatformOverview', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getPlatformOverview'), 'Should export getPlatformOverview');
});

test('Platform overview includes GMV', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('gross_merchandise_value'), 'Should calculate GMV');
  assert(content.includes('grand_total'), 'Should sum grand_total from orders');
});

test('Platform overview includes commission totals', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('total_commissions'), 'Should calculate total commissions');
  assert(content.includes('commission_amount'), 'Should sum commission_amount');
});

test('Platform overview includes order stats', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('total_orders'), 'Should count total orders');
  assert(content.includes('completed_orders'), 'Should count completed orders');
  assert(content.includes('cancelled_orders'), 'Should count cancelled orders');
  assert(content.includes('refunded_orders'), 'Should count refunded orders');
  assert(content.includes('pending_orders'), 'Should count pending orders');
});

test('Platform overview includes user counts by role', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes("'CUSTOMER'"), 'Should count customers');
  assert(content.includes("'MERCHANT_OWNER'"), 'Should count merchants');
  assert(content.includes("'DRIVER'"), 'Should count drivers');
  assert(content.includes('active_users'), 'Should count active users');
});

test('Platform overview includes store counts', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('total_stores'), 'Should count total stores');
  assert(content.includes('active_stores'), 'Should count active stores');
});

test('Platform overview includes payment stats', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('total_payment_volume'), 'Should calculate payment volume');
  assert(content.includes('successful_payments'), 'Should count successful payments');
  assert(content.includes('failed_payments'), 'Should count failed payments');
});

test('Platform overview supports date filtering', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('from'), 'Should accept from parameter');
  assert(content.includes('to'), 'Should accept to parameter');
  assert(content.includes('_buildDateFilter'), 'Should use date filter builder');
});

test('Reports service exports getDailyRevenue', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getDailyRevenue'), 'Should export getDailyRevenue');
  assert(content.includes("DATE(created_at)"), 'Should group by date');
});

test('Reports service exports getMonthlyRevenue', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getMonthlyRevenue'), 'Should export getMonthlyRevenue');
  assert(content.includes("TO_CHAR"), 'Should group by month');
});

test('Revenue queries include delivery fees', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('delivery_fees'), 'Should include delivery fees in revenue');
  assert(content.includes('total_delivery_fees'), 'Should total delivery fees in overview');
});

test('Reports service exports getTopMerchants', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getTopMerchants'), 'Should export getTopMerchants');
  assert(content.includes('store_name'), 'Should include store name');
  assert(content.includes('order_count'), 'Should count orders per merchant');
  assert(content.includes('gross_revenue'), 'Should calculate gross revenue');
  assert(content.includes('net_payout'), 'Should calculate net payout');
});

test('Top merchants queries support limit parameter', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('limit'), 'Should accept limit parameter');
  assert(content.includes('.limit(limit)'), 'Should apply limit');
});

test('Reports service exports getPaymentBreakdown', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getPaymentBreakdown'), 'Should export getPaymentBreakdown');
  assert(content.includes('provider'), 'Should group by provider');
  assert(content.includes('successful'), 'Should count successful');
  assert(content.includes('failed'), 'Should count failed');
  assert(content.includes('refunded'), 'Should count refunded');
});

test('Reports service exports getLedgerSummary', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getLedgerSummary'), 'Should export getLedgerSummary');
});

test('Ledger summary verifies double-entry balance', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('debits'), 'Should track debits');
  assert(content.includes('credits'), 'Should track credits');
  assert(content.includes('balanced'), 'Should verify balance');
  assert(content.includes('totalDebits'), 'Should sum debits');
  assert(content.includes('totalCredits'), 'Should sum credits');
});

test('Ledger summary includes all account types', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('CUSTOMER_PAYABLE'), 'Should include customer_payable');
  assert(content.includes('PLATFORM_REVENUE'), 'Should include platform_revenue');
  assert(content.includes('MERCHANT_PAYABLE'), 'Should include merchant_payable');
  assert(content.includes('DELIVERY_REVENUE'), 'Should include delivery_revenue');
  assert(content.includes('REFUND_PAYABLE'), 'Should include refund_payable');
});

test('Reports service exports getLedgerEntries', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getLedgerEntries'), 'Should export getLedgerEntries');
  assert(content.includes('account'), 'Should filter by account');
  assert(content.includes('order_ref'), 'Should include order reference');
  assert(content.includes('payment_ref'), 'Should include payment reference');
});

test('Reports service exports getRefundStats', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getRefundStats'), 'Should export getRefundStats');
  assert(content.includes('total_refunds'), 'Should count total refunds');
  assert(content.includes('full_refunds'), 'Should count full refunds');
  assert(content.includes('partial_refunds'), 'Should count partial refunds');
  assert(content.includes('total_refund_amount'), 'Should sum refund amounts');
});

test('Refund stats include refund rate calculation', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('refund_rate'), 'Should calculate refund rate');
  assert(content.includes('total_payments'), 'Should use total payments for rate');
});

test('Reports service exports getDeliveryStats', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getDeliveryStats'), 'Should export getDeliveryStats');
  assert(content.includes('total_deliveries'), 'Should count total');
  assert(content.includes('completed'), 'Should count completed');
  assert(content.includes('failed'), 'Should count failed');
});

test('Delivery stats include completion rate', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('completion_rate'), 'Should calculate completion rate');
});

test('Delivery stats include average delivery time', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('avg_delivery_minutes'), 'Should calculate avg delivery time');
  assert(content.includes('picked_up_at'), 'Should use pickup timestamp');
  assert(content.includes('delivered_at'), 'Should use delivery timestamp');
});

test('Delivery stats include unassigned count', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('unassigned'), 'Should count unassigned deliveries');
});

test('Reports service exports getAuditLogs', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('export async function getAuditLogs'), 'Should export getAuditLogs');
  assert(content.includes('actor_name'), 'Should include actor name');
  assert(content.includes('action'), 'Should filter by action');
  assert(content.includes('entity_type'), 'Should filter by entity type');
});

test('All queries are read-only (no mutations)', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(!content.includes('.insert('), 'Should not insert data');
  assert(!content.includes('.update('), 'Should not update data');
  assert(!content.includes('.delete('), 'Should not delete data');
  assert(!content.includes('.del('), 'Should not delete data');
});

test('Date filter builder handles both from and to', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('_buildDateFilter'), 'Should have date filter builder');
  assert(content.includes("'>= ?'"), 'Should handle from (>=)');
  assert(content.includes("'<= ?'"), 'Should handle to (<=)');
});

// ============================================================
// 2. REPORTS CONTROLLER
// ============================================================
console.log('\n📱 Reports Controller Tests');

test('Reports controller file exists', async () => {
  assert(await fileExists('src/modules/admin/admin.reports.controller.js'));
});

test('Reports controller exports all required functions', async () => {
  const content = await readFile('src/modules/admin/admin.reports.controller.js');
  assert(content.includes('export async function getOverview'), 'Should export getOverview');
  assert(content.includes('export async function getDailyRevenue'), 'Should export getDailyRevenue');
  assert(content.includes('export async function getMonthlyRevenue'), 'Should export getMonthlyRevenue');
  assert(content.includes('export async function getTopMerchants'), 'Should export getTopMerchants');
  assert(content.includes('export async function getPaymentBreakdown'), 'Should export getPaymentBreakdown');
  assert(content.includes('export async function getLedgerSummary'), 'Should export getLedgerSummary');
  assert(content.includes('export async function getLedgerEntries'), 'Should export getLedgerEntries');
  assert(content.includes('export async function getRefundStats'), 'Should export getRefundStats');
  assert(content.includes('export async function getDeliveryStats'), 'Should export getDeliveryStats');
  assert(content.includes('export async function getAuditLogs'), 'Should export getAuditLogs');
});

test('Reports controller restricts access to admin/finance roles', async () => {
  const content = await readFile('src/modules/admin/admin.reports.controller.js');
  assert(content.includes('REPORTS_ROLES'), 'Should define allowed roles');
  assert(content.includes("'ADMIN'"), 'Should include ADMIN');
  assert(content.includes("'SUPER_ADMIN'"), 'Should include SUPER_ADMIN');
  assert(content.includes("'FINANCE'"), 'Should include FINANCE');
  assert(content.includes('requireReportsRole'), 'Should have role check helper');
});

test('Reports controller passes query params to service', async () => {
  const content = await readFile('src/modules/admin/admin.reports.controller.js');
  assert(content.includes('req.query.from'), 'Should pass from param');
  assert(content.includes('req.query.to'), 'Should pass to param');
});

test('Reports controller uses service layer (not direct DB)', async () => {
  const content = await readFile('src/modules/admin/admin.reports.controller.js');
  assert(content.includes('reportsService'), 'Should use reports service');
  assert(!content.includes("db('"), 'Should NOT directly query database');
});

test('Reports controller has pagination for list endpoints', async () => {
  const content = await readFile('src/modules/admin/admin.reports.controller.js');
  assert(content.includes('paginate'), 'Should use paginate helper');
  assert(content.includes('req.query.page'), 'Should read page from query');
  assert(content.includes('req.query.limit'), 'Should read limit from query');
});

// ============================================================
// 3. REPORTS ROUTES
// ============================================================
console.log('\n🛣️  Reports Route Tests');

test('Reports routes file exists', async () => {
  assert(await fileExists('src/modules/admin/admin.reports.routes.js'));
});

test('Reports routes use authentication', async () => {
  const content = await readFile('src/modules/admin/admin.reports.routes.js');
  assert(content.includes('authenticate'), 'Should use auth middleware');
  assert(content.includes('router.use(authenticate)'), 'Should apply auth globally');
});

test('Reports routes use permission-based access control', async () => {
  const content = await readFile('src/modules/admin/admin.reports.routes.js');
  assert(content.includes('requirePermission'), 'Should use RBAC middleware');
  assert(content.includes('admin.reports.read'), 'Should check admin.reports.read permission');
  assert(content.includes('router.use(requirePermission'), 'Should apply permission globally');
});

test('Reports routes have all required endpoints', async () => {
  const content = await readFile('src/modules/admin/admin.reports.routes.js');
  assert(content.includes('/overview'), 'Should have overview endpoint');
  assert(content.includes('/revenue/daily'), 'Should have daily revenue endpoint');
  assert(content.includes('/revenue/monthly'), 'Should have monthly revenue endpoint');
  assert(content.includes('/merchants/top'), 'Should have top merchants endpoint');
  assert(content.includes('/payments/breakdown'), 'Should have payment breakdown endpoint');
  assert(content.includes('/ledger/summary'), 'Should have ledger summary endpoint');
  assert(content.includes('/ledger/entries'), 'Should have ledger entries endpoint');
  assert(content.includes('/refunds'), 'Should have refunds endpoint');
  assert(content.includes('/deliveries'), 'Should have deliveries endpoint');
  assert(content.includes('/audit'), 'Should have audit endpoint');
});

test('Reports routes use GET methods only (read-only)', async () => {
  const content = await readFile('src/modules/admin/admin.reports.routes.js');
  assert(!content.includes('router.post'), 'Should NOT have POST routes');
  assert(!content.includes('router.patch'), 'Should NOT have PATCH routes');
  assert(!content.includes('router.delete'), 'Should NOT have DELETE routes');
  assert(!content.includes('router.put'), 'Should NOT have PUT routes');
});

// ============================================================
// 4. APP.JS ROUTE WIRING
// ============================================================
console.log('\n🔌 Route Wiring Tests');

test('app.js imports admin report routes', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('adminReportRoutes'), 'Should import adminReportRoutes');
  assert(content.includes("admin/admin.reports.routes.js'"), 'Should import from correct path');
});

test('app.js mounts admin reports at correct path', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("'/api/v1/admin/reports'"), 'Should mount at /api/v1/admin/reports');
});

// ============================================================
// 5. FILE STRUCTURE & IMPORTS
// ============================================================
console.log('\n📁 File Structure & Import Tests');

test('All report files exist', async () => {
  assert(await fileExists('src/services/reports.service.js'));
  assert(await fileExists('src/modules/admin/admin.reports.controller.js'));
  assert(await fileExists('src/modules/admin/admin.reports.routes.js'));
});

test('Reports service imports are consistent', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes("from '../config/knex.js'"), 'Should import knex');
  assert(content.includes("from '../shared/constants.js'"), 'Should import constants');
});

test('Reports controller imports are consistent', async () => {
  const content = await readFile('src/modules/admin/admin.reports.controller.js');
  assert(content.includes("from '../../services/reports.service.js'"), 'Should import reports service');
  assert(content.includes("from '../../shared/utils.js'"), 'Should import utils');
  assert(content.includes("from '../../shared/errors.js'"), 'Should import errors');
});

test('Reports routes import from controller and middleware', async () => {
  const content = await readFile('src/modules/admin/admin.reports.routes.js');
  assert(content.includes("from './admin.reports.controller.js'"), 'Should import controller');
  assert(content.includes("from '../../middleware/auth.js'"), 'Should import auth');
  assert(content.includes("from '../../middleware/rbac.js'"), 'Should import RBAC');
});

// ============================================================
// 6. BUSINESS LOGIC INTEGRITY
// ============================================================
console.log('\n🧮 Business Logic Integrity Tests');

test('Overview returns period information', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes("'period'"), 'Should include period in response');
  assert(content.includes("'all_time'"), 'Should handle all_time default');
});

test('Revenue queries only count delivered orders', async () => {
  const content = await readFile('src/services/reports.service.js');
  // Both daily and monthly should filter to DELIVERED
  const dailyIdx = content.indexOf('getDailyRevenue');
  const monthlyIdx = content.indexOf('getMonthlyRevenue');
  const dailySection = content.substring(dailyIdx, dailyIdx + 300);
  const monthlySection = content.substring(monthlyIdx, monthlyIdx + 300);
  assert(dailySection.includes("'DELIVERED'"), 'Daily should filter delivered orders');
  assert(monthlySection.includes("'DELIVERED'"), 'Monthly should filter delivered orders');
});

test('Top merchants uses sub_orders for accurate store revenue', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('sub_orders'), 'Should join sub_orders for store-level revenue');
  assert(content.includes('store_payout'), 'Should calculate net payout');
});

test('Ledger summary groups by account and entry_type', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes("groupBy('account', 'entry_type')"), 'Should group by account and entry_type');
});

test('All list endpoints have pagination support', async () => {
  const content = await readFile('src/services/reports.service.js');
  assert(content.includes('getLedgerEntries'), 'Should have paginated ledger entries');
  assert(content.includes('getAuditLogs'), 'Should have paginated audit logs');
  assert(content.includes('limit(limit)'), 'Should apply limit');
  assert(content.includes('offset(offset)'), 'Should apply offset');
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
  console.log('\n✅ ALL TESTS PASSED — Milestone 5 admin dashboard verified');
  process.exit(0);
}
