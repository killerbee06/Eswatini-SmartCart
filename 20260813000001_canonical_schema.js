/**
 * SmartCart Canonical Schema
 * Single source of truth — replaces all MongoDB and SQLite models.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Enable UUID extension for Supabase PostgreSQL
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ====================================================================
  // 1. ROLES & PERMISSIONS (RBAC)
  // ====================================================================
  await knex.schema.createTable('roles', (t) => {
    t.string('name').primary(); // e.g. CUSTOMER, MERCHANT_OWNER, DRIVER, ADMIN, SUPER_ADMIN
    t.text('description');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('permissions', (t) => {
    t.string('name').primary().notNullable(); // e.g. merchant.products.write
    t.text('description');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('role_permissions', (t) => {
    t.string('role_name').notNullable().references('name').inTable('roles').onDelete('CASCADE');
    t.string('permission_name').notNullable().references('name').inTable('permissions').onDelete('CASCADE');
    t.primary(['role_name', 'permission_name']);
    t.timestamps(true, true);
  });

  // ====================================================================
  // 2. SYSTEM SETTINGS (configurable platform values)
  // ====================================================================
  await knex.schema.createTable('system_settings', (t) => {
    t.string('key').primary().notNullable(); // e.g. platform_commission_rate, default_delivery_fee
    t.decimal('value', 10, 4).notNullable(); // numeric config
    t.text('description');
    t.uuid('updated_by').nullable();
    t.timestamps(true, true);
  });
  // Note: profiles table created below, but system_settings.updated_by FK
  // will be added after profiles exists to avoid circular dependency.

  // ====================================================================
  // 3. PROFILES (application users — references Supabase auth.users)
  // ====================================================================
  await knex.schema.createTable('profiles', (t) => {
    t.uuid('id').primary().references('id').inTable('auth.users').onDelete('CASCADE');
    t.string('full_name').notNullable();
    t.string('phone').nullable();
    t.string('role').notNullable().defaultTo('CUSTOMER'); // FK enforced via RBAC
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // Now add the system_settings FK that references profiles
  await knex.schema.alterTable('system_settings', (t) => {
    t.foreign('updated_by').references('id').inTable('profiles').onDelete('SET NULL');
  });

  // ====================================================================
  // 4. STORES
  // ====================================================================
  await knex.schema.createTable('stores', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name').notNullable();
    t.text('description');
    t.string('location');
    t.string('logo_url');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.decimal('commission_rate', 5, 4).nullable(); // NULL = use platform default
    t.timestamps(true, true);
  });

  // ====================================================================
  // 5. STORE USERS (merchant staff assignment)
  // ====================================================================
  await knex.schema.createTable('store_users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
    t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    t.string('role').notNullable().defaultTo('MERCHANT_STAFF');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['profile_id', 'store_id']);
  });

  // ====================================================================
  // 6. CATEGORIES
  // ====================================================================
  await knex.schema.createTable('categories', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.integer('parent_id').nullable().references('id').inTable('categories').onDelete('SET NULL');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // ====================================================================
  // 7. PRODUCTS
  // ====================================================================
  await knex.schema.createTable('products', (t) => {
    t.increments('id').primary();
    t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    t.string('name').notNullable();
    t.text('description');
    t.integer('category_id').references('id').inTable('categories').onDelete('SET NULL');
    t.decimal('price', 10, 2).notNullable();
    t.decimal('discount_price', 10, 2).nullable();
    t.check('price >= 0');
    t.integer('stock_quantity').notNullable().defaultTo(0);
    t.check('stock_quantity >= 0');
    t.string('image_url');
    t.boolean('is_available').notNullable().defaultTo(true);
    t.boolean('is_combo').notNullable().defaultTo(false);
    t.boolean('requires_rewards_card').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  // ====================================================================
  // 8. ORDERS (master orders — one per customer checkout)
  // ====================================================================
  await knex.schema.createTable('orders', (t) => {
    t.increments('id').primary();
    t.string('main_ref').notNullable().unique(); // e.g. SC-2026-000123
    t.uuid('customer_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
    t.uuid('driver_id').nullable().references('id').inTable('profiles').onDelete('SET NULL');

    // Status (enforced by order state machine in application code)
    t.string('status').notNullable().defaultTo('PENDING_PAYMENT');
    t.string('delivery_status').notNullable().defaultTo('PENDING');

    // Financial breakdown — ALL server-calculated, NEVER from client
    t.decimal('items_subtotal', 10, 2).notNullable().defaultTo(0);
    t.decimal('delivery_fee', 10, 2).notNullable().defaultTo(0);
    t.decimal('commission_rate_snapshot', 5, 4).notNullable(); // snapshot at checkout time
    t.decimal('commission_amount', 10, 2).notNullable().defaultTo(0);
    t.decimal('grand_total', 10, 2).notNullable().defaultTo(0);
    t.check('grand_total >= 0');
    t.check('delivery_fee >= 0');

    // Delivery
    t.string('delivery_address').notNullable();
    t.text('delivery_notes');

    // Payment
    t.string('payment_method');

    t.timestamps(true, true);
  });

  // ====================================================================
  // 9. SUB-ORDERS (one per merchant in a multi-store order)
  // ====================================================================
  await knex.schema.createTable('sub_orders', (t) => {
    t.increments('id').primary();
    t.integer('parent_order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    t.string('status').notNullable().defaultTo('PENDING');
    t.decimal('subtotal', 10, 2).notNullable().defaultTo(0);
    t.decimal('store_payout', 10, 2).notNullable().defaultTo(0);
    t.check('subtotal >= 0');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 10. ORDER ITEMS
  // ====================================================================
  await knex.schema.createTable('order_items', (t) => {
    t.increments('id').primary();
    t.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.integer('sub_order_id').nullable().references('id').inTable('sub_orders').onDelete('CASCADE');
    t.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.string('product_name').notNullable(); // snapshot at order time
    t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    t.integer('quantity').notNullable();
    t.check('quantity > 0');
    t.decimal('unit_price', 10, 2).notNullable();
    t.check('unit_price >= 0');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 11. ORDER STATUS EVENTS (audit trail for every state transition)
  // ====================================================================
  await knex.schema.createTable('order_status_events', (t) => {
    t.increments('id').primary();
    t.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.string('from_status');
    t.string('to_status').notNullable();
    t.uuid('actor_id').references('id').inTable('profiles').onDelete('SET NULL');
    t.text('notes');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 12. PAYMENTS
  // ====================================================================
  await knex.schema.createTable('payments', (t) => {
    t.increments('id').primary();
    t.string('payment_ref').notNullable().unique(); // idempotency key
    t.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.uuid('payer_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
    t.string('status').notNullable().defaultTo('CREATED');
    t.decimal('amount', 10, 2).notNullable();
    t.check('amount > 0');
    t.string('provider'); // e.g. MTN_MOMO, BANK_TRANSFER, CARD, MOCK
    t.string('provider_reference');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 13. PAYMENT ATTEMPTS (each try to process a payment)
  // ====================================================================
  await knex.schema.createTable('payment_attempts', (t) => {
    t.increments('id').primary();
    t.integer('payment_id').notNullable().references('id').inTable('payments').onDelete('CASCADE');
    t.string('status').notNullable(); // PROCESSING, SUCCEEDED, FAILED
    t.string('provider_response');
    t.text('error_message');
    t.integer('attempt_number').notNullable().defaultTo(1);
    t.timestamps(true, true);
  });

  // ====================================================================
  // 14. PAYMENT EVENTS (webhook / state transition log)
  // ====================================================================
  await knex.schema.createTable('payment_events', (t) => {
    t.increments('id').primary();
    t.integer('payment_id').notNullable().references('id').inTable('payments').onDelete('CASCADE');
    t.string('event_type').notNullable(); // webhook_received, status_changed, refund_initiated
    t.jsonb('payload');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 15. MERCHANT PAYOUTS
  // ====================================================================
  await knex.schema.createTable('merchant_payouts', (t) => {
    t.increments('id').primary();
    t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    t.uuid('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
    t.decimal('amount', 10, 2).notNullable();
    t.check('amount > 0');
    t.string('status').notNullable().defaultTo('PENDING'); // PENDING, PROCESSING, COMPLETED, FAILED
    t.string('reference');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 16. LEDGER ENTRIES (double-entry bookkeeping)
  // ====================================================================
  await knex.schema.createTable('ledger_entries', (t) => {
    t.increments('id').primary();
    t.integer('order_id').references('id').inTable('orders').onDelete('SET NULL');
    t.integer('payment_id').references('id').inTable('payments').onDelete('SET NULL');
    t.integer('payout_id').references('id').inTable('merchant_payouts').onDelete('SET NULL');
    t.string('entry_type').notNullable(); // CREDIT or DEBIT
    t.string('account').notNullable(); // e.g. customer_payable, platform_revenue, merchant_payable
    t.decimal('amount', 10, 2).notNullable();
    t.check('amount > 0');
    t.text('description');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 17. DELIVERIES
  // ====================================================================
  await knex.schema.createTable('deliveries', (t) => {
    t.increments('id').primary();
    t.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.uuid('driver_id').references('id').inTable('profiles').onDelete('SET NULL');
    t.string('status').notNullable().defaultTo('PENDING_ASSIGNMENT');
    t.string('otp');
    t.timestamp('otp_expires_at');
    t.integer('otp_attempts').notNullable().defaultTo(0);
    t.timestamp('picked_up_at');
    t.timestamp('delivered_at');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 18. DELIVERY EVENTS (status transition log)
  // ====================================================================
  await knex.schema.createTable('delivery_events', (t) => {
    t.increments('id').primary();
    t.integer('delivery_id').notNullable().references('id').inTable('deliveries').onDelete('CASCADE');
    t.string('from_status');
    t.string('to_status').notNullable();
    t.uuid('actor_id').references('id').inTable('profiles').onDelete('SET NULL');
    t.text('notes');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 19. NOTIFICATIONS
  // ====================================================================
  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.uuid('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
    t.string('type').notNullable(); // email, sms, push
    t.string('channel').notNullable(); // order_update, payment, delivery, system
    t.string('subject');
    t.text('body');
    t.string('status').notNullable().defaultTo('PENDING'); // PENDING, SENT, FAILED
    t.jsonb('metadata');
    t.timestamps(true, true);
  });

  // ====================================================================
  // 20. AUDIT LOGS (immutable audit trail)
  // ====================================================================
  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary();
    t.uuid('actor_id').references('id').inTable('profiles').onDelete('SET NULL');
    t.string('action').notNullable();
    t.string('entity_type').notNullable(); // e.g. order, payment, merchant, user
    t.string('entity_id');
    t.jsonb('before');
    t.jsonb('after');
    t.string('ip_address');
    t.string('user_agent');
    t.timestamps(true, true);
  });

  // ====================================================================
  // INDEXES for query performance
  // ====================================================================
  await knex.raw('CREATE INDEX idx_profiles_role ON profiles(role)');
  await knex.raw('CREATE INDEX idx_store_users_profile ON store_users(profile_id)');
  await knex.raw('CREATE INDEX idx_store_users_store ON store_users(store_id)');
  await knex.raw('CREATE INDEX idx_products_store ON products(store_id)');
  await knex.raw('CREATE INDEX idx_products_category ON products(category_id)');
  await knex.raw('CREATE INDEX idx_orders_customer ON orders(customer_id)');
  await knex.raw('CREATE INDEX idx_orders_driver ON orders(driver_id)');
  await knex.raw('CREATE INDEX idx_orders_status ON orders(status)');
  await knex.raw('CREATE INDEX idx_orders_main_ref ON orders(main_ref)');
  await knex.raw('CREATE INDEX idx_sub_orders_parent ON sub_orders(parent_order_id)');
  await knex.raw('CREATE INDEX idx_sub_orders_store ON sub_orders(store_id)');
  await knex.raw('CREATE INDEX idx_order_items_order ON order_items(order_id)');
  await knex.raw('CREATE INDEX idx_order_items_sub_order ON order_items(sub_order_id)');
  await knex.raw('CREATE INDEX idx_order_status_events_order ON order_status_events(order_id)');
  await knex.raw('CREATE INDEX idx_payments_order ON payments(order_id)');
  await knex.raw('CREATE INDEX idx_payments_ref ON payments(payment_ref)');
  await knex.raw('CREATE INDEX idx_payments_status ON payments(status)');
  await knex.raw('CREATE INDEX idx_payment_attempts_payment ON payment_attempts(payment_id)');
  await knex.raw('CREATE INDEX idx_payment_events_payment ON payment_events(payment_id)');
  await knex.raw('CREATE INDEX idx_merchant_payouts_store ON merchant_payouts(store_id)');
  await knex.raw('CREATE INDEX idx_ledger_entries_order ON ledger_entries(order_id)');
  await knex.raw('CREATE INDEX idx_ledger_entries_account ON ledger_entries(account)');
  await knex.raw('CREATE INDEX idx_deliveries_order ON deliveries(order_id)');
  await knex.raw('CREATE INDEX idx_deliveries_driver ON deliveries(driver_id)');
  await knex.raw('CREATE INDEX idx_delivery_events_delivery ON delivery_events(delivery_id)');
  await knex.raw('CREATE INDEX idx_notifications_profile ON notifications(profile_id)');
  await knex.raw('CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id)');
  await knex.raw('CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)');
  await knex.raw('CREATE INDEX idx_audit_logs_created ON audit_logs(created_at)');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Drop in reverse dependency order
  await knex.raw('DROP TABLE IF EXISTS audit_logs CASCADE');
  await knex.raw('DROP TABLE IF EXISTS notifications CASCADE');
  await knex.raw('DROP TABLE IF EXISTS delivery_events CASCADE');
  await knex.raw('DROP TABLE IF EXISTS deliveries CASCADE');
  await knex.raw('DROP TABLE IF EXISTS ledger_entries CASCADE');
  await knex.raw('DROP TABLE IF EXISTS merchant_payouts CASCADE');
  await knex.raw('DROP TABLE IF EXISTS payment_events CASCADE');
  await knex.raw('DROP TABLE IF EXISTS payment_attempts CASCADE');
  await knex.raw('DROP TABLE IF EXISTS payments CASCADE');
  await knex.raw('DROP TABLE IF EXISTS order_status_events CASCADE');
  await knex.raw('DROP TABLE IF EXISTS order_items CASCADE');
  await knex.raw('DROP TABLE IF EXISTS sub_orders CASCADE');
  await knex.raw('DROP TABLE IF EXISTS orders CASCADE');
  await knex.raw('DROP TABLE IF EXISTS products CASCADE');
  await knex.raw('DROP TABLE IF EXISTS categories CASCADE');
  await knex.raw('DROP TABLE IF EXISTS store_users CASCADE');
  await knex.raw('DROP TABLE IF EXISTS system_settings CASCADE');
  await knex.raw('DROP TABLE IF EXISTS stores CASCADE');
  await knex.raw('DROP TABLE IF EXISTS profiles CASCADE');
  await knex.raw('DROP TABLE IF EXISTS role_permissions CASCADE');
  await knex.raw('DROP TABLE IF EXISTS permissions CASCADE');
  await knex.raw('DROP TABLE IF EXISTS roles CASCADE');
}


