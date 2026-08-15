import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, loyaltyAPI, addressesAPI, storeFavoritesAPI, storesAPI } from '../services/api';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({ full_name: '', phone: '', date_of_birth: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Loyalty cards state
  const [providers, setProviders] = useState([]);
  const [loyaltyCards, setLoyaltyCards] = useState([]);
  const [newCard, setNewCard] = useState({ loyalty_provider_id: '', card_number: '' });
  const [cardLoading, setCardLoading] = useState(false);

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState({
    label: 'Home', address_line_1: '', address_line_2: '', city: '', region: '', is_default: false,
  });
  const [addrLoading, setAddrLoading] = useState(false);

  // Favorite stores state
  const [favStores, setFavStores] = useState([]);
  const [allStores, setAllStores] = useState([]);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        date_of_birth: user.date_of_birth ? user.date_of_birth.split('T')[0] : '',
      });
    }
  }, [user]);

  // Load tab data
  useEffect(() => {
    if (!user) return;
    if (tab === 'loyalty') {
      loyaltyAPI.providers().then(res => setProviders(res.data || [])).catch(() => {});
      loyaltyAPI.myCards().then(res => setLoyaltyCards(res.data || [])).catch(() => {});
    }
    if (tab === 'addresses') {
      addressesAPI.list().then(res => setAddresses(res.data || [])).catch(() => {});
    }
    if (tab === 'stores') {
      storeFavoritesAPI.list().then(res => setFavStores(res.data || [])).catch(() => {});
      storesAPI.list().then(res => setAllStores(res.data?.data || res.data || [])).catch(() => {});
    }
  }, [tab, user]);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.patch('/users/me', {
        full_name: form.full_name,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
      });
      await refreshUser();
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getAge = () => {
    if (!form.date_of_birth) return null;
    const dob = new Date(form.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  // ── Loyalty card actions ────────────────────────────────
  const addLoyaltyCard = async (e) => {
    e.preventDefault();
    setCardLoading(true);
    try {
      await loyaltyAPI.addCard(newCard);
      setNewCard({ loyalty_provider_id: '', card_number: '' });
      const res = await loyaltyAPI.myCards();
      setLoyaltyCards(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCardLoading(false);
    }
  };

  const removeLoyaltyCard = async (id) => {
    try {
      await loyaltyAPI.removeCard(id);
      setLoyaltyCards(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Address actions ─────────────────────────────────────
  const addAddress = async (e) => {
    e.preventDefault();
    setAddrLoading(true);
    try {
      await addressesAPI.add(newAddress);
      setNewAddress({ label: 'Home', address_line_1: '', address_line_2: '', city: '', region: '', is_default: false });
      const res = await addressesAPI.list();
      setAddresses(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddrLoading(false);
    }
  };

  const removeAddress = async (id) => {
    try {
      await addressesAPI.remove(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Store favorites actions ─────────────────────────────
  const toggleFavorite = async (storeId) => {
    setFavLoading(true);
    try {
      const isFav = favStores.some(s => s.id === storeId);
      if (isFav) {
        await storeFavoritesAPI.remove(storeId);
        setFavStores(prev => prev.filter(s => s.id !== storeId));
      } else {
        await storeFavoritesAPI.add(storeId);
        const res = await storeFavoritesAPI.list();
        setFavStores(res.data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setFavLoading(false);
    }
  };

  if (!user) return <div className="loading">Loading...</div>;

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'loyalty', label: 'Loyalty Cards' },
    { key: 'addresses', label: 'Delivery Addresses' },
    { key: 'stores', label: 'Preferred Stores' },
  ];

  return (
    <div className="page-container">
      {/* Profile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 20, background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
          {user.profile_image_url ? (
            <img src={user.profile_image_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            user.full_name?.charAt(0) || '?'
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 18 }}>{user.full_name}</div>
          <div style={{ color: '#6b7280', fontSize: 14 }}>{user.email || user.id}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span className="badge badge-info">{user.role}</span>
            {user.date_of_birth ? (
              <span className="badge badge-success">DOB Set</span>
            ) : (
              <span className="badge badge-warning">DOB Missing</span>
            )}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setTab(t.key); setError(''); setSuccess(''); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="profile-card" style={{ maxWidth: 600 }}>
          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input value={form.full_name} onChange={e => update('full_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+268..." />
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} />
              {getAge() !== null && (
                <small style={{ color: '#6b7280' }}>Age: {getAge()} years</small>
              )}
              {!form.date_of_birth && user.role === 'CUSTOMER' && (
                <small style={{ color: '#dc2626', display: 'block', marginTop: 4 }}>
                  ⚠️ Required for age-restricted products (alcohol, etc.)
                </small>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <Link to="/" className="btn btn-secondary">Cancel</Link>
            </div>
          </form>
        </div>
      )}

      {/* Loyalty Cards Tab */}
      {tab === 'loyalty' && (
        <div style={{ maxWidth: 600 }}>
          <h3 style={{ marginBottom: 16 }}>Your Loyalty Cards</h3>
          {loyaltyCards.length === 0 ? (
            <p style={{ color: '#6b7280', marginBottom: 16 }}>No loyalty cards added yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {loyaltyCards.map(card => (
                <div key={card.id} style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{card.provider_name}</div>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>****{card.card_last_four}</div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => removeLoyaltyCard(card.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginBottom: 12 }}>Add New Card</h3>
          <form onSubmit={addLoyaltyCard}>
            <div className="form-group">
              <label>Store / Provider</label>
              <select value={newCard.loyalty_provider_id} onChange={e => setNewCard(prev => ({ ...prev, loyalty_provider_id: e.target.value }))} required>
                <option value="">Select a provider...</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Card Number</label>
              <input value={newCard.card_number} onChange={e => setNewCard(prev => ({ ...prev, card_number: e.target.value }))} required placeholder="Enter your card number" />
              <small style={{ color: '#6b7280' }}>Card number is stored securely and masked.</small>
            </div>
            <button className="btn btn-primary" type="submit" disabled={cardLoading || !newCard.loyalty_provider_id || !newCard.card_number}>
              {cardLoading ? 'Adding...' : 'Add Card'}
            </button>
          </form>
        </div>
      )}

      {/* Delivery Addresses Tab */}
      {tab === 'addresses' && (
        <div style={{ maxWidth: 600 }}>
          <h3 style={{ marginBottom: 16 }}>Delivery Addresses</h3>
          {addresses.length === 0 ? (
            <p style={{ color: '#6b7280', marginBottom: 16 }}>No saved addresses yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {addresses.map(addr => (
                <div key={addr.id} style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{addr.label} {addr.is_default && <span className="badge badge-info" style={{ fontSize: 10 }}>Default</span>}</div>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>
                      {addr.address_line_1}{addr.city ? `, ${addr.city}` : ''}{addr.region ? `, ${addr.region}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => removeAddress(addr.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginBottom: 12 }}>Add New Address</h3>
          <form onSubmit={addAddress}>
            <div className="form-group">
              <label>Label</label>
              <select value={newAddress.label} onChange={e => setNewAddress(prev => ({ ...prev, label: e.target.value }))}>
                <option>Home</option>
                <option>Work</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Address Line 1 *</label>
              <input value={newAddress.address_line_1} onChange={e => setNewAddress(prev => ({ ...prev, address_line_1: e.target.value }))} required placeholder="Street address" />
            </div>
            <div className="form-group">
              <label>Address Line 2</label>
              <input value={newAddress.address_line_2} onChange={e => setNewAddress(prev => ({ ...prev, address_line_2: e.target.value }))} placeholder="Apartment, suite, etc." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>City</label>
                <input value={newAddress.city} onChange={e => setNewAddress(prev => ({ ...prev, city: e.target.value }))} placeholder="Mbabane" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Region</label>
                <select value={newAddress.region} onChange={e => setNewAddress(prev => ({ ...prev, region: e.target.value }))}>
                  <option value="">Select region...</option>
                  <option>Hhohho</option>
                  <option>Manzini</option>
                  <option>Shiselweni</option>
                  <option>Lubombo</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={addrLoading || !newAddress.address_line_1}>
              {addrLoading ? 'Adding...' : 'Add Address'}
            </button>
          </form>
        </div>
      )}

      {/* Preferred Stores Tab */}
      {tab === 'stores' && (
        <div style={{ maxWidth: 600 }}>
          <h3 style={{ marginBottom: 16 }}>Your Preferred Stores</h3>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>Preferred stores appear first in search results and recommendations.</p>

          {favStores.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {favStores.map(store => (
                <div key={store.id} style={{ background: 'white', padding: 12, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {store.logo_url ? (
                      <img src={store.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <span>🏪</span>
                    )}
                    <div>
                      <strong>{store.name}</strong>
                      {store.description && <div style={{ fontSize: 12, color: '#6b7280' }}>{store.description}</div>}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => toggleFavorite(store.id)} disabled={favLoading}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginBottom: 12 }}>Available Stores</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {allStores.filter(s => s.is_active).map(store => {
              const isFav = favStores.some(f => f.id === store.id);
              return (
                <div key={store.id} style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', marginBottom: 8 }} />
                  ) : (
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
                  )}
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{store.name}</div>
                  <button
                    className={`btn btn-sm ${isFav ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => toggleFavorite(store.id)}
                    disabled={favLoading}
                  >
                    {isFav ? 'Remove' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div style={{ maxWidth: 600, marginTop: 32, borderTop: '1px solid #e5e7eb', paddingTop: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link to="/orders" className="list-item">📦 Order History</Link>
          <Link to="/cart" className="list-item">🛒 My Cart</Link>
        </div>
      </div>
    </div>
  );
}
