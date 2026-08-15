/**
 * Seed initial stores and demo products.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // Clear products first (FK dependency), then stores
  await knex('products').del();
  await knex('stores').del();

  // Insert stores
  const stores = [
    { id: '550e8400-e29b-41d4-a716-446655440001', name: 'SPAR Supermarket', description: 'Full-service supermarket', location: 'Mbabane Central' },
    { id: '550e8400-e29b-41d4-a716-446655440002', name: 'OK Foods', description: 'Groceries and essentials', location: 'Ezulwini' },
    { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Pick n Pay', description: 'Supermarket chain', location: 'Manzini Hub' },
    { id: '550e8400-e29b-41d4-a716-446655440004', name: 'Shoprite', description: 'Affordable groceries', location: 'Matsapha' },
  ];

  await knex('stores').insert(stores);

  // Insert products
  const products = [
    // SPAR
    { store_id: stores[0].id, name: 'Fresh Veggie Pack', description: 'Seasonal vegetable assortment', category_id: null, price: 45.00, discount_price: 29.99, stock_quantity: 30, image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80' },
    { store_id: stores[0].id, name: 'Braai Meat Combo Pack', description: 'Assorted meats for braai', category_id: null, price: 180.00, discount_price: 149.99, stock_quantity: 15, image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80' },
    { store_id: stores[0].id, name: '2L Sunfoil Cooking Oil', description: 'Pure sunflower oil', category_id: null, price: 65.00, discount_price: null, stock_quantity: 50, image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300' },

    // OK Foods
    { store_id: stores[1].id, name: '2L Coca-Cola Original', description: 'Classic Coca-Cola', category_id: null, price: 26.00, discount_price: 19.99, stock_quantity: 100, image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80' },
    { store_id: stores[1].id, name: 'Fresh White Bread & Milk Combo', description: 'Bread and 1L milk', category_id: null, price: 38.00, discount_price: null, stock_quantity: 40, image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300' },

    // Pick n Pay
    { store_id: stores[2].id, name: 'Fresh Whole Chicken', description: 'Whole fresh chicken', category_id: null, price: 75.00, discount_price: 59.99, stock_quantity: 25, image_url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=400&q=80' },
    { store_id: stores[2].id, name: 'Family Combo Deal', description: 'Oil + Rice + Sugar', category_id: null, price: 240.00, discount_price: null, stock_quantity: 10, image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300' },

    // Shoprite
    { store_id: stores[3].id, name: '10kg Ligugu Mealie Meal', description: 'Super maize meal', category_id: null, price: 110.00, discount_price: null, stock_quantity: 80, image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300' },
    { store_id: stores[3].id, name: 'Ritebrand White Rice 5kg', description: 'Long grain white rice', category_id: null, price: 89.99, discount_price: 69.99, stock_quantity: 60, image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80' },
  ];

  await knex('products').insert(products);
}
