import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

const TIMELINE_STEPS = [
  { status: 'PENDING_PAYMENT', label: 'Order Placed', icon: '📋' },
  { status: 'PAID', label: 'Payment Confirmed', icon: '💳' },
  { status: 'MERCHANT_ACCEPTED', label: 'Merchant Accepted', icon: '✅' },
  { status: 'PREPARING', label: 'Being Prepared', icon: '📦' },
  { status: 'READY_FOR_PICKUP', label: 'Ready for Pickup', icon: '🔔' },
  { status: 'DRIVER_ASSIGNED', label: 'Driver Assigned', icon: '🚗' },
  { status: 'PICKED_UP', label: 'Picked Up', icon: '📋' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: '🛣️' },
  { status: 'DELIVERED', label: 'Delivered', icon: '🎉' },
];

const STATUS_COLORS = {
  PENDING_PAYMENT: '#f59e0b',
  PAID: '#3b82f6',
  MERCHANT_ACCEPTED: '#6366f1',
  PREPARING: '#8b5cf6',
  READY_FOR_PICKUP: '#06b6d4',
  DRIVER_ASSIGNED: '#6366f1',
  PICKED_UP: '#3b82f6',
  OUT_FOR_DELIVERY: '#8b5cf6',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  PAYMENT_FAILED: '#ef4444',
  REFUNDED: '#6b7280',
};

export default function Tracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/orders/${id}`),
      api.get(`/orders/${id}/events`).catch(() => ({ data: [] })),
    ]).then(([orderRes, eventsRes]) => {
      setOrder(orderRes.data?.data || orderRes.data);
      setEvents(eventsRes.data?.data || eventsRes.data || []);
    }).catch(() => {
      setError('Failed to load order details');
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-container"><div className="loading">Loading tracking...</div></div>;
  if (error) return <div className="page-container"><div className="alert alert-error">{error}</div><Link to="/orders" className="btn btn-secondary">Back to Orders</Link></div>;
  if (!order) return <div className="page-container"><div className="empty-state"><div className="empty-icon">📦</div><h3>Order not found</h3><Link to="/orders" className="btn btn-primary">Back to Orders</Link></div></div>;

  const currentStep = TIMELINE_STEPS.findIndex(s => s.status === order.status);
  const isCancelled = ['CANCELLED', 'FAILED', 'REFUNDED'].includes(order.status);
  const isTerminal = ['DELIVERED', 'CANCELLED', 'FAILED', 'REFUNDED'].includes(order.status);

  // Group items by store
  const items = order.items || [];
  const subOrders = order.sub_orders || [];
  const storeGroups = {};
  for (const item of items) {
    const storeId = item.store_id;
    if (!storeGroups[storeId]) storeGroups[storeId] = { store_id: storeId, items: [] };
    storeGroups[storeId].items.push(item);
  }
  // Enrich with sub-order data
  for (const sub of subOrders) {
    if (storeGroups[sub.store_id]) {
      storeGroups[sub.store_id].subtotal = sub.subtotal;
      storeGroups[sub.store_id].status = sub.status;
      storeGroups[sub.store_id].payout = sub.store_payout;
    }
  }

  return (
    <div className="page-container">
      <nav className="breadcrumb">
        <Link to="/orders">My Orders</Link>
        <span>/</span>
        <span>#{order.main_ref}</span>
      </nav>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Order #{order.main_ref}</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span
          style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'white',
            background: STATUS_COLORS[order.status] || '#6b7280',
          }}
        >
          {order.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Timeline */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 16 }}>Order Progress</h3>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
          {TIMELINE_STEPS.map((step, index) => {
            const isCompleted = index <= currentStep && !isCancelled;
            const isCurrent = index === currentStep && !isCancelled;
            return (
              <div key={step.status} style={{ flex: 1, minWidth: 100, textAlign: 'center', position: 'relative' }}>
                {/* Connector line */}
                {index > 0 && (
                  <div style={{
                    position: 'absolute', top: 18, right: '50%', width: '100%', height: 2,
                    background: (index <= currentStep && !isCancelled) ? '#2563eb' : '#e5e7eb',
                    zIndex: 0,
                  }} />
                )}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isCompleted ? '#2563eb' : '#e5e7eb',
                  color: isCompleted ? 'white' : '#9ca3af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 8px', fontSize: 16, position: 'relative', zIndex: 1,
                  border: isCurrent ? '3px solid #93c5fd' : 'none',
                }}>
                  {isCompleted ? '✓' : step.icon}
                </div>
                <div style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? '#2563eb' : '#6b7280' }}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
        {isCancelled && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            Order has been {order.status.toLowerCase()}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Order items by store */}
        <div>
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Items</h3>
          {Object.values(storeGroups).map(group => (
            <div key={group.store_id} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 12 }}>
              <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600 }}>
                Store #{group.store_id}
                {group.status && (
                  <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#dbeafe', color: '#1e40af' }}>
                    {group.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              {group.items.map((item, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: i < group.items.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{item.product_name || `Product #${item.product_id}`}</span>
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>× {item.quantity}</span>
                  </div>
                  <span style={{ fontWeight: 500 }}>E{Number(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {group.subtotal && (
                <div style={{ padding: '10px 16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span>Store Subtotal</span>
                  <span>E{Number(group.subtotal).toFixed(2)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right column: summary + address */}
        <div>
          {/* Delivery */}
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Delivery</h3>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              <div style={{ color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Address</div>
              <div style={{ marginBottom: 12 }}>{order.delivery_address || '—'}</div>
              {order.delivery_notes && (
                <>
                  <div style={{ color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Notes</div>
                  <div>{order.delivery_notes}</div>
                </>
              )}
            </div>
          </div>

          {/* Payment summary */}
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Payment Summary</h3>
            <div style={{ fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#6b7280' }}>Subtotal</span>
                <span>E{Number(order.items_subtotal).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#6b7280' }}>Delivery Fee</span>
                <span>E{Number(order.delivery_fee).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #e5e7eb', marginTop: 6, fontWeight: 700, fontSize: 18 }}>
                <span>Total</span>
                <span>E{Number(order.grand_total).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6', marginTop: 6 }}>
                <span style={{ color: '#6b7280' }}>Payment Method</span>
                <span>{order.payment_method?.replace(/_/g, ' ') || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status events */}
      {events.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Status History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((event, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '8px 0', borderBottom: i < events.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ color: '#9ca3af', minWidth: 140, fontSize: 12 }}>{new Date(event.created_at).toLocaleString()}</div>
                <div style={{ fontWeight: 500 }}>
                  {event.from_status ? `${event.from_status.replace(/_/g, ' ')} → ` : ''}{event.to_status.replace(/_/g, ' ')}
                </div>
                {event.notes && <div style={{ color: '#6b7280' }}>— {event.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link to="/orders" className="btn btn-secondary">← Back to Orders</Link>
      </div>
    </div>
  );
}
