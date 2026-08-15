import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  // Supabase sends the user back with #access_token=... or ?code=...
  // PKCE flow: detectSessionInUrl handles the code exchange automatically
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session) {
          setSessionReady(true);
        } else {
          // Wait a moment for PKCE code exchange to complete
          setTimeout(async () => {
            if (!mounted) return;
            const { data: { session: s2 } } = await supabase.auth.getSession();
            if (s2) {
              setSessionReady(true);
            } else {
              setSessionError('Invalid or expired reset link. Please request a new one.');
            }
          }, 2000);
        }
      } catch {
        if (mounted) setSessionError('Failed to verify reset link.');
      }
    };

    checkSession();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(password);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Session still loading
  if (!sessionReady && !sessionError) {
    return (
      <div className="auth-page">
        <div className="form-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid/expired link
  if (sessionError) {
    return (
      <div className="auth-page">
        <div className="form-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ marginBottom: 8 }}>Link Expired</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>{sessionError}</p>
          <Link to="/forgot-password" className="btn btn-primary">Request New Reset Link</Link>
        </div>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="auth-page">
        <div className="form-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Password Updated</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Your password has been successfully changed.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Sign In with New Password
          </button>
        </div>
      </div>
    );
  }

  // Password form
  return (
    <div className="auth-page">
      <h1>Set New Password</h1>
      <div className="form-card">
        <p style={{ color: '#6b7280', marginBottom: 20 }}>
          Enter your new password below.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
