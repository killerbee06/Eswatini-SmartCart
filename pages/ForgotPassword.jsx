import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="form-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ marginBottom: 8 }}>Check your email</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            We've sent a password reset link to <strong>{email}</strong>.
            <br />Check your inbox and follow the instructions.
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            Didn't receive it? Check your spam folder or try again.
          </p>
          <button className="btn btn-secondary" onClick={() => { setSent(false); setEmail(''); }}>
            Try a different email
          </button>
          <p style={{ marginTop: 16 }}>
            <Link to="/login" style={{ color: '#2563eb' }}>Back to Sign In</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Reset Password</h1>
      <div className="form-card">
        <p style={{ color: '#6b7280', marginBottom: 20 }}>
          Enter the email address associated with your account and we'll send you a link to reset your password.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <p style={{ marginTop: 16 }}>
          <Link to="/login" style={{ color: '#2563eb' }}>Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
