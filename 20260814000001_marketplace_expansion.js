/**
 * Marketplace Expansion Migration
 * Adds columns and tables for:
 *  - Customer profiles: DOB, email, image
 *  - Products: brand, SKU, barcode, selling method, variable weight, age restriction
 *  - Stores: banner, contact, hours, featured
 *  - Promotions engine
 *  - Loyalty system
 *  - Combos / bundles
 *  - Advertisements
 *  - Shopping cart
 *  - Product images (multiple)
 */

/** @param { import("knex").Knex } knex */
export async function up(knex) {
  // ====================================================================
  // 1. PROFILE EXPANSION — guard columns that may exist from migration 005
  // ====================================================================
  const profileCols = await knex.raw(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'profiles'
  `);
  const existingProfileCols = new Set(profileCols.rows.map(r => r.column_name));

  await knex.schema.alterTable('profiles', (t) => {
    if (!existingProfileCols.has('date_of_birth')) t.date('date_of_birth').nullable();
    if (!existingProfileCols.has('email')) t.string('email').nullable();
    if (!existingProfileCols.has('profile_image_url')) t.string('profile_image_url').nullable();
    if (!existingProfileCols.has('email_verified')) t.boolean('email_verified').notNullable().defaultTo(false);
    if (!existingProfileCols.has('phone_verified')) t.boolean('phone_verified').notNullable().defaultTo(false);
    if (!existingProfileCols.has('preferences')) t.jsonb('preferences').nullable();
    if (!existingProfileCols.has('default_address')) t.string('default_address').nullable();
  });

  // ====================================================================
  // 2. STORE EXPANSION
  // ====================================================================
  const storeCols = await knex.raw(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'stores'
  `);
  const existingStoreCols = new Set(storeCols.rows.map(r => r.column_name));

  await knex.schema.alterTable('stores', (t) => {
    if (!existingStoreCols.has('banner_url')) t.string('banner_url').nullable();
    if (!existingStoreCols.has('contact_phone')) t.string('contact_phone').nullable();
    if (!existingStoreCols.has('contact_email')) t.string('contact_email').nullable();
    if (!existingStoreCols.has('opening_hours')) t.jsonb('opening_hours').nullable();
    if (!existingStoreCols.has('is_featured')) t.boolean('is_featured').notNullable().defaultTo(false);
    if (!existingStoreCols.has('verification_status')) t.string('verification_status').notNullable().defaultTo('PENDING');
    if (!existingStoreCols.has('delivery_fee')) t.decimal('delivery_fee', 8, 2).nullable();
    if (!existingStoreCols.has('min_order_amount')) t.decimal('min_order_amount', 8, 2).nullable();
    if (!existingStoreCols.has('address')) t.string('address').nullable();
    if (!existingStoreCols.has('latitude')) t.decimal('latitude', 10, 7).nullable();
    if (!existingStoreCols.has('longitude')) t.decimal('longitude', 10, 7).nullable();
  });

  // ====================================================================
  // 3. PRODUCT EXPANSION — guard for age_restricted/minimum_age from 005
  // ====================================================================
  const productCols = await knex.raw(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products'
  `);
  const existingProductCols = new Set(productCols.rows.map(r => r.column_name));

  await knex.schema.alterTable('products', (t) => {
    if (!existingProductCols.has('brand')) t.string('brand').nullable();
    if (!existingProductCols.has('sku')) t.string('sku').nullable();
    if (!existingProductCols.has('barcode')) t.string('barcode').nullable();
    if (!existingProductCols.has('selling_method')) t.string('selling_method').notNullable().defaultTo('UNIT');
    if (!existingProductCols.has('measurement_unit')) t.string('measurement_unit').nullable();
    if (!existingProductCols.has('price_per_unit')) t.decimal('price_per_unit', 10, 4).nullable();
    if (!existingProductCols.has('minimum_quantity')) t.decimal('minimum_quantity', 8, 3).nullable();
    if (!existingProductCols.has('maximum_quantity')) t.decimal('maximum_quantity', 8, 3).nullable();
    if (!existingProductCols.has('quantity_increment')) t.decimal('quantity_increment', 8, 3).nullable();
    if (!existingProductCols.has('special_instructions_enabled')) t.boolean('special_instructions_enabled').notNullable().defaultTo(false);
    if (!existingProductCols.has('age_restricted')) t.boolean('age_restricted').notNullable().defaultTo(false);
    if (!existingProductCols.has('minimum_age')) t.integer('minimum_age').nullable().defaultTo(18);
    if (!existingProductCols.has('store_location_aisle')) t.string('store_location_aisle').nullable();
    if (!existingProductCols.has('store_location_shelf')) t.string('store_location_shelf').nullable();
    if (!existingProductCols.has('store_location_section')) t.string('store_location_section').nullable();
    if (!existingProductCols.has('is_promoted')) t.boolean('is_promoted').notNullable().defaultTo(false);
  });

  // Add indexes for new columns (IF NOT EXISTS for safety)
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_products_selling_method ON products(selling_method)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_products_age_restricted ON products(age_restricted)');

  // ====================================================================
  // 4. PRODUCT IMAGES (multiple images per product)
  // ====================================================================
  const hasProductImages = await knex.schema.hasTable('product_images');
  if (!hasProductImages) {
    await knex.schema.createTable('product_images', (t) => {
      t.increments('id').primary();
      t.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      t.string('image_url').notNullable();
      t.string('alt_text').nullable();
      t.boolean('is_primary').notNullable().defaultTo(false);
      t.integer('sort_order').notNullable().defaultTo(0);
      t.timestamps(true, true);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id)');
  }

  // ====================================================================
  // 5. PROMOTIONS
  // ====================================================================
  const hasPromotions = await knex.schema.hasTable('promotions');
  if (!hasPromotions) {
    await knex.schema.createTable('promotions', (t) => {
      t.increments('id').primary();
      t.uuid('store_id').nullable().references('id').inTable('stores').onDelete('CASCADE');
      t.string('name').notNullable();
      t.text('description').nullable();
      t.string('promo_code').nullable().unique();
      t.string('discount_type').notNullable();
      t.decimal('discount_value', 10, 2).notNullable();
      t.integer('product_id').nullable().references('id').inTable('products').onDelete('CASCADE');
      t.integer('category_id').nullable().references('id').inTable('categories').onDelete('SET NULL');
      t.decimal('min_basket_value', 10, 2).nullable();
      t.integer('min_quantity').nullable();
      t.integer('max_uses_total').nullable();
      t.integer('max_uses_per_customer').nullable();
      t.integer('current_uses').notNullable().defaultTo(0);
      t.timestamp('starts_at').notNullable();
      t.timestamp('expires_at').notNullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.string('status').notNullable().defaultTo('ACTIVE');
      t.timestamps(true, true);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_promotions_store ON promotions(store_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_promotions_product ON promotions(product_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_promotions_category ON promotions(category_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(starts_at, expires_at)');
  }

  // ====================================================================
  // 6. LOYALTY PROVIDERS
  // ====================================================================
  const hasLoyaltyProviders = await knex.schema.hasTable('loyalty_providers');
  if (!hasLoyaltyProviders) {
    await knex.schema.createTable('loyalty_providers', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('slug').notNullable().unique();
      t.string('logo_url').nullable();
      t.string('card_color').nullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
    });
  }

  // ====================================================================
  // 7. CUSTOMER LOYALTY CARDS
  // ====================================================================
  const hasLoyaltyCards = await knex.schema.hasTable('customer_loyalty_cards');
  if (!hasLoyaltyCards) {
    await knex.schema.createTable('customer_loyalty_cards', (t) => {
      t.increments('id').primary();
      t.uuid('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
      t.integer('loyalty_provider_id').notNullable().references('id').inTable('loyalty_providers').onDelete('CASCADE');
      t.string('card_number_hash').notNullable();
      t.string('card_last_four').notNullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
      t.unique(['profile_id', 'loyalty_provider_id']);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_loyalty_cards_profile ON customer_loyalty_cards(profile_id)');
  }

  // ====================================================================
  // 8. COMBOS / BUNDLES
  // ====================================================================
  const hasCombos = await knex.schema.hasTable('combos');
  if (!hasCombos) {
    await knex.schema.createTable('combos', (t) => {
      t.increments('id').primary();
      t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
      t.string('name').notNullable();
      t.text('description').nullable();
      t.string('image_url').nullable();
      t.decimal('combo_price', 10, 2).notNullable();
      t.decimal('original_price', 10, 2).notNullable();
      t.integer('min_items').nullable();
      t.integer('max_items').nullable();
      t.boolean('is_customizable').notNullable().defaultTo(false);
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamp('starts_at').nullable();
      t.timestamp('expires_at').nullable();
      t.timestamps(true, true);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_combos_store ON combos(store_id)');
  }

  const hasComboItems = await knex.schema.hasTable('combo_items');
  if (!hasComboItems) {
    await knex.schema.createTable('combo_items', (t) => {
      t.increments('id').primary();
      t.integer('combo_id').notNullable().references('id').inTable('combos').onDelete('CASCADE');
      t.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      t.integer('quantity').notNullable().defaultTo(1);
      t.decimal('individual_price', 10, 2).notNullable();
      t.timestamps(true, true);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_id)');
  }

  // ====================================================================
  // 9. ADVERTISEMENTS
  // ====================================================================
  const hasAds = await knex.schema.hasTable('advertisements');
  if (!hasAds) {
    await knex.schema.createTable('advertisements', (t) => {
      t.increments('id').primary();
      t.uuid('store_id').nullable().references('id').inTable('stores').onDelete('CASCADE');
      t.string('title').notNullable();
      t.text('description').nullable();
      t.string('image_url').nullable();
      t.string('banner_url').nullable();
      t.string('destination_type').notNullable();
      t.string('destination_id').nullable();
      t.string('placement').notNullable();
      t.string('ad_type').notNullable().defaultTo('BANNER');
      t.timestamp('starts_at').notNullable();
      t.timestamp('expires_at').notNullable();
      t.decimal('budget', 10, 2).nullable();
      t.decimal('spent', 10, 2).notNullable().defaultTo(0);
      t.integer('impressions').notNullable().defaultTo(0);
      t.integer('clicks').notNullable().defaultTo(0);
      t.string('status').notNullable().defaultTo('ACTIVE');
      t.boolean('age_restricted_ad').notNullable().defaultTo(false);
      t.timestamps(true, true);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_ads_store ON advertisements(store_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_ads_placement ON advertisements(placement)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_ads_dates ON advertisements(starts_at, expires_at)');
  }

  // ====================================================================
  // 10. SHOPPING CART
  // ====================================================================
  const hasCarts = await knex.schema.hasTable('carts');
  if (!hasCarts) {
    await knex.schema.createTable('carts', (t) => {
      t.increments('id').primary();
      t.uuid('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
      t.timestamps(true, true);
      t.unique(['profile_id']);
    });
  }

  const hasCartItems = await knex.schema.hasTable('cart_items');
  if (!hasCartItems) {
    await knex.schema.createTable('cart_items', (t) => {
      t.increments('id').primary();
      t.integer('cart_id').notNullable().references('id').inTable('carts').onDelete('CASCADE');
      t.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
      t.integer('quantity').notNullable().defaultTo(1);
      t.decimal('requested_quantity', 8, 3).nullable();
      t.string('unit').nullable();
      t.text('special_instructions').nullable();
      t.integer('combo_id').nullable().references('id').inTable('combos').onDelete('SET NULL');
      t.decimal('unit_price_snapshot', 10, 2).notNullable();
      t.timestamps(true, true);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_cart_items_store ON cart_items(store_id)');
  }

  // ====================================================================
  // 11. DELIVERY ADDRESSES (customer saved addresses)
  // ====================================================================
  const hasDeliveryAddresses = await knex.schema.hasTable('delivery_addresses');
  if (!hasDeliveryAddresses) {
    await knex.schema.createTable('delivery_addresses', (t) => {
      t.increments('id').primary();
      t.uuid('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
      t.string('label').notNullable().defaultTo('Home');
      t.string('address_line_1').notNullable();
      t.string('address_line_2').nullable();
      t.string('city').nullable();
      t.string('region').nullable();
      t.string('postal_code').nullable();
      t.decimal('latitude', 10, 7).nullable();
      t.decimal('longitude', 10, 7).nullable();
      t.boolean('is_default').notNullable().defaultTo(false);
      t.timestamps(true, true);
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_delivery_addresses_profile ON delivery_addresses(profile_id)');
  }

  // ====================================================================
  // 12. STORE FAVORITES (customer preferred stores)
  // ====================================================================
  const hasStoreFavorites = await knex.schema.hasTable('store_favorites');
  if (!hasStoreFavorites) {
    await knex.schema.createTable('store_favorites', (t) => {
      t.increments('id').primary();
      t.uuid('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
      t.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE');
      t.timestamps(true, true);
      t.unique(['profile_id', 'store_id']);
    });
  }

  // ====================================================================
  // 13. SEED DEFAULT LOYALTY PROVIDERS
  // ====================================================================
  const providerCount = await knex('loyalty_providers').count('id as count').first();
  if (providerCount && parseInt(providerCount.count, 10) === 0) {
    await knex('loyalty_providers').insert([
      { name: 'SPAR Rewards', slug: 'spar-rewards', card_color: '#e11d48' },
      { name: 'OK Value Club', slug: 'ok-value-club', card_color: '#2563eb' },
      { name: 'Pick n Pay Smart Shopper', slug: 'pick-n-pay', card_color: '#dc2626' },
      { name: 'Shoprite Xtra Savings', slug: 'shoprite', card_color: '#ea580c' },
      { name: 'Boxer Rewards', slug: 'boxer-rewards', card_color: '#16a34a' },
    ]);
  }
}

/** @param { import("knex").Knex } knex */
export async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS store_favorites CASCADE');
  await knex.raw('DROP TABLE IF EXISTS delivery_addresses CASCADE');
  await knex.raw('DROP TABLE IF EXISTS cart_items CASCADE');
  await knex.raw('DROP TABLE IF EXISTS carts CASCADE');
  await knex.raw('DROP TABLE IF EXISTS advertisements CASCADE');
  await knex.raw('DROP TABLE IF EXISTS combo_items CASCADE');
  await knex.raw('DROP TABLE IF EXISTS combos CASCADE');
  await knex.raw('DROP TABLE IF EXISTS customer_loyalty_cards CASCADE');
  await knex.raw('DROP TABLE IF EXISTS loyalty_providers CASCADE');
  await knex.raw('DROP TABLE IF EXISTS promotions CASCADE');
  await knex.raw('DROP TABLE IF EXISTS product_images CASCADE');
}
