import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cartAPI, addressesAPI, promotionsAPI, api } from '../services/api';

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('MTN_MOMO');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      const res = await cartAPI.get();
      setCart(res.data);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadCart();
      addressesAPI.list()
        .then(res => setAddresses(res.data || []))
        .catch(() => setAddresses([]));
    }
  }, [user, loadCart]);

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return removeItem(itemId);
    try {
      await cartAPI.updateItem(itemId, { quantity: newQuantity });
      await loadCart();
      setPromoResult(null); // Clear promo when cart changes
    } catch (err) {
      setError(err.message);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await cartAPI.removeItem(itemId);
      await loadCart();
      setPromoResult(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const clearCart = async () => {
    try {
      await cartAPI.clear();
      await loadCart();
      setPromoResult(null);
      setPromoCode('');
    } catch (err) {
      setError(err.message);
    }
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim() || !cart) return;
    setPromoLoading(true);
    setError('');
    try {
      const items = [];
      for (const store of cart.stores) {
        for (const item of store.items) {
          items.push({
            product_id: item.product_id,
            store_id: item.store_id,
            category_id: item.category_id || null,
            quantity: item.requested_quantity || item.quantity,
            effective_price: item.effective_price,
          });
        }
      }
      const res = await promotionsAPI.evaluate({ items, promo_code: promoCode.trim() });
      setPromoResult(res.data);
    } catch (err) {
      setPromoResult(null);
      setError(err.message);
    } finally {
      setPromoLoading(false);
    }
  };

  const selectAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setDeliveryAddress(`${addr.address_line_1}${addr.address_line_2 ? ', ' + addr.address_line_2 : ''}${addr.city ? ', ' + addr.city : ''}${addr.region ? ', ' + addr.region : ''}`);
  };

  const handleCheckout = async () => {
    if (!user) { navigate('/login'); return; }
    if (!cart || cart.stores.length === 0) return;
    if (!deliveryAddress.trim()) {
      setError('Please enter a delivery address');
      return;
    }

    setChecking(true);
    setError('');

    try {
      const items = [];
      for (const store of cart.stores) {
        for (const item of store.items) {
          items.push({
            id: item.product_id,
            quantity: item.requested_quantity ? 1 : item.quantity,
          });
        }
      }

      const checkoutPayload = {
        items,
        delivery_address: deliveryAddress,
        delivery_notes: deliveryNotes || undefined,
        payment_method: paymentMethod,
      };
      if (promoCode.trim()) {
        checkoutPayload.promo_code = promoCode.trim();
      }

      const res = await api.post('/orders/checkout', checkoutPayload);
      const data = res.data?.data || res.data;
      await loadCart();
      navigate(`/orders/${data.id || data.orderId}/tracking`);
    } catch (err) {
      setError(err.message || 'Checkout failed. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>Shopping Cart</h1>
        <div className="loading">Loading cart...</div>
      </div>
    );
  }

  if (!cart || cart.stores.length === 0) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add some products to get started</p>
          <Link to="/" className="btn btn-primary">Browse Products</Link>
        </div>
      </div>
    );
  }

  const deliveryFee = 15;
  const totalDiscount = promoResult?.total_discount || 0;
  const discountedSubtotal = Math.max(0, Number(cart.summary.subtotal) - totalDiscount);
  const total = Number(discountedSubtotal) + deliveryFee;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Shopping Cart</h1>
        <button className="btn btn-outline btn-sm" onClick={clearCart}>Clear Cart</button>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {cart.stores.map(store => (
            <div key={store.store_id} className="cart-store-group">
              <div className="cart-store-header">
                {store.store_logo ? (
                  <img src={store.store_logo} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                ) : (
                  <span className="store-badge">🏪</span>
                )}
                <strong>{store.store_name}</strong>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280' }}>
                  Subtotal: E{Number(store.subtotal).toFixed(2)}
                </span>
              </div>
              {store.items.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-img">
                    {(item.primary_image || item.image_url) ? (
                      <img src={item.primary_image || item.image_url} alt={item.product_name} />
                    ) : (
                      <div className="product-placeholder small">📦</div>
                    )}
                    {item.age_restricted && (
                      <span className="badge badge-red" style={{ position: 'absolute', top: 4, left: 4, fontSize: 10 }}>18+</span>
                    )}
                  </div>
                  <div className="cart-item-info">
                    <Link to={`/products/${item.product_id}`} className="cart-item-name">{item.product_name}</Link>
                    <div className="cart-item-price">
                      E{Number(item.effective_price).toFixed(2)}
                      {item.measurement_unit ? ` / ${item.measurement_unit}` : ' each'}
                    </div>
                  </div>
                  <div className="cart-item-qty">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>−</button>
                    <span>{item.requested_quantity || item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <div className="cart-item-subtotal">E{Number(item.line_total).toFixed(2)}</div>
                  <button className="cart-item-remove" onClick={() => removeItem(item.id)}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h3>Order Summary</h3>
          <div className="summary-row">
            <span>Items ({cart.summary.items_count})</span>
            <span>E{Number(cart.summary.subtotal).toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Stores</span>
            <span>{cart.summary.stores_count}</span>
          </div>

          {/* Promo code discount */}
          {totalDiscount > 0 && (
            <div className="summary-row" style={{ color: '#16a34a' }}>
              <span>Promo Discount ({promoResult?.applicable_promotions?.[0]?.name || promoCode})</span>
              <span>−E{totalDiscount.toFixed(2)}</span>
            </div>
          )}

          <div className="summary-row">
            <span>Delivery Fee</span>
            <span>E{deliveryFee.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>E{total.toFixed(2)}</span>
          </div>

          {/* Saved addresses */}
          {addresses.length > 0 && (
            <div className="form-group" style={{ marginTop: 16 }}>
              <label>Saved Addresses</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {addresses.map(addr => (
                  <label key={addr.id} style={{
                    display: 'flex', gap: 8, padding: '8px 12px',
                    border: selectedAddressId === addr.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13,
                  }}>
                    <input type="radio" name="address" checked={selectedAddressId === addr.id} onChange={() => selectAddress(addr)} />
                    <div>
                      <strong>{addr.label}</strong> {addr.is_default && <span className="badge badge-info" style={{ fontSize: 10 }}>Default</span>}
                      <div style={{ color: '#6b7280' }}>
                        {addr.address_line_1}{addr.city ? `, ${addr.city}` : ''}{addr.region ? `, ${addr.region}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="checkout-form">
            <div className="form-group">
              <label>Delivery Address *</label>
              <textarea value={deliveryAddress} onChange={e => { setDeliveryAddress(e.target.value); setSelectedAddressId(null); }} placeholder="Enter your full delivery address..." required rows={3} />
            </div>
            <div className="form-group">
              <label>Delivery Notes</label>
              <input value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Apartment, gate code, etc." />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="CARD">Credit/Debit Card</option>
                <option value="MOCK">Demo Payment</option>
              </select>
            </div>

            {/* Promo Code */}
            <div className="form-group">
              <label>Promo Code</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={promoCode}
                  onChange={e => { setPromoCode(e.target.value); setPromoResult(null); }}
                  placeholder="Enter promo code"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={applyPromoCode} disabled={promoLoading || !promoCode.trim()}>
                  {promoLoading ? '...' : 'Apply'}
                </button>
              </div>
              {promoResult?.applicable_promotions?.length > 0 && (
                <small style={{ color: '#16a34a', marginTop: 4, display: 'block' }}>
                  ✅ {promoResult.applicable_promotions[0].name} — Save E{totalDiscount.toFixed(2)}
                </small>
              )}
              {promoResult && !promoResult.applicable_promotions?.length && (
                <small style={{ color: '#dc2626', marginTop: 4, display: 'block' }}>
                  No promotions applied for this code
                </small>
              )}
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleCheckout} disabled={checking}>
            {checking ? 'Processing...' : `Place Order — E${total.toFixed(2)}`}
          </button>
          <Link to="/" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }}>Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
