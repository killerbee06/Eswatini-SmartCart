import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, combosAPI, adsAPI } from '../services/api';

export default function StorePage() {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('products');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('created_at');
  const limit = 12;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/stores/${id}`).catch(() => null),
      api.get(`/products?store_id=${id}&page=${page}&limit=${limit}&sort=${sort}`).catch(() => ({ data: { data: [], total: 0 } })),
      combosAPI.list(`store_id=${id}&limit=8`).catch(() => ({ data: { data: [] } })),
    ]).then(([storeRes, prodsRes, combosRes]) => {
      setStore(storeRes?.data);
      setProducts(prodsRes?.data?.data || []);
      setTotal(prodsRes?.data?.total || 0);
      setCombos(combosRes?.data?.data || []);
    }).finally(() => setLoading(false));
  }, [id, page, sort]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading store...</div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">🏪</div>
          <h3>Store not found</h3>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container">
      {/* Store header */}
      <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        {store.banner_url && (
          <img src={store.banner_url} alt="" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
        )}
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🏪</div>
          )}
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>{store.name}</h1>
            {store.description && <p style={{ color: '#6b7280', fontSize: 14 }}>{store.description}</p>}
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: '#6b7280' }}>
              {store.location && <span>📍 {store.location}</span>}
              {store.contact_phone && <span>📞 {store.contact_phone}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'products' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('products')}>
          Products ({total})
        </button>
        {combos.length > 0 && (
          <button className={`btn ${tab === 'combos' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('combos')}>
            Combos ({combos.length})
          </button>
        )}
      </div>

      {/* Sort controls */}
      {tab === 'products' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}>
            <option value="created_at">Newest</option>
            <option value="price">Price: Low → High</option>
          </select>
        </div>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <>
          {products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No products yet</h3>
              <p>This store hasn't added any products.</p>
            </div>
          ) : (
            <div className="product-grid">
              {products.map(product => (
                <Link key={product.id} to={`/products/${product.id}`} className="product-card">
                  <div className="product-card-img">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" />
                    ) : (
                      <div className="product-placeholder">📦</div>
                    )}
                    {product.age_restricted && <span className="badge badge-red">18+</span>}
                    {product.discount_price && <span className="badge badge-green">SALE</span>}
                  </div>
                  <div className="product-card-body">
                    <div className="product-card-store">
                      {product.store_logo ? (
                        <img src={product.store_logo} alt="" style={{ width: 16, height: 16, borderRadius: 2, marginRight: 4 }} />
                      ) : null}
                      {product.store_name}
                    </div>
                    <div className="product-card-name">{product.name}</div>
                    <div className="product-card-price">
                      {product.discount_price ? (
                        <>
                          <span className="price-sale">E{Number(product.discount_price).toFixed(2)}</span>
                          <span className="price-original">E{Number(product.price).toFixed(2)}</span>
                        </>
                      ) : (
                        <span>E{Number(product.price).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Combos tab */}
      {tab === 'combos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {combos.map(combo => (
            <div key={combo.id} style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {combo.image_url && <img src={combo.image_url} alt={combo.name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
              <div style={{ fontWeight: 600, fontSize: 16 }}>{combo.name}</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 18 }}>E{Number(combo.combo_price).toFixed(2)}</span>
                <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: 14 }}>E{Number(combo.original_price).toFixed(2)}</span>
              </div>
              {combo.savings > 0 && (
                <div style={{ color: '#16a34a', fontWeight: 500, fontSize: 13, marginTop: 4 }}>Save E{Number(combo.savings).toFixed(2)}</div>
              )}
              {combo.items && combo.items.length > 0 && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  Includes: {combo.items.map(i => i.product_name).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
