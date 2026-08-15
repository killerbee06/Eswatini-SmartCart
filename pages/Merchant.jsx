import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, categoriesAPI } from '../services/api';

const SELLING_METHODS = [
  { value: 'UNIT', label: 'Fixed Item (unit)', description: 'Sold per item at a fixed price' },
  { value: 'WEIGHT', label: 'By Weight', description: 'Sold by kg/g — customer specifies desired weight' },
  { value: 'VOLUME', label: 'By Volume', description: 'Sold by litre/mL' },
  { value: 'PIECE', label: 'By Piece', description: 'Sold per piece (e.g. tomatoes, eggs)' },
  { value: 'PACK', label: 'Pack', description: 'Sold as a pack of items' },
];

export default function Merchant() {
  const { user } = useAuth();
  const [tab, setTab] = useState('orders');
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  // Product creation form
  const [productForm, setProductForm] = useState({
    name: '', description: '', category_id: '', price: '', discount_price: '',
    stock_quantity: 0, image_url: '', selling_method: 'UNIT', measurement_unit: '',
    price_per_unit: '', minimum_quantity: '', maximum_quantity: '', quantity_increment: '',
    brand: '', age_restricted: false, minimum_age: 18, special_instructions_enabled: false,
    is_available: true,
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/stores').catch(() => ({ data: [] })),
      api.get('/products/merchant').catch(() => ({ data: [] })),
      categoriesAPI.list().catch(() => ({ data: [] })),
    ]).then(([storesRes, prodsRes, catsRes]) => {
      const stores = storesRes.data?.data || storesRes.data || [];
      if (stores.length > 0) setStore(stores[0]);
      const prods = prodsRes.data?.data || prodsRes.data || [];
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(catsRes.data?.data || catsRes.data || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (store?.id) {
      api.get(`/orders/merchant/${store.id}`)
        .then(res => { setOrders(Array.isArray(res.data?.data || res.data) ? (res.data?.data || res.data) : []); })
        .catch(() => setOrders([]));
    }
  }, [store]);

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
    } catch (err) {
      setError(err.message);
    }
  };

  const updateProductForm = (key, value) => setProductForm(prev => ({ ...prev, [key]: value }));

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!store?.id) { setError('No store associated with your account.'); return; }
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...productForm,
        store_id: store.id,
        category_id: productForm.category_id ? Number(productForm.category_id) : null,
        price: Number(productForm.price),
        discount_price: productForm.discount_price ? Number(productForm.discount_price) : null,
        stock_quantity: Number(productForm.stock_quantity) || 0,
        price_per_unit: productForm.price_per_unit ? Number(productForm.price_per_unit) : null,
        minimum_quantity: productForm.minimum_quantity ? Number(productForm.minimum_quantity) : null,
        maximum_quantity: productForm.maximum_quantity ? Number(productForm.maximum_quantity) : null,
        quantity_increment: productForm.quantity_increment ? Number(productForm.quantity_increment) : null,
        minimum_age: productForm.age_restricted ? Number(productForm.minimum_age) || 18 : null,
      };

      await api.post('/products', payload);
      setSuccess('Product created successfully!');
      setProductForm({
        name: '', description: '', category_id: '', price: '', discount_price: '',
        stock_quantity: 0, image_url: '', selling_method: 'UNIT', measurement_unit: '',
        price_per_unit: '', minimum_quantity: '', maximum_quantity: '', quantity_increment: '',
        brand: '', age_restricted: false, minimum_age: 18, special_instructions_enabled: false,
        is_available: true,
      });
      // Reload products
      const prodsRes = await api.get('/products/merchant');
      setProducts(prodsRes.data?.data || prodsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="page-container"><div className="loading">Loading merchant dashboard...</div></div>;

  // Flatten categories for dropdown
  const flatCategories = [];
  const flatten = (items, depth = 0) => {
    for (const cat of items) {
      flatCategories.push({ ...cat, depth });
      if (cat.children?.length) flatten(cat.children, depth + 1);
    }
  };
  flatten(categories);

  const tabs = [
    { key: 'orders', label: `Orders (${orders.length})` },
    { key: 'products', label: `Products (${products.length})` },
    { key: 'create', label: '+ Add Product' },
    { key: 'store', label: 'Store Settings' },
  ];

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <h1>🏪 Merchant Dashboard</h1>
        {store && <p className="text-muted">{store.name}</p>}
      </div>

      <div className="dashboard-tabs">
        {tabs.map(t => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => { setTab(t.key); setError(''); setSuccess(''); }}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="dashboard-content">
          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No orders yet</h3>
              <p>Orders from customers will appear here</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Order Ref</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td>#{order.main_ref}</td>
                      <td>E{Number(order.subtotal || 0).toFixed(2)}</td>
                      <td><span className="status-badge">{order.status?.replace(/_/g, ' ')}</span></td>
                      <td>
                        {order.status === 'PENDING' && <button className="btn btn-sm btn-primary" onClick={() => updateOrderStatus(order.id, 'MERCHANT_ACCEPTED')}>Accept</button>}
                        {order.status === 'MERCHANT_ACCEPTED' && <button className="btn btn-sm btn-primary" onClick={() => updateOrderStatus(order.id, 'PREPARING')}>Preparing</button>}
                        {order.status === 'PREPARING' && <button className="btn btn-sm btn-success" onClick={() => updateOrderStatus(order.id, 'READY_FOR_PICKUP')}>Ready</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="dashboard-content">
          {products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No products yet</h3>
              <button className="btn btn-primary" onClick={() => setTab('create')}>Add Your First Product</button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Product</th><th>Type</th><th>Price</th><th>Stock</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td><span className="badge badge-gray">{product.selling_method || 'UNIT'}</span></td>
                      <td>E{Number(product.price).toFixed(2)}</td>
                      <td>{product.stock_quantity}</td>
                      <td>
                        <span className={`status-badge ${product.is_available ? 'active' : 'inactive'}`}>
                          {product.is_available ? 'Active' : 'Unavailable'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Product Tab */}
      {tab === 'create' && (
        <div className="dashboard-content" style={{ maxWidth: 700 }}>
          <h3 style={{ marginBottom: 16 }}>Add New Product</h3>
          <form onSubmit={handleCreateProduct}>
            {/* Selling Method Selector */}
            <div className="form-group">
              <label>Selling Type *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {SELLING_METHODS.map(sm => (
                  <label key={sm.value} style={{
                    padding: '12px', border: productForm.selling_method === sm.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 13,
                    background: productForm.selling_method === sm.value ? '#eff6ff' : 'white',
                  }}>
                    <input type="radio" name="selling_method" value={sm.value} checked={productForm.selling_method === sm.value}
                      onChange={e => updateProductForm('selling_method', e.target.value)} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 600 }}>{sm.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{sm.description}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Basic fields */}
            <div className="form-group">
              <label>Product Name *</label>
              <input value={productForm.name} onChange={e => updateProductForm('name', e.target.value)} required placeholder="e.g. Tastic Rice 10kg" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={productForm.description} onChange={e => updateProductForm('description', e.target.value)} rows={2} placeholder="Product description..." />
            </div>
            <div className="form-group">
              <label>Brand</label>
              <input value={productForm.brand} onChange={e => updateProductForm('brand', e.target.value)} placeholder="e.g. Tastic, Iwisa" />
            </div>

            {/* Category */}
            <div className="form-group">
              <label>Category</label>
              <select value={productForm.category_id} onChange={e => updateProductForm('category_id', e.target.value)}>
                <option value="">Select category...</option>
                {flatCategories.map(c => (
                  <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>
                ))}
              </select>
            </div>

            {/* Pricing */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Price (E) *</label>
                <input type="number" step="0.01" min="0" value={productForm.price} onChange={e => updateProductForm('price', e.target.value)} required placeholder="0.00" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Discount Price (E)</label>
                <input type="number" step="0.01" min="0" value={productForm.discount_price} onChange={e => updateProductForm('discount_price', e.target.value)} placeholder="Leave empty if none" />
              </div>
            </div>

            {/* Weight/volume fields */}
            {(productForm.selling_method === 'WEIGHT' || productForm.selling_method === 'VOLUME') && (
              <>
                <div className="form-group">
                  <label>Measurement Unit</label>
                  <select value={productForm.measurement_unit} onChange={e => updateProductForm('measurement_unit', e.target.value)}>
                    <option value="">{productForm.selling_method === 'WEIGHT' ? 'Select unit...' : 'Select unit...'}</option>
                    {productForm.selling_method === 'WEIGHT' ? (
                      <>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="g">Gram (g)</option>
                      </>
                    ) : (
                      <>
                        <option value="L">Litre (L)</option>
                        <option value="mL">Millilitre (mL)</option>
                      </>
                    )}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Price Per Unit</label>
                    <input type="number" step="0.01" value={productForm.price_per_unit} onChange={e => updateProductForm('price_per_unit', e.target.value)} placeholder="e.g. 89.99" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Min Quantity</label>
                    <input type="number" step="0.1" value={productForm.minimum_quantity} onChange={e => updateProductForm('minimum_quantity', e.target.value)} placeholder="0.5" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Max Quantity</label>
                    <input type="number" step="0.1" value={productForm.maximum_quantity} onChange={e => updateProductForm('maximum_quantity', e.target.value)} placeholder="50" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Quantity Increment</label>
                  <input type="number" step="0.05" value={productForm.quantity_increment} onChange={e => updateProductForm('quantity_increment', e.target.value)} placeholder="0.5" />
                  <small style={{ color: '#6b7280' }}>Step size for customer selection (e.g. 0.5 for half-kg increments)</small>
                </div>
              </>
            )}

            {/* Stock */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Stock Quantity</label>
                <input type="number" min="0" value={productForm.stock_quantity} onChange={e => updateProductForm('stock_quantity', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Image URL</label>
                <input value={productForm.image_url} onChange={e => updateProductForm('image_url', e.target.value)} placeholder="https://..." />
              </div>
            </div>

            {/* Age restriction */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={productForm.age_restricted} onChange={e => updateProductForm('age_restricted', e.target.checked)} />
                Age Restricted Product
              </label>
              {productForm.age_restricted && (
                <div style={{ marginTop: 8 }}>
                  <label>Minimum Age</label>
                  <input type="number" min="18" max="21" value={productForm.minimum_age} onChange={e => updateProductForm('minimum_age', e.target.value)} style={{ width: 100 }} />
                </div>
              )}
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={creating || !productForm.name || !productForm.price}>
              {creating ? 'Creating...' : 'Create Product'}
            </button>
          </form>
        </div>
      )}

      {/* Store Settings Tab */}
      {tab === 'store' && store && (
        <div className="dashboard-content">
          <div className="detail-card" style={{ maxWidth: 600 }}>
            <h3>Store Information</h3>
            <div className="detail-row"><span className="label">Name</span><span>{store.name}</span></div>
            <div className="detail-row"><span className="label">Description</span><span>{store.description || '—'}</span></div>
            <div className="detail-row"><span className="label">Location</span><span>{store.location || '—'}</span></div>
            <div className="detail-row"><span className="label">Status</span><span className={`status-badge ${store.is_active ? 'active' : 'inactive'}`}>{store.is_active ? 'Active' : 'Inactive'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
