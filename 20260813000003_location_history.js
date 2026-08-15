/**
 * Add location_history table for real-time driver GPS tracking.
 *
 * Stores periodic location snapshots from drivers during active deliveries.
 * Used for live map display and delivery audit trail.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('location_history', (t) => {
    t.increments('id').primary();
    t.integer('delivery_id').notNullable().references('id').inTable('deliveries').onDelete('CASCADE');
    t.uuid('driver_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
    t.decimal('latitude', 10, 7).notNullable();
    t.decimal('longitude', 10, 7).notNullable();
    t.decimal('accuracy', 8, 2).nullable(); // GPS accuracy in meters
    t.decimal('speed', 6, 2).nullable();   // km/h
    t.decimal('heading', 5, 1).nullable(); // degrees (0-360)
    t.timestamps(true, true);
  });

  // Index for querying by delivery (most common query)
  await knex.raw('CREATE INDEX idx_location_history_delivery ON location_history(delivery_id)');
  // Index for time-series queries
  await knex.raw('CREATE INDEX idx_location_history_created ON location_history(created_at)');
  // Composite index for delivery + time ordering
  await knex.raw('CREATE INDEX idx_location_history_delivery_time ON location_history(delivery_id, created_at DESC)');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS location_history CASCADE');
}
