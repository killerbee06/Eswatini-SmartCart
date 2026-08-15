import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';

export default function VerifyEmail() {
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      // Get the current user's email from the session
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;

      if (!email) {
        setError('No email found. Please sign up again.');
        return;
      }

      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (resendError) throw new Error(resendError.message);
      setResent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="form-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📧</div>
        <h2 style={{ marginBottom: 8 }}>Verify Your Email</h2>
        <p style={{ color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
          We've sent a verification link to your email address.
          <br />
          Please check your inbox and click the link to activate your account.
        </p>

        {error && <div className="alert alert-error" style={{ textAlign: 'left' }}>{error}</div>}

        {resent && (
          <div className="alert alert-success" style={{ textAlign: 'left', marginBottom: 16 }}>
            Verification email resent! Check your inbox.
          </div>
        )}

        <button
          className="btn btn-secondary"
          onClick={handleResend}
          disabled={loading}
          style={{ marginBottom: 16 }}
        >
          {loading ? 'Sending...' : 'Resend Verification Email'}
        </button>

        <p style={{ marginTop: 16, fontSize: 14, color: '#6b7280' }}>
          Already verified? <Link to="/login" style={{ color: '#2563eb' }}>Sign In</Link>
        </p>

        <p style={{ marginTop: 8, fontSize: 13, color: '#9ca3af' }}>
          Check your spam folder if you don't see the email.
        </p>
      </div>
    </div>
  );
}
