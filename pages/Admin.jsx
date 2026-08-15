import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'overview') {
      setLoading(true);
      adminAPI.overview().then(res => setOverview(res.data)).finally(() => setLoading(false));
    }
    if (tab === 'settings') {
      setLoading(true);
      adminAPI.settings().then(res => setSettings(res.data || [])).finally(() => setLoading(false));
    }
  }, [tab]);

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Admin Dashboard</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['overview', 'settings'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <p>Loading...</p> : (
        <>
          {tab === 'overview' && overview && (
            <>
              <div className="stats-grid">
                <div className="stat-card"><div className="label">Total Orders</div><div className="value">{overview.orders?.total || 0}</div></div>
                <div className="stat-card"><div className="label">GMV</div><div className="value">SZL {Number(overview.financials?.gross_merchandise_value || 0).toFixed(2)}</div></div>
                <div className="stat-card"><div className="label">Commissions</div><div className="value">SZL {Number(overview.financials?.total_commissions || 0).toFixed(2)}</div></div>
                <div className="stat-card"><div className="label">Revenue</div><div className="value">SZL {Number(overview.financials?.total_payment_volume || 0).toFixed(2)}</div></div>
                <div className="stat-card"><div className="label">Customers</div><div className="value">{overview.users?.customers || 0}</div></div>
                <div className="stat-card"><div className="label">Merchants</div><div className="value">{overview.users?.merchants || 0}</div></div>
                <div className="stat-card"><div className="label">Drivers</div><div className="value">{overview.users?.drivers || 0}</div></div>
                <div className="stat-card"><div className="label">Stores</div><div className="value">{overview.stores?.active || 0}</div></div>
              </div>
              <div className="section">
                <h2>Order Breakdown</h2>
                <div className="stats-grid">
                  <div className="stat-card"><div className="label">Completed</div><div className="value" style={{ color: '#16a34a' }}>{overview.orders?.completed || 0}</div></div>
                  <div className="stat-card"><div className="label">Pending</div><div className="value" style={{ color: '#d97706' }}>{overview.orders?.pending || 0}</div></div>
                  <div className="stat-card"><div className="label">Cancelled</div><div className="value" style={{ color: '#dc2626' }}>{overview.orders?.cancelled || 0}</div></div>
                  <div className="stat-card"><div className="label">Refunded</div><div className="value" style={{ color: '#dc2626' }}>{overview.orders?.refunded || 0}</div></div>
                </div>
              </div>
            </>
          )}
          {tab === 'settings' && (
            <div className="table-container" style={{ background: 'white', borderRadius: 8 }}>
              <table>
                <thead><tr><th>Key</th><th>Value</th><th>Description</th></tr></thead>
                <tbody>
                  {settings.map(s => (
                    <tr key={s.key}>
                      <td><strong>{s.key}</strong></td>
                      <td>{s.value}</td>
                      <td style={{ color: '#6b7280' }}>{s.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
