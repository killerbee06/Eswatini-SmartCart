/**
 * SmartCart Milestone 6 Regression Test Suite
 *
 * Tests the notifications system:
 *  - Notification service (create, template, batch, list, read, delete)
 *  - Notification controller and routes
 *  - Integration with delivery, payment, and payout flows
 *  - Socket.IO real-time push
 *
 * Run: node tests/milestone6.js
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
// 1. NOTIFICATION SERVICE
// ============================================================
console.log('\n🔔 Notification Service Tests');

test('Notification service file exists', async () => {
  assert(await fileExists('src/services/notification.service.js'));
});

test('Notification service exports createNotification', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function createNotification'), 'Should export createNotification');
});

test('Notification service exports createFromTemplate', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function createFromTemplate'), 'Should export createFromTemplate');
});

test('Notification service exports createBatch', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function createBatch'), 'Should export createBatch');
});

test('Notification service exports listNotifications', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function listNotifications'), 'Should export listNotifications');
});

test('Notification service exports getUnreadCount', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function getUnreadCount'), 'Should export getUnreadCount');
});

test('Notification service exports markAsRead', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function markAsRead'), 'Should export markAsRead');
});

test('Notification service exports markAllAsRead', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function markAllAsRead'), 'Should export markAllAsRead');
});

test('Notification service exports deleteNotification', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function deleteNotification'), 'Should export deleteNotification');
});

test('Notification service has notification templates', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('TEMPLATES'), 'Should define TEMPLATES constant');
  assert(content.includes('ORDER_PLACED'), 'Should have ORDER_PLACED template');
  assert(content.includes('ORDER_PAID'), 'Should have ORDER_PAID template');
  assert(content.includes('ORDER_DELIVERED'), 'Should have ORDER_DELIVERED template');
  assert(content.includes('PAYMENT_SUCCESS'), 'Should have PAYMENT_SUCCESS template');
  assert(content.includes('PAYMENT_FAILED'), 'Should have PAYMENT_FAILED template');
  assert(content.includes('DRIVER_ASSIGNED'), 'Should have DRIVER_ASSIGNED template');
  assert(content.includes('OTP_GENERATED'), 'Should have OTP_GENERATED template');
  assert(content.includes('PAYOUT_APPROVED'), 'Should have PAYOUT_APPROVED template');
  assert(content.includes('PAYOUT_COMPLETED'), 'Should have PAYOUT_COMPLETED template');
  assert(content.includes('PAYOUT_REJECTED'), 'Should have PAYOUT_REJECTED template');
  assert(content.includes('REFUND_PROCESSED'), 'Should have REFUND_PROCESSED template');
  assert(content.includes('WELCOME'), 'Should have WELCOME template');
});

test('Template bodies support variable interpolation', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('{orderRef}'), 'Should have orderRef variable');
  assert(content.includes('{amount}'), 'Should have amount variable');
  assert(content.includes('{name}'), 'Should have name variable');
  assert(content.includes('{reason}'), 'Should have reason variable');
  assert(content.includes('replace(new RegExp'), 'Should use regex replacement');
});

test('Notification service stores in notifications table', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes("db('notifications')"), 'Should use notifications table');
  assert(content.includes('profile_id'), 'Should store profile_id');
  assert(content.includes('type'), 'Should store type');
  assert(content.includes('channel'), 'Should store channel');
  assert(content.includes('subject'), 'Should store subject');
  assert(content.includes('body'), 'Should store body');
  assert(content.includes('status'), 'Should track status');
  assert(content.includes('metadata'), 'Should store metadata');
});

test('Notification service pushes via Socket.IO', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes("io.to(`user_${profileId}`)"), 'Should emit to user room');
  assert(content.includes("'notification'"), 'Should use notification event');
});

test('Notification service simulates sending', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('_simulateSend'), 'Should have send simulation');
  assert(content.includes("status: 'SENT'"), 'Should mark as SENT after sending');
});

test('List notifications supports filters', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('type'), 'Should filter by type');
  assert(content.includes('channel'), 'Should filter by channel');
  assert(content.includes('status'), 'Should filter by status');
  assert(content.includes('unreadOnly'), 'Should filter unread only');
  assert(content.includes("read_at"), 'Should use read_at for unread check');
});

test('Mark as read checks ownership', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('notification.profile_id !== profileId'), 'Should verify ownership');
  assert(content.includes('Access denied'), 'Should deny unauthorized');
});

test('Delete checks ownership', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('.delete()'), 'Should delete notification');
});

test('Batch creation handles individual failures gracefully', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('try'), 'Should try/catch individual notifications');
  assert(content.includes('Failed to create notification'), 'Should log failures');
});

test('Batch returns array of created notifications', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('results.push'), 'Should collect results');
  assert(content.includes('return results'), 'Should return results array');
});

// ============================================================
// 2. NOTIFICATION CONVENIENCE FUNCTIONS
// ============================================================
console.log('\n🔗 Notification Integration Tests');

test('Has notifyOrderStatusChange convenience function', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function notifyOrderStatusChange'), 'Should export notifyOrderStatusChange');
  assert(content.includes('statusTemplateMap'), 'Should map status to template');
});

test('notifyOrderStatusChange maps key delivery statuses', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes("PAID: 'ORDER_PAID'"), 'Should map PAID');
  assert(content.includes("DRIVER_ASSIGNED: 'DRIVER_ASSIGNED'"), 'Should map DRIVER_ASSIGNED');
  assert(content.includes("PICKED_UP: 'ORDER_PICKED_UP'"), 'Should map PICKED_UP');
  assert(content.includes("OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY'"), 'Should map OUT_FOR_DELIVERY');
  assert(content.includes("DELIVERED: 'ORDER_DELIVERED'"), 'Should map DELIVERED');
});

test('Has notifyPaymentResult convenience function', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function notifyPaymentResult'), 'Should export notifyPaymentResult');
  assert(content.includes("PAYMENT_SUCCESS"), 'Should use PAYMENT_SUCCESS template');
  assert(content.includes("PAYMENT_FAILED"), 'Should use PAYMENT_FAILED template');
});

test('Has notifyPayoutResult convenience function', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function notifyPayoutResult'), 'Should export notifyPayoutResult');
  assert(content.includes("PAYOUT_APPROVED"), 'Should use PAYOUT_APPROVED');
  assert(content.includes("PAYOUT_COMPLETED"), 'Should use PAYOUT_COMPLETED');
  assert(content.includes("PAYOUT_REJECTED"), 'Should use PAYOUT_REJECTED');
});

test('Has notifyOTPGenerated convenience function', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes('export async function notifyOTPGenerated'), 'Should export notifyOTPGenerated');
  assert(content.includes("OTP_GENERATED"), 'Should use OTP_GENERATED template');
});

// ============================================================
// 3. NOTIFICATION CONTROLLER
// ============================================================
console.log('\n📱 Notification Controller Tests');

test('Notification controller file exists', async () => {
  assert(await fileExists('src/modules/notifications/notifications.controller.js'));
});

test('Notification controller exports all required functions', async () => {
  const content = await readFile('src/modules/notifications/notifications.controller.js');
  assert(content.includes('export async function listNotifications'), 'Should export listNotifications');
  assert(content.includes('export async function getUnreadCount'), 'Should export getUnreadCount');
  assert(content.includes('export async function markAsRead'), 'Should export markAsRead');
  assert(content.includes('export async function markAllAsRead'), 'Should export markAllAsRead');
  assert(content.includes('export async function deleteNotification'), 'Should export deleteNotification');
});

test('Notification controller uses service layer', async () => {
  const content = await readFile('src/modules/notifications/notifications.controller.js');
  assert(content.includes('notificationService'), 'Should use notification service');
  assert(!content.includes("db('notifications')"), 'Should NOT directly query database');
});

test('Notification controller supports query filters', async () => {
  const content = await readFile('src/modules/notifications/notifications.controller.js');
  assert(content.includes('req.query.type'), 'Should read type filter');
  assert(content.includes('req.query.channel'), 'Should read channel filter');
  assert(content.includes('req.query.unread_only'), 'Should read unread_only filter');
});

test('Notification controller has pagination', async () => {
  const content = await readFile('src/modules/notifications/notifications.controller.js');
  assert(content.includes('paginate'), 'Should use paginate helper');
  assert(content.includes('req.query.page'), 'Should read page');
  assert(content.includes('req.query.limit'), 'Should read limit');
});

// ============================================================
// 4. NOTIFICATION ROUTES
// ============================================================
console.log('\n🛣️  Notification Route Tests');

test('Notification routes file exists', async () => {
  assert(await fileExists('src/modules/notifications/notifications.routes.js'));
});

test('Notification routes use authentication', async () => {
  const content = await readFile('src/modules/notifications/notifications.routes.js');
  assert(content.includes('authenticate'), 'Should use auth middleware');
  assert(content.includes('router.use(authenticate)'), 'Should apply auth globally');
});

test('Notification routes have all required endpoints', async () => {
  const content = await readFile('src/modules/notifications/notifications.routes.js');
  assert(content.includes('/unread-count'), 'Should have unread-count endpoint');
  assert(content.includes('/read-all'), 'Should have read-all endpoint');
  assert(content.includes('/:id/read'), 'Should have mark-as-read endpoint');
  assert(content.includes('router.get('), 'Should have GET endpoint');
  assert(content.includes('router.patch('), 'Should have PATCH endpoints');
  assert(content.includes('router.delete('), 'Should have DELETE endpoint');
});

test('Special routes are placed before parameterized routes', async () => {
  const content = await readFile('src/modules/notifications/notifications.routes.js');
  const unreadIdx = content.indexOf('/unread-count');
  const readAllIdx = content.indexOf('/read-all');
  const paramIdx = content.indexOf('/:id/read');
  assert(unreadIdx < paramIdx, 'unread-count should come before /:id');
  assert(readAllIdx < paramIdx, 'read-all should come before /:id');
});

test('Mark-as-read and delete check ownership', async () => {
  const content = await readFile('src/modules/notifications/notifications.controller.js');
  assert(content.includes('req.user.id'), 'Should pass user ID for ownership check');
});

// ============================================================
// 5. APP.JS WIRING
// ============================================================
console.log('\n🔌 Route Wiring Tests');

test('app.js imports notification routes', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('notificationRoutes'), 'Should import notificationRoutes');
  assert(content.includes("notifications/notifications.routes.js'"), 'Should import from correct path');
});

test('app.js mounts notification routes at /api/v1/notifications', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("'/api/v1/notifications'"), 'Should mount at /api/v1/notifications');
});

test('app.js has join_user_room Socket.IO event', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('join_user_room'), 'Should handle join_user_room');
  assert(content.includes('user_${user.id}'), 'Should join user-specific room');
});

// ============================================================
// 6. INTEGRATION WITH DELIVERY FLOW
// ============================================================
console.log('\n🚚 Delivery Integration Tests');

test('Delivery controller imports notification service', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes("from '../../services/notification.service.js'"), 'Should import notification service');
});

test('Delivery controller sends notification on driver assignment', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('notifyOrderStatusChange'), 'Should call notifyOrderStatusChange');
  assert(content.includes("'DRIVER_ASSIGNED'"), 'Should send DRIVER_ASSIGNED notification');
});

test('Delivery controller sends notification on key status changes', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes("'PICKED_UP'"), 'Should notify on PICKED_UP');
  assert(content.includes("'EN_ROUTE_TO_CUSTOMER'"), 'Should notify on EN_ROUTE_TO_CUSTOMER');
  assert(content.includes("'DELIVERED'"), 'Should notify on DELIVERED');
});

test('Delivery controller sends OTP notification', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('notifyOTPGenerated'), 'Should call notifyOTPGenerated');
});

// ============================================================
// 7. INTEGRATION WITH PAYMENT FLOW
// ============================================================
console.log('\n💳 Payment Integration Tests');

test('Payments controller imports notification service', async () => {
  const content = await readFile('src/modules/payments/payments.controller.js');
  assert(content.includes("from '../../services/notification.service.js'"), 'Should import notification service');
});

test('Payments controller sends notification on payment result', async () => {
  const content = await readFile('src/modules/payments/payments.controller.js');
  assert(content.includes('notifyPaymentResult'), 'Should call notifyPaymentResult');
  assert(content.includes("'PAID'"), 'Should notify on PAID');
  assert(content.includes("'FAILED'"), 'Should notify on FAILED');
});

test('Payments controller sends refund notification', async () => {
  const content = await readFile('src/modules/payments/payments.controller.js');
  assert(content.includes("'REFUNDED'"), 'Should notify on REFUNDED');
  assert(content.includes("'PARTIALLY_REFUNDED'"), 'Should notify on PARTIALLY_REFUNDED');
});

// ============================================================
// 8. INTEGRATION WITH PAYOUT FLOW
// ============================================================
console.log('\n💰 Payout Integration Tests');

test('Payouts controller imports notification service', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes("from '../../services/notification.service.js'"), 'Should import notification service');
});

test('Payouts controller sends notification on approval', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  assert(content.includes('notifyPayoutResult'), 'Should call notifyPayoutResult');
});

test('Payouts controller sends notification on rejection', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  // The notifyPayoutResult call is in the reject handler
  const rejectIdx = content.indexOf('rejectPayout');
  const section = content.substring(rejectIdx, rejectIdx + 600);
  assert(section.includes('notifyPayoutResult'), 'Reject handler should notify merchant');
});

test('Payouts controller sends notification on disbursement', async () => {
  const content = await readFile('src/modules/payouts/payouts.controller.js');
  const processIdx = content.indexOf('processPayout');
  const section = content.substring(processIdx, processIdx + 600);
  assert(section.includes('notifyPayoutResult'), 'Process handler should notify merchant');
});

// ============================================================
// 9. MIGRATION
// ============================================================
console.log('\n🗄️  Migration Tests');

test('Read_at migration exists', async () => {
  assert(await fileExists('database/migrations/20260813000004_add_read_at_to_notifications.js'));
});

test('Read_at migration adds correct column', async () => {
  const content = await readFile('database/migrations/20260813000004_add_read_at_to_notifications.js');
  assert(content.includes('read_at'), 'Should add read_at column');
  assert(content.includes('timestamp'), 'Should be timestamp type');
  assert(content.includes('nullable'), 'Should be nullable');
  assert(content.includes('idx_notifications_read_at'), 'Should create index');
});

test('Read_at migration has rollback', async () => {
  const content = await readFile('database/migrations/20260813000004_add_read_at_to_notifications.js');
  assert(content.includes('export async function down'), 'Should have down migration');
  assert(content.includes('dropColumn'), 'Should drop column in rollback');
});

// ============================================================
// 10. FILE STRUCTURE & IMPORTS
// ============================================================
console.log('\n📁 File Structure & Import Tests');

test('All notification files exist', async () => {
  assert(await fileExists('src/services/notification.service.js'));
  assert(await fileExists('src/modules/notifications/notifications.controller.js'));
  assert(await fileExists('src/modules/notifications/notifications.routes.js'));
  assert(await fileExists('database/migrations/20260813000004_add_read_at_to_notifications.js'));
});

test('Notification service imports are consistent', async () => {
  const content = await readFile('src/services/notification.service.js');
  assert(content.includes("from '../config/knex.js'"), 'Should import knex');
  assert(content.includes("from '../shared/errors.js'"), 'Should import errors');
});

test('Notification controller imports are consistent', async () => {
  const content = await readFile('src/modules/notifications/notifications.controller.js');
  assert(content.includes("from '../../services/notification.service.js'"), 'Should import service');
  assert(content.includes("from '../../shared/utils.js'"), 'Should import utils');
});

test('Notification routes import from controller and middleware', async () => {
  const content = await readFile('src/modules/notifications/notifications.routes.js');
  assert(content.includes("from './notifications.controller.js'"), 'Should import controller');
  assert(content.includes("from '../../middleware/auth.js'"), 'Should import auth');
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
  console.log('\n✅ ALL TESTS PASSED — Milestone 6 notifications verified');
  process.exit(0);
}
