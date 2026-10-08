import React, { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import UserHome from './pages/UserHome';
import AdminDashboard from './pages/AdminDashboard';
import SubAdminDashboard from './pages/SubAdminDashboard';
import ResponderPortal from './pages/ResponderPortal';
import api from './api';

const RESQLINK_TOKEN_KEY = 'resqlink_token';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    const token = localStorage.getItem(RESQLINK_TOKEN_KEY);
    if (!token) { setLoading(false); return; }

    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
      }
    } catch {
      localStorage.removeItem(RESQLINK_TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (userData, token, options = {}) => {
    if (token) {
      localStorage.setItem(RESQLINK_TOKEN_KEY, token);
    }
    setUser(userData);
    if (options?.justRegistered) {
      setJustRegistered(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(RESQLINK_TOKEN_KEY);
    setUser(null);
  };

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  const isSubAdmin = user && user.role === 'sub_admin';
  const isResponder = user && (user.role === 'responder' || user.role === 'pnp_responder' || user.role === 'bfp_responder' || user.role === 'mdrrmo_admin');

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b0f19 0%, #111827 50%, #1a0a0a 100%)',
        gap: '20px'
      }}>
        <div style={{ fontSize: '36px' }}>🚨</div>
        <div style={{
          color: '#ef4444', fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '22px', fontWeight: '800', letterSpacing: '2px'
        }}>
          RESQLINK
        </div>
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading Emergency Response System...</div>
        <div style={{
          width: '200px', height: '3px', background: '#1f2937',
          borderRadius: '2px', overflow: 'hidden'
        }}>
          <div style={{
            height: '100%', width: '60%', background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
            borderRadius: '2px', animation: 'shimmer 1.5s ease-in-out infinite'
          }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (isAdmin) {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  if (isSubAdmin) {
    return <SubAdminDashboard user={user} onLogout={handleLogout} />;
  }

  if (isResponder) {
    return <ResponderPortal user={user} onLogout={handleLogout} />;
  }

  return (
    <UserHome
      user={user}
      onLogout={handleLogout}
      onUserUpdate={(updatedUser) => setUser(updatedUser)}
      justRegistered={justRegistered}
    />
  );
}

