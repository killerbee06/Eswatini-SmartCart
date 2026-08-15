import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const STATUS_COLORS = {
  PENDING_PAYMENT: '#f59e0b',
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6',
  READY_FOR_PICKUP: '#06b6d4',
  ASSIGNED_TO_DRIVER: '#6366f1',
  OUT_FOR_DELIVERY: '#8b5cf6',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  FAILED: '#ef4444',
  REFUNDED: '#6b7280',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get(`/orders/my-orders?page=${page}&limit=10`)
      .then(res => {
        const data = res.data?.data || res.data;
        setOrders(Array.isArray(data) ? data : []);
        setTotal(res.data?.total || 0);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 10);

  if (loading) {
    return (
      <div className="page-container">
        <h1>My Orders</h1>
        <div className="loading">Loading orders...</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="page-container">
        <h1>My Orders</h1>
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Start shopping to see your orders here</p>
          <Link to="/" className="btn btn-primary">Browse Products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>My Orders</h1>

      <div className="orders-list">
        {orders.map(order => (
          <Link key={order.id} to={`/orders/${order.id}/tracking`} className="order-card">
            <div className="order-card-header">
              <span className="order-ref">#{order.main_ref}</span>
              <span
                className="status-badge"
                style={{ background: STATUS_COLORS[order.status] || '#6b7280' }}
              >
                {order.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="order-card-body">
              <div className="order-detail">
                <span className="label">Items:</span>
                <span>{order.items_count || '—'}</span>
              </div>
              <div className="order-detail">
                <span className="label">Total:</span>
                <span className="price">E{Number(order.grand_total).toFixed(2)}</span>
              </div>
              <div className="order-detail">
                <span className="label">Date:</span>
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="order-card-footer">
              <span className="track-link">Track Order →</span>
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
