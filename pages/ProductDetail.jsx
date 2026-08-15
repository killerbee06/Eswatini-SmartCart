import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, cartAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [requestedWeight, setRequestedWeight] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${id}`)
      .then(res => setProduct(res.data?.data || res.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) { navigate('/login'); return; }
    setAdding(true);
    setError('');
    try {
      await cartAPI.addItem({
        product_id: product.id,
        quantity,
        requested_quantity: product.selling_method === 'WEIGHT' && requestedWeight
          ? Number(requestedWeight)
          : null,
        unit: product.measurement_unit || null,
        special_instructions: specialInstructions || null,
      });
      setMessage('Added to cart!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>Product not found</h3>
          <Link to="/" className="btn btn-primary">Back to Shop</Link>
        </div>
      </div>
    );
  }

  const isWeightBased = product.selling_method === 'WEIGHT';
  const isVolumeBased = product.selling_method === 'VOLUME';

  return (
    <div className="page-container">
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        {product.store_name && (
          <>
            <Link to={`/?store=${product.store_id}`}>{product.store_name}</Link>
            <span>/</span>
          </>
        )}
        <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-detail-img">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div className="product-placeholder large">📦</div>
          )}
          {product.age_restricted && (
            <div className="age-restriction-badge">
              🔞 Age Restricted ({product.minimum_age || 18}+)
            </div>
          )}
        </div>

        <div className="product-detail-info">
          {/* Store identity */}
          <Link to={`/?store=${product.store_id}`} className="product-detail-store">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {product.store_logo ? (
                <img src={product.store_logo} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
              ) : (
                <span className="store-badge">🏪</span>
              )}
              <span>{product.store_name}</span>
            </div>
          </Link>

          <h1>{product.name}</h1>

          {product.brand && (
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Brand: {product.brand}</div>
          )}

          <div className="product-detail-price">
            {product.discount_price ? (
              <>
                <span className="price-sale large">E{Number(product.discount_price).toFixed(2)}</span>
                <span className="price-original large">E{Number(product.price).toFixed(2)}</span>
                <span className="discount-badge">
                  Save {Math.round((1 - product.discount_price / product.price) * 100)}%
                </span>
              </>
            ) : (
              <span className="price-current large">E{Number(product.price).toFixed(2)}</span>
            )}
            {product.measurement_unit && (
              <span style={{ fontSize: 14, color: '#6b7280', marginLeft: 8 }}>
                / {product.measurement_unit}
              </span>
            )}
          </div>

          {product.price_per_unit && (
            <div style={{ fontSize: 14, color: '#2563eb', marginTop: 4 }}>
              Price per {product.measurement_unit}: E{Number(product.price_per_unit).toFixed(2)}
            </div>
          )}

          {product.description && (
            <p className="product-detail-desc">{product.description}</p>
          )}

          <div className="product-detail-meta">
            <div>
              <span className="label">Availability:</span>
              {product.stock_quantity > 0 ? (
                <span className="in-stock">In Stock ({product.stock_quantity} available)</span>
              ) : (
                <span className="out-of-stock">Out of Stock</span>
              )}
            </div>
            {product.category_name && (
              <div>
                <span className="label">Category:</span>
                <span>{product.category_name}</span>
              </div>
            )}
          </div>

          {product.age_restricted && !user?.date_of_birth && (
            <div className="alert alert-warning">
              ⚠️ This product requires age verification. Please add your date of birth to your profile before purchasing.
              <Link to="/profile" style={{ marginLeft: 8, color: '#2563eb' }}>Update Profile</Link>
            </div>
          )}

          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          {/* Weight / quantity selector for variable products */}
          {(isWeightBased || isVolumeBased) && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>{isWeightBased ? 'Requested Weight' : 'Requested Volume'} ({product.measurement_unit || 'kg'})</label>
              <input
                type="number"
                step={product.quantity_increment || 0.1}
                min={product.minimum_quantity || 0.1}
                max={product.maximum_quantity || 100}
                value={requestedWeight}
                onChange={e => setRequestedWeight(e.target.value)}
                placeholder={`${product.minimum_quantity || 0.1} - ${product.maximum_quantity || 100}`}
              />
              {product.price_per_unit && requestedWeight && (
                <small style={{ color: '#2563eb' }}>
                  Estimated: E{(Number(product.price_per_unit) * Number(requestedWeight)).toFixed(2)}
                </small>
              )}
            </div>
          )}

          {/* Special instructions */}
          {product.special_instructions_enabled && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Special Instructions</label>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="e.g. thin slice, well done, no fat..."
                rows={2}
              />
            </div>
          )}

          <div className="product-detail-actions">
            {!isWeightBased && !isVolumeBased && (
              <div className="quantity-selector">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))}
                  disabled={quantity >= product.stock_quantity}
                >
                  +
                </button>
              </div>
            )}
            <button
              className="btn btn-primary btn-lg"
              onClick={handleAddToCart}
              disabled={adding || product.stock_quantity === 0}
            >
              {adding ? 'Adding...' : product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>

          <Link to="/cart" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }}>
            🛒 View Cart
          </Link>
        </div>
      </div>
    </div>
  );
}
