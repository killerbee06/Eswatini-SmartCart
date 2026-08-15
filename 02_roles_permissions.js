/**
 * Seed roles, permissions, and role_permissions for RBAC.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // Clear existing
  await knex('role_permissions').del();
  await knex('permissions').del();
  await knex('roles').del();

  // Insert roles
  const roles = [
    { name: 'CUSTOMER', description: 'End customer who places orders' },
    { name: 'MERCHANT_OWNER', description: 'Owner of a merchant store' },
    { name: 'MERCHANT_STAFF', description: 'Staff member at a merchant store' },
    { name: 'DRIVER', description: 'Delivery driver' },
    { name: 'DISPATCHER', description: 'Order dispatcher' },
    { name: 'SUPPORT', description: 'Customer support agent' },
    { name: 'FINANCE', description: 'Finance team member' },
    { name: 'ADMIN', description: 'Platform administrator' },
    { name: 'SUPER_ADMIN', description: 'Super administrator with full access' },
  ];
  await knex('roles').insert(roles);

  // Insert permissions
  const permissions = [
    // Customer
    { name: 'customer.profile.read', description: 'Read own profile' },
    { name: 'customer.profile.write', description: 'Update own profile' },
    { name: 'customer.orders.read', description: 'View own orders' },
    { name: 'customer.orders.place', description: 'Place new orders' },
    { name: 'customer.cart.manage', description: 'Manage shopping cart' },

    // Merchant
    { name: 'merchant.products.read', description: 'View store products' },
    { name: 'merchant.products.write', description: 'Create/update/delete store products' },
    { name: 'merchant.orders.read', description: 'View store orders' },
    { name: 'merchant.orders.update', description: 'Update store order status' },
    { name: 'merchant.store.read', description: 'View store details' },
    { name: 'merchant.store.update', description: 'Update store details' },
    { name: 'merchant.payouts.read', description: 'View store payouts' },
    { name: 'merchant.staff.manage', description: 'Manage store staff' },

    // Driver
    { name: 'driver.orders.read', description: 'View available deliveries' },
    { name: 'driver.delivery.accept', description: 'Accept delivery assignment' },
    { name: 'driver.location.update', description: 'Update delivery location' },
    { name: 'driver.delivery.complete', description: 'Mark delivery as complete' },
    { name: 'driver.delivery.assign', description: 'Accept delivery assignment' },
    { name: 'driver.otp.generate', description: 'Generate delivery OTP' },

    // Customer Delivery
    { name: 'customer.delivery.track', description: 'Track delivery in real-time' },
    { name: 'customer.otp.verify', description: 'Verify delivery OTP' },

    // Dispatcher
    { name: 'dispatcher.delivery.assign', description: 'Assign drivers to deliveries' },
    { name: 'dispatcher.delivery.view', description: 'View all pending deliveries' },

    // Finance
    { name: 'finance.payouts.read', description: 'View all payouts' },
    { name: 'finance.payouts.approve', description: 'Approve merchant payouts' },
    { name: 'finance.ledger.read', description: 'View ledger entries' },

    // Support
    { name: 'support.orders.read', description: 'View any order' },
    { name: 'support.orders.override', description: 'Override order status' },
    { name: 'support.users.read', description: 'View user details' },

    // Admin
    { name: 'admin.users.manage', description: 'Manage user accounts' },
    { name: 'admin.merchants.approve', description: 'Approve merchant applications' },
    { name: 'admin.orders.override', description: 'Override any order' },
    { name: 'admin.payments.read', description: 'View all payments' },
    { name: 'admin.reports.read', description: 'View platform reports' },
    { name: 'admin.settings.update', description: 'Update platform settings' },
    { name: 'admin.audit.read', description: 'View audit logs' },

    // Super Admin
    { name: 'super_admin.full_access', description: 'Full platform access' },
  ];
  await knex('permissions').insert(permissions);

  // Assign permissions to roles
  const rolePermissions = [
    // CUSTOMER
    ...['customer.profile.read', 'customer.profile.write', 'customer.orders.read',
        'customer.orders.place', 'customer.cart.manage']
      .map((p) => ({ role_name: 'CUSTOMER', permission_name: p })),

    // MERCHANT_OWNER — all merchant permissions + staff management
    ...['merchant.products.read', 'merchant.products.write', 'merchant.orders.read',
        'merchant.orders.update', 'merchant.store.read', 'merchant.store.update',
        'merchant.payouts.read', 'merchant.staff.manage']
      .map((p) => ({ role_name: 'MERCHANT_OWNER', permission_name: p })),

    // MERCHANT_STAFF — read products, read/update orders
    ...['merchant.products.read', 'merchant.products.write', 'merchant.orders.read',
        'merchant.orders.update', 'merchant.store.read']
      .map((p) => ({ role_name: 'MERCHANT_STAFF', permission_name: p })),

    // DRIVER
    ...['driver.orders.read', 'driver.delivery.accept', 'driver.location.update',
        'driver.delivery.complete', 'driver.delivery.assign', 'driver.otp.generate']
      .map((p) => ({ role_name: 'DRIVER', permission_name: p })),

    // CUSTOMER — add delivery permissions
    ...['customer.profile.read', 'customer.profile.write', 'customer.orders.read',
        'customer.orders.place', 'customer.cart.manage',
        'customer.delivery.track', 'customer.otp.verify']
      .filter((p) => !['customer.profile.read', 'customer.profile.write',
        'customer.orders.read', 'customer.orders.place', 'customer.cart.manage']
        .includes(p)) // Only add new ones
      .map((p) => ({ role_name: 'CUSTOMER', permission_name: p })),

    // DISPATCHER
    ...['dispatcher.delivery.assign', 'dispatcher.delivery.view']
      .map((p) => ({ role_name: 'DISPATCHER', permission_name: p })),

    // FINANCE
    ...['finance.payouts.read', 'finance.payouts.approve', 'finance.ledger.read']
      .map((p) => ({ role_name: 'FINANCE', permission_name: p })),

    // SUPPORT
    ...['support.orders.read', 'support.orders.override', 'support.users.read']
      .map((p) => ({ role_name: 'SUPPORT', permission_name: p })),

    // ADMIN — all admin permissions
    ...['admin.users.manage', 'admin.merchants.approve', 'admin.orders.override',
        'admin.payments.read', 'admin.reports.read', 'admin.settings.update',
        'admin.audit.read']
      .map((p) => ({ role_name: 'ADMIN', permission_name: p })),

    // SUPER_ADMIN — gets everything
    ...permissions.map((p) => ({ role_name: 'SUPER_ADMIN', permission_name: p.name })),
  ];

  await knex('role_permissions').insert(rolePermissions);
}
