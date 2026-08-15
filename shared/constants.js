// ============================================================
// ROLES
// ============================================================
export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  MERCHANT_OWNER: 'MERCHANT_OWNER',
  MERCHANT_STAFF: 'MERCHANT_STAFF',
  DRIVER: 'DRIVER',
  DISPATCHER: 'DISPATCHER',
  SUPPORT: 'SUPPORT',
  FINANCE: 'FINANCE',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
};

// ============================================================
// ORDER STATES (enforced state machine)
// ============================================================
export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  MERCHANT_ACCEPTED: 'MERCHANT_ACCEPTED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
};

// Valid order state transitions
export const ORDER_TRANSITIONS = {
  PENDING_PAYMENT: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAID: ['MERCHANT_ACCEPTED', 'CANCELLED'],
  MERCHANT_ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['DRIVER_ASSIGNED'],
  DRIVER_ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  PAYMENT_FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

// ============================================================
// PAYMENT STATES
// ============================================================
export const PAYMENT_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
};

export const PAYMENT_PROVIDERS = {
  MTN_MOMO: 'MTN_MOMO',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  MOCK: 'MOCK',
};

// ============================================================
// DELIVERY STATES
// ============================================================
export const DELIVERY_STATUS = {
  PENDING_ASSIGNMENT: 'PENDING_ASSIGNMENT',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE_TO_PICKUP: 'EN_ROUTE_TO_PICKUP',
  AT_PICKUP: 'AT_PICKUP',
  PICKED_UP: 'PICKED_UP',
  EN_ROUTE_TO_CUSTOMER: 'EN_ROUTE_TO_CUSTOMER',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
};

// ============================================================
// PERMISSIONS (explicit, granular)
// ============================================================
export const PERMISSIONS = {
  // Customer
  CUSTOMER_PROFILE_READ: 'customer.profile.read',
  CUSTOMER_PROFILE_WRITE: 'customer.profile.write',
  CUSTOMER_ORDERS_READ: 'customer.orders.read',
  CUSTOMER_ORDERS_PLACE: 'customer.orders.place',
  CUSTOMER_CART_MANAGE: 'customer.cart.manage',

  // Merchant
  MERCHANT_PRODUCTS_READ: 'merchant.products.read',
  MERCHANT_PRODUCTS_WRITE: 'merchant.products.write',
  MERCHANT_ORDERS_READ: 'merchant.orders.read',
  MERCHANT_ORDERS_UPDATE: 'merchant.orders.update',
  MERCHANT_STORE_READ: 'merchant.store.read',
  MERCHANT_STORE_UPDATE: 'merchant.store.update',
  MERCHANT_PAYOUTS_READ: 'merchant.payouts.read',
  MERCHANT_STAFF_MANAGE: 'merchant.staff.manage',

  // Driver
  DRIVER_ORDERS_READ: 'driver.orders.read',
  DRIVER_DELIVERY_ACCEPT: 'driver.delivery.accept',
  DRIVER_LOCATION_UPDATE: 'driver.location.update',
  DRIVER_DELIVERY_COMPLETE: 'driver.delivery.complete',
  DRIVER_DELIVERY_ASSIGN: 'driver.delivery.assign',
  DRIVER_OTP_GENERATE: 'driver.otp.generate',

  // Customer Delivery
  CUSTOMER_DELIVERY_TRACK: 'customer.delivery.track',
  CUSTOMER_OTP_VERIFY: 'customer.otp.verify',

  // Dispatcher
  DISPATCHER_DELIVERY_ASSIGN: 'dispatcher.delivery.assign',
  DISPATCHER_DELIVERY_VIEW: 'dispatcher.delivery.view',

  // Finance
  FINANCE_PAYOUTS_READ: 'finance.payouts.read',
  FINANCE_PAYOUTS_APPROVE: 'finance.payouts.approve',
  FINANCE_LEDGER_READ: 'finance.ledger.read',

  // Support
  SUPPORT_ORDERS_READ: 'support.orders.read',
  SUPPORT_ORDERS_OVERRIDE: 'support.orders.override',
  SUPPORT_USERS_READ: 'support.users.read',

  // Admin
  ADMIN_USERS_MANAGE: 'admin.users.manage',
  ADMIN_MERCHANTS_APPROVE: 'admin.merchants.approve',
  ADMIN_ORDERS_OVERRIDE: 'admin.orders.override',
  ADMIN_PAYMENTS_READ: 'admin.payments.read',
  ADMIN_REPORTS_READ: 'admin.reports.read',
  ADMIN_SETTINGS_UPDATE: 'admin.settings.update',
  ADMIN_AUDIT_READ: 'admin.audit.read',

  // Super Admin
  SUPER_ADMIN_FULL_ACCESS: 'super_admin.full_access',
};

// ============================================================
// PAYOUT STATES
// ============================================================
export const PAYOUT_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
};

// ============================================================
// FINANCIAL
// ============================================================
export const LEDGER_ACCOUNTS = {
  CUSTOMER_PAYABLE: 'customer_payable',
  PLATFORM_REVENUE: 'platform_revenue',
  MERCHANT_PAYABLE: 'merchant_payable',
  DELIVERY_REVENUE: 'delivery_revenue',
  REFUND_PAYABLE: 'refund_payable',
};
