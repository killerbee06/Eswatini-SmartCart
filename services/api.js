/**
 * API Service — all HTTP calls to the SmartCart backend.
 * Uses VITE_API_URL env var (defaults to /api/v1 for Vite proxy).
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if available
  const stored = localStorage.getItem('smartcart_session');
  if (stored) {
    try {
      const session = JSON.parse(stored);
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data;
}

// ── Generic request helper ──────────────────────────────
export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// ── Auth ────────────────────────────────────────────────
export const authAPI = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
};

// ── Products ────────────────────────────────────────────
export const productsAPI = {
  list: (params = '') => request(`/products${params ? '?' + params : ''}`),
  get: (id) => request(`/products/${id}`),
  create: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  merchantList: () => request('/products/merchant'),
};

// ── Categories ──────────────────────────────────────────
export const categoriesAPI = {
  list: () => request('/categories'),
  get: (id) => request(`/categories/${id}`),
  create: (body) => request('/categories', { method: 'POST', body: JSON.stringify(body) }),
};

// ── Cart (server-side) ──────────────────────────────────
export const cartAPI = {
  get: () => request('/cart'),
  count: () => request('/cart/count'),
  addItem: (body) => request('/cart/items', { method: 'POST', body: JSON.stringify(body) }),
  updateItem: (id, body) => request(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeItem: (id) => request(`/cart/items/${id}`, { method: 'DELETE' }),
  clear: () => request('/cart', { method: 'DELETE' }),
};

// ── Orders ──────────────────────────────────────────────
export const ordersAPI = {
  checkout: (body) => request('/orders/checkout', { method: 'POST', body: JSON.stringify(body) }),
  myOrders: (params = '') => request(`/orders/my-orders${params ? '?' + params : ''}`),
  get: (id) => request(`/orders/${id}`),
  events: (id) => request(`/orders/${id}/events`),
  merchantOrders: (storeId) => request(`/orders/merchant/${storeId}`),
  updateStatus: (id, body) => request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// ── Payments ────────────────────────────────────────────
export const paymentsAPI = {
  create: (body) => request('/payments', { method: 'POST', body: JSON.stringify(body) }),
  list: (params = '') => request(`/payments${params ? '?' + params : ''}`),
  get: (id) => request(`/payments/${id}`),
  refund: (id, body) => request(`/payments/${id}/refund`, { method: 'POST', body: JSON.stringify(body) }),
};

// ── Deliveries ──────────────────────────────────────────
export const deliveriesAPI = {
  pending: () => request('/deliveries/pending'),
  assign: (id, body) => request(`/deliveries/${id}/assign`, { method: 'POST', body: JSON.stringify(body) }),
  updateStatus: (id, body) => request(`/deliveries/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
  generateOTP: (id) => request(`/deliveries/${id}/otp/generate`, { method: 'POST' }),
  verifyOTP: (id, body) => request(`/deliveries/${id}/otp/verify`, { method: 'POST', body: JSON.stringify(body) }),
  myDeliveries: () => request('/deliveries/my-deliveries'),
  tracking: (id) => request(`/deliveries/${id}/tracking`),
  byOrder: (orderId) => request(`/deliveries/order/${orderId}`),
};

// ── Delivery Addresses ──────────────────────────────────
export const addressesAPI = {
  list: () => request('/addresses'),
  add: (body) => request('/addresses', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id) => request(`/addresses/${id}`, { method: 'DELETE' }),
};

// ── Store Favorites ─────────────────────────────────────
export const storeFavoritesAPI = {
  list: () => request('/store-favorites'),
  add: (storeId) => request('/store-favorites', { method: 'POST', body: JSON.stringify({ store_id: storeId }) }),
  remove: (storeId) => request(`/store-favorites/${storeId}`, { method: 'DELETE' }),
};

// ── Combos ──────────────────────────────────────────────
export const combosAPI = {
  list: (params = '') => request(`/combos${params ? '?' + params : ''}`),
  get: (id) => request(`/combos/${id}`),
  create: (body) => request('/combos', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/combos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// ── Advertisements ──────────────────────────────────────
export const adsAPI = {
  list: (params = '') => request(`/advertisements${params ? '?' + params : ''}`),
  get: (id) => request(`/advertisements/${id}`),
  trackClick: (id) => request(`/advertisements/${id}/click`, { method: 'POST' }),
  create: (body) => request('/advertisements', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/advertisements/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// ── Loyalty ─────────────────────────────────────────────
export const loyaltyAPI = {
  providers: () => request('/loyalty/providers'),
  myCards: () => request('/loyalty/cards'),
  addCard: (body) => request('/loyalty/cards', { method: 'POST', body: JSON.stringify(body) }),
  removeCard: (id) => request(`/loyalty/cards/${id}`, { method: 'DELETE' }),
};

// ── Promotions ──────────────────────────────────────────
export const promotionsAPI = {
  list: (params = '') => request(`/promotions${params ? '?' + params : ''}`),
  evaluate: (body) => request('/promotions/evaluate', { method: 'POST', body: JSON.stringify(body) }),
};

// ── Payouts ─────────────────────────────────────────────
export const payoutsAPI = {
  balance: (storeId) => request(`/payouts/balance/${storeId}`),
  myPayouts: (params = '') => request(`/payouts/my-payouts${params ? '?' + params : ''}`),
  list: (params = '') => request(`/payouts${params ? '?' + params : ''}`),
  generate: () => request('/payouts/generate', { method: 'POST' }),
  approve: (id, body) => request(`/payouts/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  reject: (id, body) => request(`/payouts/${id}/reject`, { method: 'POST', body: JSON.stringify(body) }),
  process: (id) => request(`/payouts/${id}/process`, { method: 'POST' }),
  stats: () => request('/payouts/stats'),
};

// ── Notifications ───────────────────────────────────────
export const notificationsAPI = {
  list: (params = '') => request(`/notifications${params ? '?' + params : ''}`),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};

// ── Admin ───────────────────────────────────────────────
export const adminAPI = {
  overview: () => request('/admin/reports/overview'),
  dailyRevenue: (params = '') => request(`/admin/reports/revenue/daily${params ? '?' + params : ''}`),
  monthlyRevenue: (params = '') => request(`/admin/reports/revenue/monthly${params ? '?' + params : ''}`),
  topMerchants: (params = '') => request(`/admin/reports/merchants/top${params ? '?' + params : ''}`),
  paymentBreakdown: () => request('/admin/reports/payments/breakdown'),
  ledgerSummary: () => request('/admin/reports/ledger/summary'),
  ledgerEntries: (params = '') => request(`/admin/reports/ledger/entries${params ? '?' + params : ''}`),
  refundStats: () => request('/admin/reports/refunds'),
  deliveryStats: () => request('/admin/reports/deliveries'),
  auditLogs: (params = '') => request(`/admin/reports/audit${params ? '?' + params : ''}`),
  settings: () => request('/admin/settings'),
  updateSetting: (key, body) => request(`/admin/settings/${key}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// ── Users ───────────────────────────────────────────────
export const usersAPI = {
  me: () => request('/users/me'),
  updateMe: (body) => request('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  list: (params = '') => request(`/users${params ? '?' + params : ''}`),
  get: (id) => request(`/users/${id}`),
  update: (id, body) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  storeStaff: (storeId) => request(`/users/stores/${storeId}/staff`),
  addStaff: (storeId, body) => request(`/users/stores/${storeId}/staff`, { method: 'POST', body: JSON.stringify(body) }),
  removeStaff: (storeId, staffId) => request(`/users/stores/${storeId}/staff/${staffId}`, { method: 'DELETE' }),
};

// ── Stores ──────────────────────────────────────────────
export const storesAPI = {
  list: () => request('/stores'),
  get: (id) => request(`/stores/${id}`),
};

// ── Search (storefront) ─────────────────────────────────
export const searchAPI = {
  search: (params = '') => request(`/search${params ? '?' + params : ''}`),
  storefront: (storeId) => request(`/storefront/${storeId}`),
  featuredStores: (limit = 6) => request(`/featured-stores?limit=${limit}`),
};
