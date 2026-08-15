import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api, combosAPI, adsAPI, storeFavoritesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [combos, setCombos] = useState([]);
  const [ads, setAds] = useState([]);
  const [favStores, setFavStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedStore, setSelectedStore] = useState(searchParams.get('store') || '');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  // Load initial data
  useEffect(() => {
    const promises = [
      api.get('/stores').catch(() => ({ data: [] })),
      api.get('/categories').catch(() => ({ data: [] })),
      combosAPI.list('limit=6').catch(() => ({ data: { data: [] } })),
      adsAPI.list('placement=HOME_BANNER&limit=3').catch(() => ({ data: { data: [] } })),
    ];

    if (user) {
      promises.push(storeFavoritesAPI.list().catch(() => ({ data: [] })));
    }

    Promise.all(promises).then(([storesRes, catsRes, combosRes, adsRes, favRes]) => {
      setStores(storesRes.data?.data || storesRes.data || []);
      setCategories(catsRes.data?.data || catsRes.data || []);
      setCombos(combosRes.data?.data || combosRes.data || []);
      setAds(adsRes.data?.data || adsRes.data || []);
      if (favRes) setFavStores(favRes.data || []);
    });
  }, [user]);

  // Load products with filters
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (selectedCategory) params.set('category_id', selectedCategory);
      if (selectedStore) params.set('store_id', selectedStore);

      const res = await api.get(`/products?${params}`);
      const data = res.data?.data || res.data;
      setProducts(Array.isArray(data) ? data : []);
      setTotal(res.data?.total || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedStore]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Sync filters to URL
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (selectedCategory) params.category = selectedCategory;
    if (selectedStore) params.store = selectedStore;
    setSearchParams(params, { replace: true });
  }, [search, selectedCategory, selectedStore, setSearchParams]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); loadProducts(); };

  const clearFilters = () => { setSearch(''); setSelectedCategory(''); setSelectedStore(''); setPage(1); };

  // Flatten category tree
  const flatCategories = [];
  const flatten = (items, depth = 0) => {
    for (const cat of items) {
      flatCategories.push({ ...cat, depth });
      if (cat.children?.length) flatten(cat.children, depth + 1);
    }
  };
  flatten(categories);

  const totalPages = Math.ceil(total / limit);
  const showBrowse = search || selectedCategory || selectedStore;

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="hero">
        <h1>Let The Market Come To You</h1>
        <p>Shop from multiple stores, one delivery</p>
        <form className="search-form" onSubmit={(e) => { e.preventDefault(); if (search.trim()) navigate(`/search?q=${encodeURIComponent(search)}`); }}>
          <input
            type="text"
            placeholder="Search products... (e.g. rice, fresh beef, 10kg sugar)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
      </section>

      {/* Homepage ads/banners */}
      {ads.length > 0 && !showBrowse && (
        <section className="section">
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {ads.map(ad => (
              <div key={ad.id} style={{ minWidth: 300, background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {ad.image_url && <img src={ad.image_url} alt={ad.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />}
                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{ad.title}</div>
                  {ad.store_name && <div style={{ fontSize: 12, color: '#6b7280' }}>by {ad.store_name}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Preferred Stores */}
      {favStores.length > 0 && !showBrowse && (
        <section className="section">
          <h2>Your Preferred Stores</h2>
          <div className="store-grid">
            {favStores.slice(0, 4).map(store => (
              <Link
                key={store.id}
                to={`/?store=${store.id}`}
                className="store-card"
                style={{ borderColor: '#2563eb' }}
                onClick={() => { setSelectedStore(String(store.id)); setPage(1); }}
              >
                <div className="store-card-icon">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                  ) : '🏪'}
                </div>
                <div className="store-card-name">{store.name}</div>
                <span className="badge badge-info" style={{ fontSize: 10 }}>Preferred</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Combos */}
      {combos.length > 0 && !showBrowse && (
        <section className="section">
          <h2>🎁 Combos & Bundles</h2>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {combos.map(combo => (
              <div key={combo.id} style={{ minWidth: 280, background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {combo.image_url && <img src={combo.image_url} alt={combo.name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
                <div style={{ fontWeight: 600, fontSize: 16 }}>{combo.name}</div>
                {combo.store_name && (
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    {combo.store_logo ? (
                      <img src={combo.store_logo} alt="" style={{ width: 16, height: 16, borderRadius: 2 }} />
                    ) : '🏪'} {combo.store_name}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 18 }}>E{Number(combo.combo_price).toFixed(2)}</span>
                  <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: 14 }}>E{Number(combo.original_price).toFixed(2)}</span>
                </div>
                {combo.savings > 0 && (
                  <div style={{ color: '#16a34a', fontWeight: 500, fontSize: 13, marginTop: 4 }}>
                    Save E{Number(combo.savings).toFixed(2)}
                  </div>
                )}
                {combo.items && combo.items.length > 0 && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                    Includes: {combo.items.map(i => i.product_name).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {flatCategories.length > 0 && (
        <section className="section">
          <h2>Categories</h2>
          <div className="category-grid">
            <button
              className={`category-chip ${!selectedCategory ? 'active' : ''}`}
              onClick={() => { setSelectedCategory(''); setPage(1); }}
            >
              All
            </button>
            {flatCategories.map(cat => (
              <Link
                key={cat.id}
                to={`/categories/${cat.id}`}
                className="category-chip"
                style={{ marginLeft: cat.depth * 16, textDecoration: 'none' }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Stores */}
      {stores.length > 0 && !showBrowse && (
        <section className="section">
          <h2>Featured Stores</h2>
          <div className="store-grid">
            {stores.slice(0, 6).map(store => (
              <Link
                key={store.id}
                to={`/stores/${store.id}`}
                className="store-card"
              >
                <div className="store-card-icon">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                  ) : '🏪'}
                </div>
                <div className="store-card-name">{store.name}</div>
                {store.description && <div className="store-card-desc">{store.description}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Active store filter */}
      {selectedStore && (
        <div className="filter-bar">
          <span>
            Showing products from: <strong>{stores.find(s => String(s.id) === selectedStore)?.name || 'Store'}</strong>
          </span>
          <button className="btn-clear" onClick={() => { setSelectedStore(''); setPage(1); }}>
            ✕ Clear
          </button>
        </div>
      )}

      {/* Products */}
      <section className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>{search ? `Results for "${search}"` : 'All Products'}</h2>
          {(search || selectedCategory || selectedStore) && (
            <button className="btn-clear" onClick={clearFilters}>Clear all filters</button>
          )}
        </div>

        {loading ? (
          <div className="product-grid">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="product-card skeleton">
                <div className="skeleton-img" />
                <div className="skeleton-text" />
                <div className="skeleton-text short" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No products found</h3>
            <p>Try adjusting your search or filters</p>
            <button className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
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
                  {/* Badges */}
                  {product.age_restricted && (
                    <span className="badge badge-red">18+</span>
                  )}
                  {product.discount_price && (
                    <span className="badge badge-green">SALE</span>
                  )}
                  {product.selling_method === 'WEIGHT' && (
                    <span className="badge badge-info">⚖️ Weight</span>
                  )}
                </div>
                <div className="product-card-body">
                  {/* Store badge */}
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
                    {product.measurement_unit && (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}> / {product.measurement_unit}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              ← Previous
            </button>
            <span className="pagination-info">Page {page} of {totalPages}</span>
            <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
