/**
 * Add read_at column to notifications table.
 * Tracks when a user has read a notification.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('notifications', (t) => {
    t.timestamp('read_at').nullable();
  });

  await knex.raw('CREATE INDEX idx_notifications_read_at ON notifications(read_at)');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_notifications_read_at');
  await knex.schema.alterTable('notifications', (t) => {
    t.dropColumn('read_at');
  });
}
