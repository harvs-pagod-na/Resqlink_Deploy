import React, { useState } from 'react';
import api from '../api';
import { PAMPANGA_BARANGAYS_MAP } from '../data/PampangaData';

const ICONS = {
  shield: '🛡️',
  user: '👤',
  lock: '🔒',
  mail: '📧',
  phone: '📞',
  eye: '👁',
  eyeOff: '🙈',
  alert: '🚨',
};

export default function AuthPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({
    email: '', password: '', confirm_password: '',
    first_name: '', last_name: '', phone_number: '',
    municipality: 'Porac', barangay: 'Cangatba',
    role: 'user', // 'user' (Citizen) | 'responder' (Field Responder)
    responder_badge_number: '',
    responder_unit: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (k, v) => setForm(f => {
    const updated = { ...f, [k]: v };
    // If municipality changes, reset barangay to the first barangay of that town
    if (k === 'municipality') {
      const bList = PAMPANGA_BARANGAYS_MAP[v] || [];
      updated.barangay = bList[0] || '';
    }
    return updated;
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: form.email, password: form.password });
      if (res.data.success) {
        const token = res.data.tokens?.accessToken;
        if (token) {
          localStorage.setItem('resqlink_token', token);
        }
        onLoginSuccess(res.data.user, token);
      } else {
        setError(res.data.message || 'Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.'); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.'); return;
    }
    if (!form.municipality) {
      setError('Please select a municipality (Porac, Santa Rita, or Guagua).'); return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number,
        role: form.role,
        municipality: form.municipality,
        city: form.municipality,
        barangay: form.barangay,
        address: form.barangay ? `${form.barangay}, ${form.municipality}, Pampanga` : `${form.municipality}, Pampanga`,
        responder_badge_number: form.responder_badge_number,
        responder_unit: form.responder_unit,
      });
      if (res.data.success) {
        setSuccess(res.data.message || 'Account created successfully! Please log in.');
        setMode('login');
        setForm(f => ({ ...f, password: '', confirm_password: '' }));
      } else {
        setError(res.data.message || 'Registration failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const availableBarangays = PAMPANGA_BARANGAYS_MAP[form.municipality] || [];

  return (
    <div className="auth-wrapper" style={{
      minHeight: '100vh',
      backgroundColor: '#090d16',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      padding: '20px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        .auth-card {
          width: 100%;
          max-width: 480px;
          background: #131b2e;
          border: 1px solid #1e293b;
          border-radius: 16px;
          padding: 32px 28px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          box-sizing: border-box;
        }
        .auth-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 480px) {
          .auth-wrapper {
            padding: 12px 10px !important;
          }
          .auth-card {
            padding: 22px 16px !important;
            border-radius: 12px !important;
          }
          .auth-grid-2 {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
          }
        }
        .logo-section {
          text-align: center;
          margin-bottom: 24px;
        }
        .logo-badge {
          width: 52px;
          height: 52px;
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 10px;
          box-shadow: 0 0 20px rgba(244, 63, 94, 0.2);
        }
        .brand-name {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #f8fafc;
        }
        .brand-subtitle {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          letter-spacing: 1px;
          margin-top: 3px;
        }
        .tab-switcher {
          display: flex;
          background: #090d16;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 20px;
          gap: 4px;
        }
        .tab-btn {
          flex: 1;
          padding: 8px;
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
        }
        .tab-btn.active {
          background: #f43f5e;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(244, 63, 94, 0.3);
        }
        .form-group {
          margin-bottom: 14px;
        }
        .form-label {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #94a3b8;
          margin-bottom: 5px;
        }
        .input-wrapper {
          position: relative;
        }
        .auth-input {
          width: 100%;
          background: #090d16;
          border: 1px solid #1e293b;
          color: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .auth-input:focus {
          border-color: #f43f5e;
          box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15);
        }
        .auth-btn {
          width: 100%;
          background: #f43f5e;
          color: #ffffff;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.3);
          margin-top: 6px;
        }
        .auth-btn:hover:not(:disabled) {
          background: #e11d48;
          transform: translateY(-1px);
        }
        .auth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .demo-section {
          margin-top: 20px;
          border-top: 1px solid #1e293b;
          padding-top: 16px;
        }
        .demo-title {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 1px;
          margin-bottom: 8px;
          text-align: center;
        }
        .demo-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .demo-chip {
          background: #090d16;
          border: 1px solid #1e293b;
          border-radius: 6px;
          padding: 7px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }
        .demo-chip:hover {
          border-color: #f43f5e;
          background: rgba(244, 63, 94, 0.05);
        }
        .demo-label {
          font-size: 11px;
          font-weight: 700;
          color: #e2e8f0;
        }
        .role-cards {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .role-card {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: #090d16;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .role-card.active {
          border-color: #f43f5e;
          background: rgba(244, 63, 94, 0.08);
        }
        .role-card-title {
          font-weight: 700;
          font-size: 12px;
          color: #e2e8f0;
          margin-top: 4px;
        }
        .alert-box {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12px;
          margin-bottom: 14px;
          line-height: 1.4;
        }
        .alert-error {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.2);
          color: #fda4af;
        }
        .alert-success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #a7f3d0;
        }
      `}</style>

      <div className="auth-card">
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-badge">🚨</div>
          <div className="brand-name">RESQLINK</div>
          <div className="brand-subtitle">TRI-MUNICIPALITY EMERGENCY COMMAND</div>
        </div>

        {/* Tab Switcher */}
        <div className="tab-switcher">
          <button className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
            Sign In
          </button>
          <button className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>
            Register
          </button>
        </div>

        {/* Alerts */}
        {error && <div className="alert-box alert-error">⚠️ {error}</div>}
        {success && <div className="alert-box alert-success">✅ {success}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="form-group">
              <label className="form-label">EMAIL ADDRESS</label>
              <input className="auth-input" type="email" placeholder="admin.porac@resqlink.gov.ph"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">PASSWORD</label>
              <div className="input-wrapper">
                <input className="auth-input" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password} onChange={e => set('password', e.target.value)} required />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: '#64748b'
                }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="form-group">
              <label className="form-label">REGISTRATION ACCOUNT TYPE</label>
              <div className="role-cards">
                <div
                  className={`role-card ${form.role === 'user' ? 'active' : ''}`}
                  onClick={() => set('role', 'user')}
                >
                  <div style={{ fontSize: '20px' }}>🙋</div>
                  <div className="role-card-title">Citizen</div>
                  <div style={{ fontSize: '9.5px', color: '#10b981', fontWeight: '700', marginTop: '2px' }}>⚡ Instant SOS Access</div>
                </div>

                <div
                  className={`role-card ${form.role === 'responder' ? 'active' : ''}`}
                  onClick={() => set('role', 'responder')}
                >
                  <div style={{ fontSize: '20px' }}>🚑</div>
                  <div className="role-card-title">Field Responder</div>
                  <div style={{ fontSize: '9.5px', color: '#f59e0b', fontWeight: '700', marginTop: '2px' }}>🛡️ MDRRMO Vetted</div>
                </div>
              </div>
            </div>

            <div className="auth-grid-2">
              <div className="form-group">
                <label className="form-label">FIRST NAME</label>
                <input className="auth-input" type="text" placeholder="Juan"
                  value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">LAST NAME</label>
                <input className="auth-input" type="text" placeholder="Dela Cruz"
                  value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">EMAIL ADDRESS</label>
              <input className="auth-input" type="email" placeholder="you@resqlink.ph"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">ACTIVE MOBILE NUMBER (FOR RESCUERS)</label>
              <input className="auth-input" type="tel" placeholder="0917-XXX-XXXX"
                value={form.phone_number} onChange={e => set('phone_number', e.target.value)} required />
            </div>

            <div className="auth-grid-2">
              <div className="form-group">
                <label className="form-label">MUNICIPALITY</label>
                <select
                  className="auth-input"
                  value={form.municipality}
                  onChange={e => set('municipality', e.target.value)}
                  style={{ cursor: 'pointer', background: '#090d16', color: '#f8fafc' }}
                  required
                >
                  <option value="Porac">Porac, Pampanga</option>
                  <option value="Santa Rita">Santa Rita, Pampanga</option>
                  <option value="Guagua">Guagua, Pampanga</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">BARANGAY</label>
                <select
                  className="auth-input"
                  value={form.barangay}
                  onChange={e => set('barangay', e.target.value)}
                  style={{ cursor: 'pointer', background: '#090d16', color: '#f8fafc' }}
                  required
                >
                  {availableBarangays.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {form.role === 'responder' && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '14px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', marginBottom: '8px' }}>
                  🛡️ MDRRMO UNIT CREDENTIALS
                </div>
                <div className="auth-grid-2">
                  <div>
                    <label className="form-label">BADGE / ID NUMBER</label>
                    <input className="auth-input" type="text" placeholder="e.g. MDRRMO-POR-2026"
                      value={form.responder_badge_number} onChange={e => set('responder_badge_number', e.target.value)} required />
                  </div>
                  <div>
                    <label className="form-label">ASSIGNED UNIT / TEAM</label>
                    <input className="auth-input" type="text" placeholder="e.g. Ambulance Unit 01"
                      value={form.responder_unit} onChange={e => set('responder_unit', e.target.value)} required />
                  </div>
                </div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '6px' }}>
                  * Responders are placed in verification status until authorized by the {form.municipality} Admin.
                </div>
              </div>
            )}

            <div className="auth-grid-2">
              <div className="form-group">
                <label className="form-label">PASSWORD</label>
                <input className="auth-input" type="password" placeholder="Min. 6 chars"
                  value={form.password} onChange={e => set('password', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">CONFIRM PASSWORD</label>
                <input className="auth-input" type="password" placeholder="Repeat password"
                  value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} required />
              </div>
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Processing...' : (form.role === 'responder' ? 'Submit Responder Application' : 'Create Citizen Account (Instant SOS)')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
