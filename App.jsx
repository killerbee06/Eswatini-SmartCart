import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProfileCompletionBanner from './components/ProfileCompletionBanner';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Merchant from './pages/Merchant';
import Driver from './pages/Driver';
import Admin from './pages/Admin';
import Tracking from './pages/Tracking';
import Profile from './pages/Profile';
import StorePage from './pages/StorePage';
import CategoryPage from './pages/CategoryPage';
import SearchPage from './pages/SearchPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import './App.css';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;

  return (
    <>
      <Navbar />
      <main className="main-content">
        <ProfileCompletionBanner />
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/" element={<Home />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/stores/:id" element={<StorePage />} />
          <Route path="/categories/:id" element={<CategoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/orders/:id/tracking" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
          <Route path="/merchant" element={<ProtectedRoute roles={['MERCHANT_OWNER', 'MERCHANT_STAFF']}><Merchant /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute roles={['DRIVER']}><Driver /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['ADMIN', 'SUPER_ADMIN', 'FINANCE']}><Admin /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
