import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function CategoryPage() {
  const { id } = useParams();
  const [category, setCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  useEffect(() => {
    setLoading(true);
    setPage(1);
    Promise.all([
      api.get(`/categories/${id}`).catch(() => null),
      api.get('/categories').catch(() => ({ data: [] })),
      api.get(`/products?category_id=${id}&page=1&limit=${limit}`).catch(() => ({ data: { data: [], total: 0 } })),
    ]).then(([catRes, catsRes, prodsRes]) => {
      setCategory(catRes?.data);
      setCategories(catsRes?.data?.data || catsRes?.data || []);
      setProducts(prodsRes?.data?.data || []);
      setTotal(prodsRes?.data?.total || 0);
    }).finally(() => setLoading(false));
  }, [id]);

  // Load products when page changes
  useEffect(() => {
    if (page === 1) return;
    api.get(`/products?category_id=${id}&page=${page}&limit=${limit}`)
      .then(res => {
        setProducts(res.data?.data || []);
        setTotal(res.data?.total || 0);
      })
      .catch(() => {});
  }, [page, id]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading category...</div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <h3>Category not found</h3>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  // Flatten categories for sidebar
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
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        {category.parent_id && <Link to={`/categories/${category.parent_id}`}>Parent</Link>}
        <span>/</span>
        <span>{category.name}</span>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
        {/* Category sidebar */}
        <aside>
          <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'sticky', top: 80 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Link
                to="/"
                style={{ padding: '8px 12px', borderRadius: 8, fontSize: 14, textDecoration: 'none', color: '#374151' }}
              >
                All Products
              </Link>
              {flatCategories.map(cat => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.id}`}
                  style={{
                    padding: '8px 12px',
                    paddingLeft: 12 + cat.depth * 16,
                    borderRadius: 8,
                    fontSize: cat.depth === 0 ? 14 : 13,
                    fontWeight: cat.id === category.id ? 600 : 400,
                    textDecoration: 'none',
                    color: cat.id === category.id ? '#2563eb' : '#374151',
                    background: cat.id === category.id ? '#eff6ff' : 'transparent',
                  }}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24 }}>{category.name}</h1>
            {category.product_count > 0 && (
              <p style={{ color: '#6b7280', fontSize: 14 }}>{category.product_count} products</p>
            )}
          </div>

          {/* Subcategories as chips */}
          {category.children && category.children.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8, color: '#6b7280' }}>Subcategories</h3>
              <div className="category-grid">
                {category.children.map(child => (
                  <Link
                    key={child.id}
                    to={`/categories/${child.id}`}
                    className="category-chip"
                    style={{ textDecoration: 'none' }}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No products in this category</h3>
              <p>Products will appear here once merchants add them.</p>
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
