import { useState, useEffect } from 'react';
import { deliveriesAPI } from '../services/api';

export default function Driver() {
  const [deliveries, setDeliveries] = useState([]);
  const [pending, setPending] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      deliveriesAPI.myDeliveries().catch(() => ({ data: [] })),
      deliveriesAPI.pending().catch(() => ({ data: [] })),
    ]).then(([myRes, pendRes]) => {
      setDeliveries(myRes.data || []);
      setPending(pendRes.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const advanceStatus = async (id, status) => {
    setMsg('');
    try {
      await deliveriesAPI.updateStatus(id, { status });
      setMsg('Status updated!');
      const res = await deliveriesAPI.myDeliveries();
      setDeliveries(res.data || []);
    } catch (err) { setMsg(err.message); }
  };

  const genOTP = async (id) => {
    try {
      const res = await deliveriesAPI.generateOTP(id);
      alert(`OTP: ${res.data.otp_display ? 'Generated (share with customer)' : 'N/A'}`);
    } catch (err) { alert(err.message); }
  };

  const sendLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      alert(`Location: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}\n(Socket.IO integration required for real-time)`);
    });
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Driver Dashboard</h2>
      {msg && <div className="alert alert-success">{msg}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'active' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('active')}>My Deliveries ({deliveries.length})</button>
        <button className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('pending')}>Available ({pending.length})</button>
        <button className="btn btn-outline" onClick={sendLocation}>📍 Update Location</button>
      </div>
      {tab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deliveries.length === 0 && <p style={{ color: '#6b7280' }}>No active deliveries.</p>}
          {deliveries.map(d => (
            <div key={d.id} style={{ background: 'white', padding: 16, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Delivery #{d.id}</strong>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Status: <span className="badge badge-info">{d.status}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {d.status === 'ASSIGNED' && <button className="btn btn-sm btn-primary" onClick={() => advanceStatus(d.id, 'EN_ROUTE_TO_PICKUP')}>En Route to Pickup</button>}
                {d.status === 'EN_ROUTE_TO_PICKUP' && <button className="btn btn-sm btn-primary" onClick={() => advanceStatus(d.id, 'AT_PICKUP')}>At Pickup</button>}
                {d.status === 'AT_PICKUP' && <button className="btn btn-sm btn-primary" onClick={() => advanceStatus(d.id, 'PICKED_UP')}>Picked Up</button>}
                {d.status === 'PICKED_UP' && <button className="btn btn-sm btn-primary" onClick={() => advanceStatus(d.id, 'EN_ROUTE_TO_CUSTOMER')}>En Route to Customer</button>}
                {d.status === 'EN_ROUTE_TO_CUSTOMER' && <button className="btn btn-sm btn-success" onClick={() => genOTP(d.id)}>Generate OTP</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.length === 0 && <p style={{ color: '#6b7280' }}>No available deliveries.</p>}
          {pending.map(d => (
            <div key={d.id} style={{ background: 'white', padding: 16, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Delivery #{d.id} — {d.status}</strong>
              <button className="btn btn-sm btn-success" onClick={async () => {
                await deliveriesAPI.assign(d.id, {});
                setMsg('Delivery accepted!');
                const [myRes, pendRes] = await Promise.all([deliveriesAPI.myDeliveries(), deliveriesAPI.pending()]);
                setDeliveries(myRes.data || []);
                setPending(pendRes.data || []);
              }}>Accept</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
