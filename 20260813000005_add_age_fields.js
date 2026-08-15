/**
 * Migration: Add age-related fields
 * - profiles.date_of_birth
 * - products.age_restricted, products.minimum_age
 * - categories.age_restricted, categories.minimum_age
 */

export async function up(knex) {
  // Profiles: add date_of_birth
  const hasDob = await knex.schema.hasColumn('profiles', 'date_of_birth');
  if (!hasDob) {
    await knex.schema.alterTable('profiles', (t) => {
      t.date('date_of_birth').nullable();
    });
  }

  // Products: add age restriction fields
  const hasProdAgeRestricted = await knex.schema.hasColumn('products', 'age_restricted');
  if (!hasProdAgeRestricted) {
    await knex.schema.alterTable('products', (t) => {
      t.boolean('age_restricted').notNullable().defaultTo(false);
      t.integer('minimum_age').nullable(); // null = use category default or platform default
    });
  }

  // Categories: add age restriction fields
  const hasCatAgeRestricted = await knex.schema.hasColumn('categories', 'age_restricted');
  if (!hasCatAgeRestricted) {
    await knex.schema.alterTable('categories', (t) => {
      t.boolean('age_restricted').notNullable().defaultTo(false);
      t.integer('minimum_age').nullable(); // null = use platform default
    });
  }

  // System settings: add platform default minimum age
  const hasMinAge = await knex('system_settings').where('key', 'minimum_age_for_restricted').first();
  if (!hasMinAge) {
    await knex('system_settings').insert({
      key: 'minimum_age_for_restricted',
      value: '18',
      description: 'Default minimum age for age-restricted products (Eswatini law)',
    });
  }
};

export async function down(knex) {
  await knex.schema.alterTable('profiles', (t) => {
    t.dropColumn('date_of_birth');
  });
  await knex.schema.alterTable('products', (t) => {
    t.dropColumn('age_restricted');
    t.dropColumn('minimum_age');
  });
  await knex.schema.alterTable('categories', (t) => {
    t.dropColumn('age_restricted');
    t.dropColumn('minimum_age');
  });
  await knex('system_settings').where('key', 'minimum_age_for_restricted').del();
};
