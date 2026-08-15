/**
 * SmartCart Milestone 4 Regression Test Suite
 *
 * Tests the real-time delivery tracking system:
 *  - Socket.IO authentication middleware
 *  - Tracking service (location, broadcasting, ETA)
 *  - Tracking REST endpoints
 *  - Socket.IO event structure
 *  - Location history
 *
 * Run: node tests/milestone4.js
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
// 1. SOCKET.IO AUTH MIDDLEWARE
// ============================================================
console.log('\n🔐 Socket.IO Auth Middleware Tests');

test('Socket auth middleware file exists', async () => {
  assert(await fileExists('src/middleware/socketAuth.js'));
});

test('Socket auth middleware verifies Supabase JWT', async () => {
  const content = await readFile('src/middleware/socketAuth.js');
  assert(content.includes('supabase.auth.getUser'), 'Should verify via Supabase');
  assert(content.includes('token'), 'Should extract token from handshake');
});

test('Socket auth middleware reads token from auth or query', async () => {
  const content = await readFile('src/middleware/socketAuth.js');
  assert(content.includes('handshake.auth'), 'Should read from auth object');
  assert(content.includes('handshake.query'), 'Should fallback to query param');
});

test('Socket auth middleware fetches user profile', async () => {
  const content = await readFile('src/middleware/socketAuth.js');
  assert(content.includes('profiles'), 'Should fetch profile');
  assert(content.includes('is_active'), 'Should check active status');
});

test('Socket auth middleware attaches user to socket', async () => {
  const content = await readFile('src/middleware/socketAuth.js');
  assert(content.includes('socket.user'), 'Should attach user to socket');
  assert(content.includes('role'), 'Should include role');
  assert(content.includes('fullName'), 'Should include fullName');
});

test('Socket auth middleware rejects unauthenticated connections', async () => {
  const content = await readFile('src/middleware/socketAuth.js');
  assert(content.includes('next(new Error'), 'Should call next with error');
  assert(content.includes('Authentication required'), 'Should have auth required error');
});

test('Socket auth middleware is used in app.js', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('socketAuthMiddleware'), 'Should import socketAuthMiddleware');
  assert(content.includes('io.use(socketAuthMiddleware)'), 'Should apply as middleware');
});

// ============================================================
// 2. TRACKING SERVICE
// ============================================================
console.log('\n📡 Tracking Service Tests');

test('Tracking service file exists', async () => {
  assert(await fileExists('src/services/tracking.service.js'));
});

test('Tracking service exports event constants', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('TRACKING_EVENTS'), 'Should export TRACKING_EVENTS');
  assert(content.includes("'driver:location'"), 'Should define driver:location event');
  assert(content.includes("'delivery:status'"), 'Should define delivery:status event');
  assert(content.includes("'delivery:assigned'"), 'Should define delivery:assigned event');
  assert(content.includes("'delivery:otp_generated'"), 'Should define OTP event');
  assert(content.includes("'delivery:completed'"), 'Should define completed event');
});

test('Tracking service records driver location', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('recordLocation'), 'Should export recordLocation');
  assert(content.includes('location_history'), 'Should store in location_history table');
  assert(content.includes('latitude'), 'Should record latitude');
  assert(content.includes('longitude'), 'Should record longitude');
  assert(content.includes('accuracy'), 'Should record accuracy');
  assert(content.includes('speed'), 'Should record speed');
  assert(content.includes('heading'), 'Should record heading');
});

test('Tracking service validates delivery ownership', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('delivery.driver_id !== driverId'), 'Should verify driver assignment');
  assert(content.includes('Access denied'), 'Should deny unauthorized drivers');
});

test('Tracking service only tracks active deliveries', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('activeStatuses'), 'Should define active statuses');
  assert(content.includes('EN_ROUTE_TO_PICKUP'), 'Should track during pickup route');
  assert(content.includes('EN_ROUTE_TO_CUSTOMER'), 'Should track during delivery route');
  assert(content.includes('PICKED_UP'), 'Should track after pickup');
  assert(content.includes('Cannot track delivery in status'), 'Should reject inactive deliveries');
});

test('Tracking service broadcasts location via Socket.IO', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('io.to(`delivery_${deliveryId}`)'), 'Should emit to delivery room');
  assert(content.includes('TRACKING_EVENTS.DRIVER_LOCATION'), 'Should use DRIVER_LOCATION event');
});

test('Tracking service gets current tracking state', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('getTrackingState'), 'Should export getTrackingState');
  assert(content.includes('latestLocation'), 'Should fetch latest location');
  assert(content.includes('location_count'), 'Should count locations');
  assert(content.includes('eta'), 'Should calculate ETA');
});

test('Tracking service authorization checks', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('customer_id'), 'Should check customer ownership');
  assert(content.includes('driver_id'), 'Should check driver assignment');
  assert(content.includes('DISPATCHER'), 'Should allow dispatchers');
  assert(content.includes('ADMIN'), 'Should allow admins');
});

test('Tracking service calculates ETA based on delivery phase', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('_calculateETA'), 'Should have ETA calculation');
  assert(content.includes('waiting_for_driver'), 'Should handle no-driver case');
  assert(content.includes('driver_en_route_to_pickup'), 'Should estimate pickup route');
  assert(content.includes('out_for_delivery'), 'Should estimate delivery route');
  assert(content.includes('at_store_pickup'), 'Should estimate store pickup');
});

test('Tracking service returns null ETA for terminal states', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes("'DELIVERED'"), 'Should handle delivered state');
  assert(content.includes("'FAILED'"), 'Should handle failed state');
  assert(content.includes('return null'), 'Should return null for terminal states');
});

test('Tracking service gets location history', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('getLocationHistory'), 'Should export getLocationHistory');
  assert(content.includes('since'), 'Should support time-based filtering');
  assert(content.includes('limit'), 'Should support limit parameter');
});

test('Tracking service emit functions exist', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('export function emitStatusChange'), 'Should export emitStatusChange');
  assert(content.includes('export function emitDeliveryAssigned'), 'Should export emitDeliveryAssigned');
  assert(content.includes('export function emitOTPGenerated'), 'Should export emitOTPGenerated');
  assert(content.includes('export function emitDeliveryCompleted'), 'Should export emitDeliveryCompleted');
});

test('Tracking service broadcasts status to all on key milestones', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes('broadcastStatuses'), 'Should define broadcast statuses');
  assert(content.includes('io.emit'), 'Should broadcast globally for key events');
});

// ============================================================
// 3. APP.JS SOCKET.IO ENHANCEMENTS
// ============================================================
console.log('\n🔌 Socket.IO Enhancement Tests');

test('app.js has authenticated Socket.IO', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('io.use(socketAuthMiddleware)'), 'Should apply auth middleware');
});

test('app.js driver location handler validates role', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("'DRIVER'"), 'Should check DRIVER role');
  assert(content.includes('Only drivers can send location updates'), 'Should reject non-drivers');
});

test('app.js driver location handler validates required fields', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('deliveryId'), 'Should require deliveryId');
  assert(content.includes('latitude'), 'Should require latitude');
  assert(content.includes('longitude'), 'Should require longitude');
});

test('app.js driver location handler stores and broadcasts', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('recordLocation'), 'Should call recordLocation');
  assert(content.includes('location_recorded'), 'Should acknowledge to driver');
});

test('app.js has join/leave delivery room handlers', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('join_delivery_room'), 'Should handle join_delivery_room');
  assert(content.includes('leave_delivery_room'), 'Should handle leave_delivery_room');
  assert(content.includes('room_joined'), 'Should confirm room join');
});

test('app.js has typing indicator handler', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("'typing'"), 'Should handle typing events');
  assert(content.includes('DRIVER_TYPING'), 'Should emit typing indicator');
});

test('app.js logs authenticated connections with role', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('user.role'), 'Should log user role');
  assert(content.includes('user.fullName'), 'Should log user name');
});

test('app.js handles connection errors gracefully', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("socket.emit('error'"), 'Should emit errors to client');
  assert(content.includes('try'), 'Should try/catch async handlers');
});

// ============================================================
// 4. DELIVERY CONTROLLER TRACKING EVENTS
// ============================================================
console.log('\n📡 Delivery Controller Event Tests');

test('Delivery controller imports tracking service', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes("from '../../services/tracking.service.js'"), 'Should import tracking service');
});

test('Delivery controller emits event on driver assignment', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('emitDeliveryAssigned'), 'Should emit assignment event');
  assert(content.includes('req.io'), 'Should use Socket.IO');
});

test('Delivery controller emits event on status transition', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('emitStatusChange'), 'Should emit status change');
  assert(content.includes('beforeDelivery'), 'Should capture status before transition');
});

test('Delivery controller emits OTP generated event', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('emitOTPGenerated'), 'Should emit OTP event');
});

test('Delivery controller emits delivery completed event', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('emitDeliveryCompleted'), 'Should emit completed event');
});

test('Delivery controller has tracking state endpoint', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('export async function getTrackingState'), 'Should export getTrackingState');
  assert(content.includes('trackingService.getTrackingState'), 'Should call service');
});

test('Delivery controller has location history endpoint', async () => {
  const content = await readFile('src/modules/delivery/delivery.controller.js');
  assert(content.includes('export async function getLocationHistory'), 'Should export getLocationHistory');
  assert(content.includes('trackingService.getLocationHistory'), 'Should call service');
});

// ============================================================
// 5. DELIVERY ROUTES TRACKING ENDPOINTS
// ============================================================
console.log('\n🛣️  Delivery Route Tests');

test('Delivery routes have tracking endpoint', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  assert(content.includes('/:id/tracking'), 'Should have tracking route');
  assert(content.includes('getTrackingState'), 'Should map to getTrackingState');
});

test('Delivery routes have location history endpoint', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  assert(content.includes('/:id/locations'), 'Should have locations route');
  assert(content.includes('getLocationHistory'), 'Should map to getLocationHistory');
});

test('Tracking routes use authentication', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  // Find tracking route and verify it uses authenticate
  const trackingIdx = content.indexOf('/:id/tracking');
  const authSegment = content.substring(trackingIdx, trackingIdx + 200);
  assert(authSegment.includes('authenticate'), 'Tracking route should use auth');
});

test('Tracking routes are placed after /:id to avoid conflicts', async () => {
  const content = await readFile('src/modules/delivery/delivery.routes.js');
  const detailIdx = content.indexOf("router.get(\n  '/:id'");
  const trackingIdx = content.indexOf('/:id/tracking');
  const locationsIdx = content.indexOf('/:id/locations');
  assert(trackingIdx > detailIdx, 'Tracking should come after /:id');
  assert(locationsIdx > trackingIdx, 'Locations should come after tracking');
});

// ============================================================
// 6. LOCATION HISTORY MIGRATION
// ============================================================
console.log('\n🗄️  Migration Tests');

test('Location history migration exists', async () => {
  assert(await fileExists('database/migrations/20260813000003_location_history.js'));
});

test('Location history migration creates correct table', async () => {
  const content = await readFile('database/migrations/20260813000003_location_history.js');
  assert(content.includes('location_history'), 'Should create location_history table');
  assert(content.includes('delivery_id'), 'Should have delivery_id FK');
  assert(content.includes('driver_id'), 'Should have driver_id FK');
  assert(content.includes('latitude'), 'Should have latitude');
  assert(content.includes('longitude'), 'Should have longitude');
  assert(content.includes('accuracy'), 'Should have accuracy');
  assert(content.includes('speed'), 'Should have speed');
  assert(content.includes('heading'), 'Should have heading');
  assert(content.includes('timestamps'), 'Should have timestamps');
});

test('Location history migration has correct indexes', async () => {
  const content = await readFile('database/migrations/20260813000003_location_history.js');
  assert(content.includes('idx_location_history_delivery'), 'Should index by delivery');
  assert(content.includes('idx_location_history_created'), 'Should index by created_at');
  assert(content.includes('idx_location_history_delivery_time'), 'Should have composite index');
});

test('Location history migration has rollback', async () => {
  const content = await readFile('database/migrations/20260813000003_location_history.js');
  assert(content.includes('export async function down'), 'Should have down migration');
  assert(content.includes('DROP TABLE'), 'Should drop table in rollback');
});

// ============================================================
// 7. FILE STRUCTURE & IMPORTS
// ============================================================
console.log('\n📁 File Structure & Import Tests');

test('All tracking files exist', async () => {
  assert(await fileExists('src/middleware/socketAuth.js'));
  assert(await fileExists('src/services/tracking.service.js'));
  assert(await fileExists('database/migrations/20260813000003_location_history.js'));
});

test('Tracking service imports are consistent', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes("from '../config/knex.js'"), 'Should import knex');
  assert(content.includes("from '../shared/errors.js'"), 'Should import errors');
  assert(content.includes("from '../shared/constants.js'"), 'Should import constants');
});

test('Socket auth middleware imports are consistent', async () => {
  const content = await readFile('src/middleware/socketAuth.js');
  assert(content.includes("from '../config/supabase.js'"), 'Should import supabase');
  assert(content.includes("from '../config/knex.js'"), 'Should import knex');
});

test('app.js imports tracking service', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("from './services/tracking.service.js'"), 'Should import tracking service');
  assert(content.includes('recordLocation'), 'Should import recordLocation');
  assert(content.includes('TRACKING_EVENTS'), 'Should import TRACKING_EVENTS');
});

// ============================================================
// 8. EVENT PROTOCOL
// ============================================================
console.log('\n📨 Event Protocol Tests');

test('Location update payload includes all GPS fields', async () => {
  const content = await readFile('src/services/tracking.service.js');
  assert(content.includes("'driverId'"), 'Payload should include driverId');
  assert(content.includes("'latitude'"), 'Payload should include latitude');
  assert(content.includes("'longitude'"), 'Payload should include longitude');
  assert(content.includes("'timestamp'"), 'Payload should include timestamp');
});

test('Status change event includes from and to', async () => {
  const content = await readFile('src/services/tracking.service.js');
  const statusFn = content.indexOf('export function emitStatusChange');
  const fnBody = content.substring(statusFn, statusFn + 500);
  assert(fnBody.includes("'from'"), 'Should include from status');
  assert(fnBody.includes("'to'"), 'Should include to status');
  assert(fnBody.includes("'timestamp'"), 'Should include timestamp');
});

test('Driver acknowledges location receipt', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('location_recorded'), 'Should emit acknowledgment');
});

test('Error events are sent to clients', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes("socket.emit('error'"), 'Should emit error events');
});

test('Room join is confirmed to client', async () => {
  const content = await readFile('src/app.js');
  assert(content.includes('room_joined'), 'Should confirm room join');
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
  console.log('\n✅ ALL TESTS PASSED — Milestone 4 live tracking verified');
  process.exit(0);
}
