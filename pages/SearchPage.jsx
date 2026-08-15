import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [storeId, setStoreId] = useState(searchParams.get('store_id') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('category_id') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [sellingMethod, setSellingMethod] = useState(searchParams.get('selling_method') || '');
  const [promotedOnly, setPromotedOnly] = useState(searchParams.get('is_promoted') === 'true');
  const [sort, setSort] = useState(searchParams.get('sort') || 'created_at');

  // Load stores and categories on mount
  useEffect(() => {
    Promise.all([
      api.get('/stores').catch(() => ({ data: [] })),
      api.get('/categories').catch(() => ({ data: [] })),
    ]).then(([storesRes, catsRes]) => {
      setStores(storesRes.data?.data || storesRes.data || []);
      setCategories(catsRes.data?.data || catsRes.data || []);
    });
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, sort, order: 'desc' });
      if (query) params.set('search', query);
      if (storeId) params.set('store_id', storeId);
      if (categoryId) params.set('category_id', categoryId);
      if (minPrice) params.set('min_price', minPrice);
      if (maxPrice) params.set('max_price', maxPrice);
      if (sellingMethod) params.set('selling_method', sellingMethod);
      if (promotedOnly) params.set('is_promoted', 'true');

      const res = await api.get(`/products?${params}`);
      setProducts(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [query, storeId, categoryId, minPrice, maxPrice, sellingMethod, promotedOnly, page, sort]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  const clearFilters = () => {
    setQuery(''); setStoreId(''); setCategoryId(''); setMinPrice('');
    setMaxPrice(''); setSellingMethod(''); setPromotedOnly(false);
    setPage(1);
  };

  const hasFilters = storeId || categoryId || minPrice || maxPrice || sellingMethod || promotedOnly;
  const totalPages = Math.ceil(total / limit);

  // Flatten categories
  const flatCategories = [];
  const flatten = (items, depth = 0) => {
    for (const cat of items) {
      flatCategories.push({ ...cat, depth });
      if (cat.children?.length) flatten(cat.children, depth + 1);
    }
  };
  flatten(categories);

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: 24 }}>Search Products</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, brand, or description..."
            style={{ flex: 1, padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 16 }}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
        {/* Filter sidebar */}
        <aside>
          <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'sticky', top: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Filters</h3>
              {hasFilters && (
                <button className="btn-clear" onClick={clearFilters} style={{ fontSize: 12 }}>Clear all</button>
              )}
            </div>

            {/* Store filter */}
            <div className="form-group">
              <label style={{ fontSize: 12 }}>Store</label>
              <select value={storeId} onChange={e => { setStoreId(e.target.value); setPage(1); }} style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}>
                <option value="">All Stores</option>
                {stores.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Category filter */}
            <div className="form-group">
              <label style={{ fontSize: 12 }}>Category</label>
              <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }} style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}>
                <option value="">All Categories</option>
                {flatCategories.map(c => (
                  <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div className="form-group">
              <label style={{ fontSize: 12 }}>Price Range (E)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Min" style={{ width: '50%', padding: '6px 8px', fontSize: 13 }} />
                <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Max" style={{ width: '50%', padding: '6px 8px', fontSize: 13 }} />
              </div>
            </div>

            {/* Selling method */}
            <div className="form-group">
              <label style={{ fontSize: 12 }}>Type</label>
              <select value={sellingMethod} onChange={e => { setSellingMethod(e.target.value); setPage(1); }} style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}>
                <option value="">All Types</option>
                <option value="UNIT">Unit</option>
                <option value="WEIGHT">By Weight</option>
                <option value="VOLUME">By Volume</option>
                <option value="PIECE">Piece</option>
                <option value="PACK">Pack</option>
              </select>
            </div>

            {/* Promoted only */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={promotedOnly}
                  onChange={e => { setPromotedOnly(e.target.checked); setPage(1); }}
                />
                On Sale Only
              </label>
            </div>

            {/* Sort */}
            <div className="form-group">
              <label style={{ fontSize: 12 }}>Sort By</label>
              <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}>
                <option value="created_at">Newest</option>
                <option value="price">Price: Low → High</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div>
          <div style={{ marginBottom: 16, fontSize: 14, color: '#6b7280' }}>
            {total} product{total !== 1 ? 's' : ''} found
          </div>

          {loading ? (
            <div className="product-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="product-card skeleton">
                  <div className="skeleton-img" />
                  <div className="skeleton-text" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No products found</h3>
              <p>Try adjusting your search or filters</p>
              <button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
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
        </div>
      </div>
    </div>
  );
}
