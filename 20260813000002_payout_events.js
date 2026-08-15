/**
 * Add payout_events table for merchant payout audit trail.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('payout_events', (t) => {
    t.increments('id').primary();
    t.integer('payout_id').notNullable().references('id').inTable('merchant_payouts').onDelete('CASCADE');
    t.string('from_status');
    t.string('to_status').notNullable();
    t.uuid('actor_id').references('id').inTable('profiles').onDelete('SET NULL');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.raw('CREATE INDEX idx_payout_events_payout ON payout_events(payout_id)');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS payout_events CASCADE');
}
