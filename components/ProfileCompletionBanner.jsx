import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfileCompletionBanner() {
  const { user } = useAuth();

  if (!user || !user.needs_profile_completion) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '1px solid #f59e0b',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 14,
    }}>
      <span style={{ fontSize: 20 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <strong>Complete your profile</strong> — Please add your date of birth to purchase age-restricted products and unlock the full shopping experience.
      </div>
      <Link
        to="/profile"
        style={{
          background: '#f59e0b',
          color: 'white',
          padding: '6px 14px',
          borderRadius: 6,
          textDecoration: 'none',
          fontWeight: 500,
          fontSize: 13,
          whiteSpace: 'nowrap',
        }}
      >
        Add Date of Birth
      </Link>
    </div>
  );
}
