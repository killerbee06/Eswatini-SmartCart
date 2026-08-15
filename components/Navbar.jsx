import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cartAPI } from '../services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const isMerchant = user && ['MERCHANT_OWNER', 'MERCHANT_STAFF'].includes(user.role);
  const isDriver = user && user.role === 'DRIVER';
  const isAdmin = user && ['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(user.role);

  // Poll cart count
  useEffect(() => {
    if (!user) { setCartCount(0); return; }
    cartAPI.count()
      .then(res => setCartCount(res.data?.count || 0))
      .catch(() => setCartCount(0));

    const interval = setInterval(() => {
      cartAPI.count()
        .then(res => setCartCount(res.data?.count || 0))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">🛒 SmartCart</Link>

      {/* Mobile menu toggle */}
      <button
        className="navbar-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
        style={{ display: 'none', background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}
      >
        ☰
      </button>

      <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <Link to="/" onClick={() => setMenuOpen(false)}>Browse</Link>
        <Link to="/search" onClick={() => setMenuOpen(false)}>🔍 Search</Link>

        {user && (
          <>
            <Link to="/orders" onClick={() => setMenuOpen(false)}>Orders</Link>
            <Link to="/cart" onClick={() => setMenuOpen(false)} style={{ position: 'relative' }}>
              🛒 Cart
              {cartCount > 0 && (
                <span className="navbar-badge">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </Link>
            {isMerchant && <Link to="/merchant" onClick={() => setMenuOpen(false)}>Merchant</Link>}
            {isDriver && <Link to="/driver" onClick={() => setMenuOpen(false)}>Driver</Link>}
            {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}
            <Link to="/profile" onClick={() => setMenuOpen(false)} style={{ fontWeight: 500 }}>
              {user.full_name?.split(' ')[0] || 'Profile'}
            </Link>
            <button onClick={() => { logout(); setMenuOpen(false); }}>Logout</button>
          </>
        )}

        {!user && (
          <>
            <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link to="/register" onClick={() => setMenuOpen(false)} className="btn btn-primary btn-sm" style={{ color: 'white' }}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
