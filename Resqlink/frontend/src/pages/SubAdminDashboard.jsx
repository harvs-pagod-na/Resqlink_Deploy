import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { io } from 'socket.io-client';
import { RESQLINK_TOWN_CENTERS } from '../data/PampangaData';

const SOCKET_URL = typeof window !== 'undefined' 
  ? (window.location.port === '5173' ? window.location.origin : (import.meta.env.VITE_API_URL?.replace('/api', '') || `http://${window.location.hostname}:3000`))
  : 'http://localhost:3000';

const STATUS_COLOR = {
  Pending: '#f59e0b',
  Accepted: '#0ea5e9',
  'Responder Dispatched': '#818cf8',
  'En Route': '#10b981',
  Arrived: '#059669',
  Completed: '#10b981',
  Cancelled: '#64748b',
};

const SEVERITY_CONFIG = {
  Critical: { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)', glow: '0 0 12px rgba(244,63,94,0.4)' },
  High: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', glow: '0 0 10px rgba(249,115,22,0.3)' },
  Moderate: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', glow: 'none' },
  Low: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', glow: 'none' },
};

const EMERGENCY_ICONS = {
  Medical: '🚑',
  Fire: '🔥',
  'Flood/Disaster': '🌊',
  'Crime/Police': '🚔',
  Accident: '⚠️',
  Evacuation: '🏃',
  Other: '🚨',
};

const STATUS_FLOW = ['Pending', 'Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'Completed'];

// Custom Tactical Map Markers
const victimPin = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(244,63,94,0.3);animation:resqPulse 1.8s infinite;"></div>
    <div style="width:28px;height:28px;border-radius:50%;background:#f43f5e;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">🆘</div>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -20],
});

const responderPin = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(14,165,233,0.3);animation:resqPulse 2s infinite;"></div>
    <div style="width:30px;height:30px;border-radius:50%;background:#0ea5e9;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">⚡</div>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -22],
});

function MapFlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1.2 });
    }
  }, [lat, lng]);
  return null;
}

export default function SubAdminDashboard({ user, onLogout }) {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [responderPos, setResponderPos] = useState({ lat: '', lng: '' });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastInterval, setBroadcastInterval] = useState(null);
  const [simMode, setSimMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState('queue'); // queue | radar | chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date().toUTCString().slice(17, 25));

  // Audio Call state
  const [callStatus, setCallStatus] = useState('IDLE');
  const [isMuted, setIsMuted] = useState(false);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const socketRef = useRef(null);
  const simRef = useRef(null);
  const watchIdRef = useRef(null);
  const responderPosRef = useRef(responderPos);

  useEffect(() => {
    responderPosRef.current = responderPos;
  }, [responderPos]);

  // Live Military Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadRequests();
    initSocket();
    startGpsTracking();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (simRef.current) clearInterval(simRef.current);
      if (broadcastInterval) clearInterval(broadcastInterval);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Hardware GPS Telemetry Ingestion (Real device data for Sub-Admin / Rescuer)
  const startGpsTracking = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) };
        setResponderPos(coords);
      },
      (err) => {
        console.warn('[SubAdmin GPS Hardware Notice]:', err.message);
        const town = user?.profile?.city || 'Santa Rita';
        const fallback = RESQLINK_TOWN_CENTERS[town] || { lat: 14.9986, lng: 120.6186 };
        setResponderPos((prev) => (!prev.lat ? { lat: String(fallback.lat), lng: String(fallback.lng) } : prev));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) };
        setResponderPos(coords);
      },
      (err) => console.warn('[SubAdmin GPS Watch Notice]:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  };

  const initSocket = () => {
    const sock = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    const userHub = user?.profile?.city || (user?.email?.includes('porac') ? 'Porac' : user?.email?.includes('santarita') ? 'Santa Rita' : user?.email?.includes('guagua') ? 'Guagua' : null);
    sock.emit('join_user_room', { userId: user.id, role: 'sub_admin', hub: userHub });

    sock.on('new_rescue_request', (data) => {
      setRequests((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
      showNotification(`🚨 NEW SOS INCOMING: ${data.emergency_type} at ${data.address_location || 'GPS Pin'}`, 'alert');
    });

    sock.on('new_assignment_alert', (data) => {
      setRequests((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
      showNotification(`⚡ EMERGENCY ASSIGNED BY COMMAND: #${data.id} (${data.emergency_type}) in ${data.municipality || 'Sector'}`, 'alert');
      loadRequests();
    });

    sock.on('subadmin_confirmed_assignment', (data) => {
      loadRequests();
    });

    sock.on('responder_accepted_assignment', (data) => {
      showNotification(`✓ Unit ${data.responderName || 'Responder'} ACCEPTED Emergency #${data.incidentId}! Ready to dispatch.`, 'alert');
      loadRequests();
    });

    sock.on('update_rescue_status', (data) => {
      const rid = data.id || data?.dataValues?.id;
      setRequests((prev) => prev.map((r) => (r.id === rid ? { ...r, ...data } : r)));
      if (selected?.id === rid) setSelected((prev) => ({ ...prev, ...data }));
      loadRequests();
    });

    sock.on('rescue_completed', (data) => {
      const rid = data.id || data?.dataValues?.id;
      setRequests((prev) => prev.map((r) => (r.id === rid ? { ...r, ...data, status: 'Completed' } : r)));
      if (selected?.id === rid) setSelected((prev) => ({ ...prev, ...data, status: 'Completed' }));
      showNotification(`✓ Emergency #${rid || data?.id} safely RESOLVED and COMPLETED!`, 'success');
      loadRequests();
    });

    sock.on('emergency:status_change', (data) => {
      const rid = data.id || data?.dataValues?.id;
      setRequests((prev) => prev.map((r) => (r.id === rid ? { ...r, ...data } : r)));
      if (selected?.id === rid) setSelected((prev) => ({ ...prev, ...data }));
      loadRequests();
    });

    sock.on('resq_live_location', (data) => {
      if (selected && selected.id === data.request_id) {
        setSelected((prev) => ({
          ...prev,
          responder_lat: data.responder_lat,
          responder_lng: data.responder_lng,
          metrics: data.metrics,
        }));
      }
    });

    sock.on('receive_chat_message', ({ incidentId, message }) => {
      setChatMessages((prev) => [...prev, message]);
    });

    // WebRTC Signaling
    sock.on('webrtc_offer', async ({ sdp }) => {
      try {
        if (!localStreamRef.current) {
          localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerRef.current = pc;
        localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));

        pc.ontrack = (e) => {
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
        };
        pc.onicecandidate = (e) => {
          if (e.candidate && selected) {
            sock.emit('webrtc_ice_candidate', { incidentId: selected.id, candidate: e.candidate });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sock.emit('webrtc_answer', { incidentId: selected?.id, sdp: answer });
        setCallStatus('CONNECTED');
      } catch (err) {
        console.error('Call Error:', err);
      }
    });

    sock.on('webrtc_answer', async ({ sdp }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        setCallStatus('CONNECTED');
      }
    });

    sock.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      }
    });

    sock.on('webrtc_call_ended', () => {
      endVoiceCall();
    });
  };

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/resq/admin/all?status=all');
      if (res.data.success) {
        const all = res.data.requests || [];
        setRequests(all);
        if (!selected && all.length > 0) {
          const firstPending = all.find((r) => r.status === 'Pending') || all[0];
          selectIncident(firstPending);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const selectIncident = (r) => {
    setSelected(r);
    if (r.responder_lat && r.responder_lng && !isNaN(parseFloat(r.responder_lat)) && parseFloat(r.responder_lat) !== 0) {
      setResponderPos({ lat: String(r.responder_lat), lng: String(r.responder_lng) });
    } else {
      setResponderPos({ lat: '', lng: '' });
    }
    if (socketRef.current) {
      socketRef.current.emit('join_resq_room', r.id);
    }
  };

  const confirmAssignment = async (r) => {
    setConfirming(true);
    try {
      const res = await api.put(`/resq/confirm-subadmin/${r.id}`);
      if (res.data?.success) {
        setRequests((prev) => prev.map((req) => (req.id === r.id ? { ...req, ...res.data.request } : req)));
        setSelected((prev) => (prev?.id === r.id ? { ...prev, ...res.data.request } : prev));
        showNotification(`✓ Incident #${r.id} assignment confirmed! Admin & Citizen notified.`, 'success');
      }
    } catch (e) {
      showNotification(e.response?.data?.message || 'Failed to confirm assignment', 'error');
    } finally {
      setConfirming(false);
    }
  };

  const updateStatus = async (r, newStatus) => {
    setUpdatingId(r.id);
    const curLat = responderPos.lat || responderPosRef.current?.lat;
    const curLng = responderPos.lng || responderPosRef.current?.lng;

    try {
      const res = await api.put(`/resq/dispatch/${r.id}`, {
        status: newStatus,
        responder_name: r.responder_name || `${user?.profile?.first_name || 'Commander'} ${user?.profile?.last_name || 'Dispatcher'}`,
        responder_unit: r.responder_unit || 'Alpha Tactical Medic-01',
        responder_phone: r.responder_phone || user?.phone_number || '0917-111-9999',
        responder_lat: curLat || undefined,
        responder_lng: curLng || undefined,
      });
      if (res.data.success) {
        const updated = { ...r, ...res.data.request };
        setRequests((prev) => prev.map((req) => (req.id === r.id ? updated : req)));
        setSelected((prev) => (prev?.id === r.id ? updated : prev));
        showNotification(`Dispatched Incident #${r.id} -> ${newStatus.toUpperCase()}`, 'success');

        // Automatically manage continuous live GPS broadcast loop based on status
        if (['Accepted', 'Responder Dispatched', 'En Route'].includes(newStatus)) {
          if (!broadcasting && !simMode) {
            startBroadcasting(updated);
          }
        } else if (['Arrived', 'Completed', 'Resolved', 'Cancelled', 'Closed'].includes(newStatus)) {
          stopBroadcasting();
        }
      }
    } catch (e) {
      showNotification(e.response?.data?.message || 'Failed to dispatch', 'error');
    }
    setUpdatingId(null);
  };

  const startBroadcasting = (r) => {
    let lat = parseFloat(responderPos.lat || responderPosRef.current?.lat);
    let lng = parseFloat(responderPos.lng || responderPosRef.current?.lng);

    if (isNaN(lat) || isNaN(lng) || lat === 0) {
      const town = user?.profile?.city || r?.municipality || 'Santa Rita';
      const fallback = RESQLINK_TOWN_CENTERS[town] || { lat: 14.9986, lng: 120.6186 };
      lat = fallback.lat;
      lng = fallback.lng;
      setResponderPos({ lat: String(lat), lng: String(lng) });
    }

    setBroadcasting(true);
    const sock = socketRef.current;
    let ticks = 0;

    const emitLocation = () => {
      const curLat = parseFloat(responderPosRef.current?.lat || lat);
      const curLng = parseFloat(responderPosRef.current?.lng || lng);

      const payload = {
        request_id: r.id,
        user_id: r.user_id,
        role: 'responder',
        latitude: curLat,
        longitude: curLng,
        speed: 25.0,
        heading: 45,
        responder_lat: curLat,
        responder_lng: curLng,
        responder_unit: r.responder_unit || 'Alpha Tactical Medic-01',
        responder_name: r.responder_name || `${user?.profile?.first_name || 'Commander'} ${user?.profile?.last_name || 'Dispatcher'}`,
      };

      if (sock) {
        sock.emit('telemetry_ping', payload);
        sock.emit('update_responder_location', payload);
      }

      // Sync with database every 10 ticks (~15 seconds) so database coordinates stay updated
      ticks++;
      if (ticks % 10 === 0) {
        api.post(`/resq/update-location/${r.id}`, { responder_lat: curLat, responder_lng: curLng }).catch(() => {});
      }
    };

    emitLocation();
    const interval = setInterval(emitLocation, 1500);
    setBroadcastInterval(interval);
    showNotification('🛰️ 1Hz Real-Time Telemetry Stream Activated (Live to Admin & Citizen)', 'success');
  };

  const stopBroadcasting = () => {
    if (broadcastInterval) clearInterval(broadcastInterval);
    setBroadcastInterval(null);
    setBroadcasting(false);
    setSimMode(false);
    if (simRef.current) clearInterval(simRef.current);
    showNotification('Telemetry Broadcast paused.', 'info');
  };

  const startSimulation = (r) => {
    if (!r.latitude || !r.longitude) return;
    setSimMode(true);
    const targetLat = parseFloat(r.latitude);
    const targetLng = parseFloat(r.longitude);
    let curLat = parseFloat(responderPos.lat) || targetLat + 0.012;
    let curLng = parseFloat(responderPos.lng) || targetLng + 0.012;

    const sock = socketRef.current;
    simRef.current = setInterval(() => {
      curLat = curLat + (targetLat - curLat) * 0.14;
      curLng = curLng + (targetLng - curLng) * 0.14;
      setResponderPos({ lat: curLat.toFixed(6), lng: curLng.toFixed(6) });

      const payload = {
        request_id: r.id,
        user_id: r.user_id,
        role: 'responder',
        latitude: curLat,
        longitude: curLng,
        speed: 13.8,
        heading: 90,
        responder_lat: curLat,
        responder_lng: curLng,
        responder_unit: r.responder_unit || 'Medic Alpha Unit',
      };
      sock.emit('telemetry_ping', payload);
      sock.emit('update_responder_location', payload);

      const dist = Math.sqrt(Math.pow(curLat - targetLat, 2) + Math.pow(curLng - targetLng, 2));
      if (dist < 0.0004) {
        clearInterval(simRef.current);
        setSimMode(false);
        setBroadcasting(false);
        showNotification('Responder arrived at exact incident spot!', 'success');
      }
    }, 1200);
    setBroadcasting(true);
    showNotification('Autonomous Dispatch Path Tracking Active', 'success');
  };

  // Voice Call
  const startVoiceCall = async () => {
    if (!selected) return;
    try {
      setCallStatus('CALLING');
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerRef.current = pc;
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));

      pc.ontrack = (e) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit('webrtc_ice_candidate', { incidentId: selected.id, candidate: e.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit('webrtc_offer', { incidentId: selected.id, sdp: offer });
      socketRef.current.emit('admin_enable_call_permission', { incidentId: selected.id });
    } catch (err) {
      console.error(err);
      setCallStatus('IDLE');
    }
  };

  const endVoiceCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (selected && socketRef.current) {
      socketRef.current.emit('webrtc_end_call', { incidentId: selected.id });
    }
    setCallStatus('IDLE');
  };

  const sendChat = () => {
    if (!chatInput.trim() || !selected) return;
    socketRef.current.emit('send_chat_message', {
      incidentId: selected.id,
      sender: 'COMMAND_NOC',
      text: chatInput.trim(),
    });
    setChatInput('');
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === 'pending') return r.status === 'Pending';
    if (filter === 'active') return ['Pending', 'Assigned', 'Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'On Scene'].includes(r.status);
    if (filter === 'resolved' || filter === 'history') return ['Completed', 'Resolved', 'Cancelled', 'Closed'].includes(r.status);
    return true;
  }).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.emergency_type?.toLowerCase().includes(q) ||
      r.address_location?.toLowerCase().includes(q) ||
      r.requester?.profile?.first_name?.toLowerCase().includes(q)
    );
  });

  const kpis = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'Pending').length,
    enroute: requests.filter((r) => ['En Route', 'Accepted', 'Responder Dispatched'].includes(r.status)).length,
    completed: requests.filter((r) => ['Completed', 'Resolved', 'Closed'].includes(r.status)).length,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#070a13', color: '#f8fafc', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      
      {/* Global Embedded Styles for Animation & Glassmorphism */}
      <style>{`
        @keyframes resqPulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes radarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .glass-panel {
          background: rgba(13, 18, 36, 0.75);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }
        .glass-card {
          background: rgba(18, 26, 48, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          border-color: rgba(14, 165, 233, 0.3);
          transform: translateY(-1px);
        }
        .glass-card.selected {
          border-color: #0ea5e9;
          background: rgba(14, 165, 233, 0.08);
          box-shadow: 0 0 20px rgba(14, 165, 233, 0.15);
        }
        .tactical-btn {
          background: #0ea5e9;
          color: #ffffff;
          border: none;
          font-weight: 700;
          font-size: 11.5px;
          letter-spacing: 0.5px;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tactical-btn:hover:not(:disabled) {
          background: #0284c7;
          box-shadow: 0 0 14px rgba(14, 165, 233, 0.4);
        }
        .tactical-btn.danger {
          background: #f43f5e;
        }
        .tactical-btn.danger:hover:not(:disabled) {
          background: #e11d48;
          box-shadow: 0 0 14px rgba(244, 63, 94, 0.4);
        }
        .tactical-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .filter-chip {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-size: 11.5px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-chip.active {
          background: rgba(14, 165, 233, 0.15);
          border-color: #0ea5e9;
          color: #38bdf8;
        }
        .dark-tiles {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
        .mono-text {
          font-family: 'JetBrains Mono', monospace, sans-serif;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
      `}</style>

      {/* TOP TACTICAL COMMAND HEADER */}
      <header style={{
        height: '60px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(7, 10, 19, 0.9)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '2px', color: '#f8fafc' }}>
              RESQLINK<span style={{ color: '#0ea5e9' }}>.NOC</span>
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
            TACTICAL DISPATCH ENGINE
          </span>
        </div>

        {/* Real-time telemetry indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>SYS CLOCK</span>
            <span className="mono-text" style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8' }}>{currentTime} UTC</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(244,63,94,0.1)', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(244,63,94,0.3)' }}>
            <span style={{ fontSize: '10px', color: '#f43f5e', fontWeight: '800' }}>PENDING ALERTS</span>
            <span className="mono-text" style={{ fontSize: '13px', fontWeight: '900', color: '#f43f5e' }}>{kpis.pending}</span>
          </div>

          <button onClick={onLogout} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8',
            borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
          }}>
            LOGOUT
          </button>
        </div>
      </header>

      {/* TACTICAL KPI METRIC STRIP */}
      <div style={{ padding: '16px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'TOTAL RECORDED SOS', val: kpis.total, icon: '📊', color: '#0ea5e9' },
          { label: 'PENDING TRIAGE', val: kpis.pending, icon: '🚨', color: '#f43f5e' },
          { label: 'ACTIVE RESPONSE FORCES', val: kpis.enroute, icon: '⚡', color: '#f59e0b' },
          { label: 'SUCCESSFUL RESOLUTIONS', val: kpis.completed, icon: '✅', color: '#10b981' },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px' }}>{kpi.label}</div>
              <div className="mono-text" style={{ fontSize: '22px', fontWeight: '900', color: kpi.color, marginTop: '2px' }}>{kpi.val}</div>
            </div>
            <span style={{ fontSize: '24px', opacity: 0.8 }}>{kpi.icon}</span>
          </div>
        ))}
      </div>

      {/* MAIN SPLIT DISPATCH DECK */}
      <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '440px 1fr', gap: '16px', height: 'calc(100vh - 170px)' }}>
        
        {/* LEFT PANE: LIVE INCIDENT COMMAND QUEUE */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Queue Filter Bar */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: '#cbd5e1' }}>
                INCIDENT DISPATCH STREAM
              </span>
              <button onClick={loadRequests} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                ↻ SYNC QUEUE
              </button>
            </div>

            <input
              type="text"
              placeholder="Search category, location, citizen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                padding: '8px 12px', borderRadius: '6px', color: '#f8fafc', fontSize: '12px', outline: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                className={`filter-chip ${filter === 'active' ? 'active' : ''}`}
                onClick={() => setFilter('active')}
              >
                ⚡ ACTIVE ({requests.filter(r => ['Pending', 'Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'On Scene'].includes(r.status)).length})
              </button>
              <button
                className={`filter-chip ${filter === 'pending' ? 'active' : ''}`}
                onClick={() => setFilter('pending')}
              >
                🚨 PENDING ({requests.filter(r => r.status === 'Pending').length})
              </button>
              <button
                className={`filter-chip ${filter === 'resolved' ? 'active' : ''}`}
                onClick={() => setFilter('resolved')}
              >
                📁 ARCHIVED ({requests.filter(r => ['Completed', 'Resolved', 'Cancelled', 'Closed'].includes(r.status)).length})
              </button>
              <button
                className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                ALL
              </button>
            </div>
          </div>

          {/* Queue Scroll List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '12px' }}>
                No emergency reports matching current filters.
              </div>
            ) : (
              filteredRequests.map((r) => {
                const sev = SEVERITY_CONFIG[r.severity_level] || SEVERITY_CONFIG.Moderate;
                const isSel = selected?.id === r.id;

                return (
                  <div
                    key={r.id}
                    className={`glass-card ${isSel ? 'selected' : ''}`}
                    onClick={() => selectIncident(r)}
                    style={{ padding: '12px 14px', cursor: 'pointer', position: 'relative' }}
                  >
                    {/* Severity Ribbon Indicator */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
                      background: sev.color, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px',
                      boxShadow: sev.glow
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginLeft: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{EMERGENCY_ICONS[r.emergency_type] || '🚨'}</span>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: '#f8fafc' }}>
                            {r.emergency_type.toUpperCase()}
                          </div>
                          <div className="mono-text" style={{ fontSize: '10px', color: '#64748b' }}>
                            #{r.id} • {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <span style={{
                          fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                          background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`
                        }}>
                          {r.severity_level}
                        </span>
                        <span style={{
                          fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.06)', color: STATUS_COLOR[r.status] || '#cbd5e1'
                        }}>
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Location & Details */}
                    <div style={{ marginLeft: '6px', marginTop: '8px', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
                        <span>📍</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.address_location || `${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}`}
                        </span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px' }}>
                        Reporter: <b style={{ color: '#cbd5e1' }}>{r.requester?.profile?.first_name || 'Citizen'} {r.requester?.profile?.last_name || ''}</b> ({r.contact_number || r.requester?.phone_number || 'N/A'})
                      </div>
                    </div>

                    {/* Action button if not confirmed yet */}
                    {!r.subadmin_confirmed_at && (r.status === 'Assigned' || r.status === 'Pending') && (
                      <div style={{ marginLeft: '6px', marginTop: '10px' }}>
                        <button
                          className="tactical-btn"
                          style={{
                            width: '100%', justifyContent: 'center',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            boxShadow: '0 0 10px rgba(16,185,129,0.3)',
                            fontSize: '11px', padding: '8px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmAssignment(r);
                          }}
                        >
                          ⚡ CONFIRM ASSIGNMENT
                        </button>
                      </div>
                    )}

                    {r.status === 'Pending' && r.subadmin_confirmed_at && (
                      <div style={{ marginLeft: '6px', marginTop: '10px' }}>
                        <button
                          className="tactical-btn danger"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(r, 'Accepted');
                          }}
                        >
                          ⚡ INSTANT ACCEPT & DISPATCH
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: MISSION RADAR, TELEMETRY & TACTICAL OPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          
          {selected ? (
            <>
              {/* Selected Incident HUD Action Banner */}
              <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc' }}>
                      INCIDENT #{selected.id}: {selected.emergency_type.toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                      background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)'
                    }}>
                      STATE: {selected.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="mono-text" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                    GPS: {selected.latitude}, {selected.longitude} • Callback: {selected.contact_number || selected.requester?.phone_number || 'N/A'}
                  </div>
                </div>

                {/* Status Transition Control Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {STATUS_FLOW.map((st) => (
                    <button
                      key={st}
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected, st)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer',
                        background: selected.status === st ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                        border: selected.status === st ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.08)',
                        color: selected.status === st ? '#ffffff' : '#94a3b8',
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignment Confirmation Action Bar */}
              {!selected.subadmin_confirmed_at ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.15))',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '14px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>⚠️</span>
                      <span>EMERGENCY ASSIGNED TO YOUR SECTOR • CONFIRMATION REQUIRED</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>
                      Command Admin assigned this emergency to your sector. Confirming triggers real-time alerts to both Admin and Citizen.
                    </div>
                  </div>
                  <button
                    onClick={() => confirmAssignment(selected)}
                    disabled={confirming}
                    className="tactical-btn"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      padding: '12px 22px',
                      fontWeight: '900',
                      fontSize: '12.5px',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                      whiteSpace: 'nowrap',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {confirming ? 'CONFIRMING...' : '⚡ CONFIRM ASSIGNMENT (NOTIFY ALL)'}
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '16px' }}>✅</span>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#10b981', fontWeight: '800' }}>
                      ASSIGNMENT CONFIRMED BY SECTOR DISPATCH
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      Receipt confirmed at {new Date(selected.subadmin_confirmed_at).toLocaleTimeString()}. Admin and Citizen notified.
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Telemetry Metric Strip */}
              {selected.metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div className="glass-panel" style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>DISTANCE TO SCENE</div>
                    <div className="mono-text" style={{ fontSize: '16px', fontWeight: '900', color: '#0ea5e9' }}>
                      {selected.metrics.distanceKm ? `${selected.metrics.distanceKm} km` : `${selected.metrics.distanceMeters || 0} m`}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>CALCULATED ETA</div>
                    <div className="mono-text" style={{ fontSize: '16px', fontWeight: '900', color: '#10b981' }}>
                      {selected.metrics.etaMinutes ? `~${selected.metrics.etaMinutes} min` : `${selected.metrics.etaSeconds || 0} sec`}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>TELEMETRY STREAM</div>
                    <div className="mono-text" style={{ fontSize: '16px', fontWeight: '900', color: '#f59e0b' }}>
                      1Hz ACTIVE
                    </div>
                  </div>
                </div>
              )}

              {/* Attached Incident Media if available */}
              {selected.photo_url && (
                <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={selected.photo_url.startsWith('http') || selected.photo_url.startsWith('/uploads') ? selected.photo_url : `/uploads/${selected.photo_url}`}
                      alt="Incident media"
                      style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #333' }}
                    />
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>ATTACHED CITIZEN INCIDENT PHOTO</div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Visual evidence uploaded from scene.</div>
                    </div>
                  </div>
                  <a
                    href={selected.photo_url.startsWith('http') || selected.photo_url.startsWith('/uploads') ? selected.photo_url : `/uploads/${selected.photo_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tactical-btn"
                    style={{ fontSize: '10.5px', padding: '6px 12px', background: 'rgba(14,165,233,0.15)', border: '1px solid #0ea5e9', color: '#0ea5e9' }}
                  >
                    🔍 VIEW FULL PHOTO
                  </a>
                </div>
              )}

              {/* Tactical Interactive Map */}
              <div className="glass-panel" style={{ flex: 1, minHeight: '260px', overflow: 'hidden', position: 'relative' }}>
                {selected.latitude && selected.longitude && (
                  <MapContainer
                    center={[parseFloat(selected.latitude), parseFloat(selected.longitude)]}
                    zoom={15}
                    style={{ height: '100%', width: '100%', background: '#090d16' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                      className="dark-tiles"
                    />
                    {/* Victim Marker */}
                    <Marker position={[parseFloat(selected.latitude), parseFloat(selected.longitude)]} icon={victimPin}>
                      <Popup>
                        <b>Emergency #{selected.id}</b><br />
                        {selected.address_location}
                      </Popup>
                    </Marker>

                    {/* Responder Live GPS Marker (Only if actual GPS coordinates exist) */}
                    {selected.responder_lat && selected.responder_lng && !isNaN(parseFloat(selected.responder_lat)) && !isNaN(parseFloat(selected.responder_lng)) && parseFloat(selected.responder_lat) !== 0 ? (
                      <>
                        <Marker position={[parseFloat(selected.responder_lat), parseFloat(selected.responder_lng)]} icon={responderPin}>
                          <Popup>
                            <b>{selected.responder_unit || 'Responder Unit'}</b><br />
                            Speed: {selected.metrics?.speedKmh || selected.speed || 0} km/h
                          </Popup>
                        </Marker>
                        <Polyline
                          positions={[
                            [parseFloat(selected.responder_lat), parseFloat(selected.responder_lng)],
                            [parseFloat(selected.latitude), parseFloat(selected.longitude)],
                          ]}
                          pathOptions={{ color: '#0ea5e9', weight: 2, dashArray: '6,6' }}
                        />
                        <MapFlyTo lat={parseFloat(selected.responder_lat)} lng={parseFloat(selected.responder_lng)} />
                      </>
                    ) : (
                      <MapFlyTo lat={parseFloat(selected.latitude)} lng={parseFloat(selected.longitude)} />
                    )}
                  </MapContainer>
                )}
              </div>

              {/* Bottom Operational Controls: Voice Call & Simulation */}
              <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                
                {/* Voice Call Controller */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>AUDIO COMMS:</span>
                  {callStatus === 'IDLE' ? (
                    <button className="tactical-btn" onClick={startVoiceCall}>
                      📞 1. INITIATE RADIO CALL
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="mono-text" style={{ fontSize: '11px', color: '#10b981', alignSelf: 'center' }}>
                        ● {callStatus}
                      </span>
                      <button className="tactical-btn danger" onClick={endVoiceCall}>
                        END CALL
                      </button>
                    </div>
                  )}
                  <audio ref={remoteAudioRef} autoPlay />
                </div>

                {/* GPS Telemetry Simulation / Broadcast Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {broadcasting && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(16,185,129,0.15)',
                      border: '1px solid rgba(16,185,129,0.4)',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#10b981'
                    }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                      <span>STREAMING LIVE TO CITIZEN & ADMIN (1Hz)</span>
                    </div>
                  )}
                  {!broadcasting ? (
                    <>
                      <button className="tactical-btn" onClick={() => startBroadcasting(selected)}>
                        📡 BROADCAST 1Hz TELEMETRY
                      </button>
                      <button className="tactical-btn" style={{ background: '#10b981' }} onClick={() => startSimulation(selected)}>
                        🚗 SIMULATE EN-ROUTE PATH
                      </button>
                    </>
                  ) : (
                    <button className="tactical-btn danger" onClick={stopBroadcasting}>
                      ⏹ STOP BROADCAST
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '36px' }}>🛡️</span>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>
                SELECT AN INCIDENT FROM QUEUE TO ENGAGE COMMAND RADAR
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Floating Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          background: 'rgba(13, 18, 36, 0.95)', border: '1px solid #0ea5e9',
          padding: '12px 18px', borderRadius: '8px', color: '#f8fafc',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontSize: '12.5px', fontWeight: '700'
        }}>
          {notification.msg}
        </div>
      )}

    </div>
  );
}
