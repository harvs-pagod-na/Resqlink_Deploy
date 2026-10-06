import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { io } from 'socket.io-client';
import { RESQLINK_TOWN_CENTERS } from '../data/PampangaData';
import { EmergencyBadges, CriticalBadge, CriticalWarningLogo, getIncidentEmergencies, EmergencyStatusTracker, EMERGENCY_STATUS_STEPS, RESCUE_DEPARTMENTS, mapEmergencyCategoriesToDepartments } from '../utils/emergencyHelper';

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

  // Dedicated Rescue Stage Progression & Manual Override State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideTargetStatus, setOverrideTargetStatus] = useState('Accepted');
  const [overrideReason, setOverrideReason] = useState('');
  const [applyingOverride, setApplyingOverride] = useState(false);

  // Dispatch Unit Assignment Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchingUnit, setDispatchingUnit] = useState(false);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [loadingResponders, setLoadingResponders] = useState(false);
  const [dispatchUnitForm, setDispatchUnitForm] = useState({
    assigned_department: '',
    assigned_responder_id: null,
    responder_name: '',
    responder_unit: '',
    responder_phone: '',
    dispatcher_notes: '',
  });

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

  const updateStatus = async (r, newStatus, extraData = {}) => {
    setUpdatingId(r.id);
    const curLat = responderPos.lat || responderPosRef.current?.lat;
    const curLng = responderPos.lng || responderPosRef.current?.lng;

    try {
      const res = await api.put(`/resq/dispatch/${r.id}`, {
        status: newStatus,
        responder_name: extraData.responder_name || r.responder_name || `${user?.profile?.first_name || 'Commander'} ${user?.profile?.last_name || 'Dispatcher'}`,
        responder_unit: extraData.responder_unit || r.responder_unit || 'Alpha Tactical Medic-01',
        responder_phone: extraData.responder_phone || r.responder_phone || user?.phone_number || '0917-111-9999',
        responder_lat: curLat || undefined,
        responder_lng: curLng || undefined,
        ...extraData,
      });
      if (res.data.success) {
        const updated = { ...r, ...res.data.request };
        setRequests((prev) => prev.map((req) => (req.id === r.id ? updated : req)));
        setSelected((prev) => (prev?.id === r.id ? updated : prev));
        showNotification(`Incident #${r.id} -> ${newStatus.toUpperCase()}`, 'success');

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

  const openDispatchModal = async (inc) => {
    const cats = getIncidentEmergencies(inc);
    const depts = mapEmergencyCategoriesToDepartments(cats);
    const primaryDept = depts[0] || 'Medical';
    const sector = inc.assigned_sector || inc.municipality || user?.profile?.city || 'Santa Rita';

    setDispatchUnitForm({
      assigned_department: depts.join(', '),
      assigned_responder_id: inc.assigned_responder_id || null,
      responder_name: inc.responder_name || (primaryDept === 'Fire' ? 'BFP Santa Rita Engine 1' : primaryDept === 'Police' ? 'PNP Mobile Unit Alpha' : 'MDRRMO Quick Response Team'),
      responder_unit: inc.responder_unit || (primaryDept === 'Fire' ? 'BFP-PUMPER-01' : primaryDept === 'Police' ? 'PNP-PATROL-04' : 'MEDIC-AMBULANCE-01'),
      responder_phone: inc.responder_phone || '0917-555-0199',
      dispatcher_notes: inc.dispatcher_notes || `Rapid tactical dispatch authorized for ${cats.join(', ')} incident in ${sector}.`,
    });
    setShowDispatchModal(true);

    setLoadingResponders(true);
    try {
      const res = await api.get(`/resq/responders?municipality=${sector}&department=all`);
      if (res.data?.success && res.data.responders) {
        setAvailableResponders(res.data.responders);
      }
    } catch (err) {
      console.warn('Could not fetch responders:', err.message);
    } finally {
      setLoadingResponders(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!selected) return;
    setDispatchingUnit(true);
    try {
      const curLat = responderPos.lat || responderPosRef.current?.lat;
      const curLng = responderPos.lng || responderPosRef.current?.lng;
      const res = await api.put(`/resq/dispatch/${selected.id}`, {
        status: 'Responder Dispatched',
        assigned_department: dispatchUnitForm.assigned_department,
        assigned_responder_id: dispatchUnitForm.assigned_responder_id,
        responder_name: dispatchUnitForm.responder_name,
        responder_unit: dispatchUnitForm.responder_unit,
        responder_phone: dispatchUnitForm.responder_phone,
        dispatcher_notes: dispatchUnitForm.dispatcher_notes,
        responder_lat: curLat || undefined,
        responder_lng: curLng || undefined,
      });
      if (res.data?.success) {
        const updated = { ...selected, ...res.data.request };
        setRequests((prev) => prev.map((req) => (req.id === selected.id ? updated : req)));
        setSelected(updated);
        setShowDispatchModal(false);
        showNotification(`🚀 Responder Unit Dispatched to Emergency #${selected.id}!`, 'success');
        startBroadcasting(updated);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to dispatch responder', 'error');
    } finally {
      setDispatchingUnit(false);
    }
  };

  const handleApplyOverride = async () => {
    if (!selected || !overrideTargetStatus) return;
    setApplyingOverride(true);
    try {
      const curLat = responderPos.lat || responderPosRef.current?.lat;
      const curLng = responderPos.lng || responderPosRef.current?.lng;
      const res = await api.put(`/resq/dispatch/${selected.id}`, {
        status: overrideTargetStatus,
        manual_override: true,
        override_reason: overrideReason || 'Manual Stage Override executed by Duty Dispatcher',
        dispatcher_notes: overrideReason ? `[MANUAL OVERRIDE]: ${overrideReason}` : selected.dispatcher_notes,
        responder_lat: curLat || undefined,
        responder_lng: curLng || undefined,
      });
      if (res.data?.success) {
        const updated = { ...selected, ...res.data.request };
        setRequests((prev) => prev.map((req) => (req.id === selected.id ? updated : req)));
        setSelected(updated);
        setShowOverrideModal(false);
        setOverrideReason('');
        showNotification(`✓ Incident #${selected.id} manually transitioned to ${overrideTargetStatus.toUpperCase()}!`, 'success');

        if (['Responder Dispatched', 'En Route'].includes(overrideTargetStatus)) {
          if (!broadcasting && !simMode) startBroadcasting(updated);
        } else if (['Arrived', 'Completed', 'Resolved', 'Cancelled', 'Closed'].includes(overrideTargetStatus)) {
          stopBroadcasting();
        }
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to apply manual override', 'error');
    } finally {
      setApplyingOverride(false);
    }
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

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginLeft: '6px' }}>
                      <CriticalWarningLogo size={36} style={{ marginTop: '2px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="mono-text" style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>
                                #{r.id}
                              </span>
                              <span className="mono-text" style={{ fontSize: '10px', color: '#94a3b8' }}>
                                • {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <EmergencyBadges incident={r} size="small" />
                          </div>

                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                            <CriticalBadge size="small" />
                            <span style={{
                              fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                              background: 'rgba(255,255,255,0.06)', color: STATUS_COLOR[r.status] || '#cbd5e1'
                            }}>
                              {r.status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Location & Details */}
                        <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
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

                        {/* Step-by-Step Status Tracker */}
                        <div style={{ marginTop: '8px' }}>
                          <EmergencyStatusTracker incident={r} compact={true} />
                        </div>
                      </div>
                    </div>

                    {/* Action button if not accepted yet */}
                    {!r.subadmin_confirmed_at && (r.status === 'Assigned' || r.status === 'Pending') && (
                      <div style={{ marginLeft: '6px', marginTop: '10px' }}>
                        <button
                          className="tactical-btn"
                          style={{
                            width: '100%', justifyContent: 'center',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            boxShadow: '0 0 10px rgba(16,185,129,0.3)',
                            fontSize: '11px', padding: '8px', fontWeight: '800'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmAssignment(r);
                          }}
                        >
                          ⚡ ACCEPT EMERGENCY RESPONSIBILITY
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
              {/* Step-by-Step Emergency Status Tracker */}
              <div className="glass-panel" style={{ padding: '14px 18px' }}>
                <EmergencyStatusTracker incident={selected} />
              </div>

              {/* Selected Incident HUD Action Banner */}
              <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CriticalWarningLogo size={42} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc' }}>
                        INCIDENT #{selected.id}
                      </span>
                      <EmergencyBadges incident={selected} size="medium" />
                      <CriticalBadge size="small" />
                      <span style={{
                        fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                        background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)'
                      }}>
                        STATE: {selected.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mono-text" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>
                      GPS: {selected.latitude}, {selected.longitude} • Callback: {selected.contact_number || selected.requester?.phone_number || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Dedicated Contextual Rescue Stage Controller (Prompt Section 8, 9, 13) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Contextual Action Button based on Current Stage */}
                  {(selected.status === 'Pending' || selected.status === 'Assigned') && (
                    <button
                      disabled={confirming || updatingId === selected.id}
                      onClick={() => confirmAssignment(selected)}
                      className="tactical-btn"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        boxShadow: '0 0 16px rgba(16,185,129,0.4)',
                        padding: '8px 16px', fontSize: '11.5px', fontWeight: '900', color: '#fff'
                      }}
                    >
                      {confirming ? 'ACCEPTING...' : '⚡ ACCEPT EMERGENCY'}
                    </button>
                  )}

                  {selected.status === 'Accepted' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => openDispatchModal(selected)}
                      className="tactical-btn"
                      style={{
                        background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                        boxShadow: '0 0 16px rgba(129,140,248,0.4)',
                        padding: '8px 16px', fontSize: '11.5px', fontWeight: '900', color: '#fff'
                      }}
                    >
                      🚀 DISPATCH RESPONDER
                    </button>
                  )}

                  {selected.status === 'Responder Dispatched' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected, 'En Route')}
                      className="tactical-btn"
                      style={{
                        background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                        boxShadow: '0 0 16px rgba(14,165,233,0.4)',
                        padding: '8px 16px', fontSize: '11.5px', fontWeight: '900', color: '#fff'
                      }}
                    >
                      🚗 MARK EN ROUTE
                    </button>
                  )}

                  {selected.status === 'En Route' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected, 'Arrived')}
                      className="tactical-btn"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        boxShadow: '0 0 16px rgba(16,185,129,0.4)',
                        padding: '8px 16px', fontSize: '11.5px', fontWeight: '900', color: '#fff'
                      }}
                    >
                      📍 MARK ARRIVED
                    </button>
                  )}

                  {selected.status === 'Arrived' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected, 'Completed')}
                      className="tactical-btn"
                      style={{
                        background: 'linear-gradient(135deg, #059669, #047857)',
                        boxShadow: '0 0 16px rgba(5,150,105,0.4)',
                        padding: '8px 16px', fontSize: '11.5px', fontWeight: '900', color: '#fff'
                      }}
                    >
                      ✅ COMPLETE RESCUE
                    </button>
                  )}

                  {(selected.status === 'Completed' || selected.status === 'Resolved' || selected.status === 'Closed') && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '6px',
                      background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                      color: '#10b981', fontSize: '11px', fontWeight: '900'
                    }}>
                      <span>✓</span>
                      <span>OPERATION COMPLETED</span>
                    </div>
                  )}

                  {/* Controlled Manual Stage Override */}
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideTargetStatus(selected.status);
                      setShowOverrideModal(true);
                    }}
                    className="tactical-btn"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#cbd5e1',
                      padding: '8px 12px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}
                    title="Manually override rescue stage when GPS is offline or unconfirmed"
                  >
                    ⚙️ MANUAL STAGE OVERRIDE
                  </button>
                </div>
              </div>

              {/* Assignment Confirmation Action Bar */}
              {!selected.subadmin_confirmed_at ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.18), rgba(245, 158, 11, 0.18))',
                  border: '1.5px solid #f43f5e',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 0 25px rgba(244,63,94,0.25)'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🚨</span>
                      <span>YOU HAVE BEEN ASSIGNED TO MANAGE THIS EMERGENCY</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '4px' }}>
                      Command Admin assigned this incident to you. Accept emergency responsibility to update status to <b>ACCEPTED</b> and mobilize response units.
                    </div>
                  </div>
                  <button
                    onClick={() => confirmAssignment(selected)}
                    disabled={confirming}
                    className="tactical-btn"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      padding: '12px 24px',
                      fontWeight: '900',
                      fontSize: '13px',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                      whiteSpace: 'nowrap',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {confirming ? 'ACCEPTING...' : '⚡ ACCEPT EMERGENCY RESPONSIBILITY'}
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
                      EMERGENCY RESPONSIBILITY ACCEPTED BY DISPATCHER
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      Accepted at {new Date(selected.subadmin_confirmed_at).toLocaleTimeString()}. Admin & Citizen notified in real-time.
                    </div>
                  </div>
                </div>
              )}

              {/* Incident Tactical Dossier Card */}
              <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', letterSpacing: '1px' }}>
                    TACTICAL INCIDENT DOSSIER • #{selected.id}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                    Time of SOS: <b style={{ color: '#cbd5e1' }}>{new Date(selected.reported_at || selected.createdAt).toLocaleString()}</b>
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><b>Citizen Name:</b> <span style={{ color: '#cbd5e1' }}>{selected.requester?.profile?.first_name || 'Citizen'} {selected.requester?.profile?.last_name || ''}</span></div>
                    <div><b>Citizen Contact:</b> <a href={`tel:${selected.contact_number || selected.requester?.phone_number}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '700' }}>{selected.contact_number || selected.requester?.phone_number || 'N/A'}</a></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <b>Emergency Categories:</b> <EmergencyBadges incident={selected} size="small" />
                    </div>
                    <div><b>Location:</b> <span style={{ color: '#cbd5e1' }}>{selected.address_location || 'GPS Captured'}</span></div>
                    <div className="mono-text" style={{ fontSize: '11px', color: '#64748b' }}>GPS: {selected.latitude}, {selected.longitude}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><b>Assigned Department:</b> <span style={{ color: '#38bdf8', fontWeight: '700' }}>{selected.assigned_department || selected.target_agency || 'Rescue Services'}</span></div>
                    <div><b>Assigned Responder / Commander:</b> <span style={{ color: '#cbd5e1' }}>{selected.responder_name || 'Awaiting unit dispatch'}</span></div>
                    <div><b>Response Unit ID / Vehicle:</b> <span style={{ color: '#cbd5e1' }}>{selected.responder_unit || 'Awaiting rollout'}</span></div>
                    <div><b>Responder Contact Number:</b> <span style={{ color: '#cbd5e1' }}>{selected.responder_phone || 'N/A'}</span></div>
                    <div><b>Current Emergency Status:</b> <span style={{ fontWeight: '800', color: STATUS_COLOR[selected.status] || '#10b981' }}>{selected.status.toUpperCase()}</span></div>
                  </div>
                </div>

                {selected.dispatcher_notes && (
                  <div style={{ marginTop: '4px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '11.5px' }}>
                    <b style={{ color: '#94a3b8' }}>Dispatcher Tactical Notes:</b> <span style={{ color: '#cbd5e1' }}>{selected.dispatcher_notes}</span>
                  </div>
                )}

                {/* Sequential Next-Stage Action Bar */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {selected.status === 'Accepted' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => openDispatchModal(selected)}
                      className="tactical-btn"
                      style={{
                        flex: 1, justifyContent: 'center', padding: '10px', fontSize: '12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        boxShadow: '0 0 15px rgba(16,185,129,0.4)',
                        fontWeight: '900'
                      }}
                    >
                      🚀 DISPATCH RESPONDER UNIT (AUTHORIZE ROLLOUT)
                    </button>
                  )}
                  {selected.status === 'Responder Dispatched' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected, 'En Route')}
                      className="tactical-btn"
                      style={{
                        flex: 1, justifyContent: 'center', padding: '10px', fontSize: '12px',
                        background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                        boxShadow: '0 0 15px rgba(14,165,233,0.4)',
                        fontWeight: '900'
                      }}
                    >
                      🚗 CONFIRM EN ROUTE (UNITS IN TRANSIT)
                    </button>
                  )}
                  {selected.status === 'En Route' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected, 'Arrived')}
                      className="tactical-btn"
                      style={{
                        flex: 1, justifyContent: 'center', padding: '10px', fontSize: '12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        boxShadow: '0 0 15px rgba(16,185,129,0.4)',
                        fontWeight: '900'
                      }}
                    >
                      📍 CONFIRM ARRIVED ON SCENE
                    </button>
                  )}
                  {selected.status === 'Arrived' && (
                    <button
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected, 'Completed')}
                      className="tactical-btn"
                      style={{
                        flex: 1, justifyContent: 'center', padding: '10px', fontSize: '12px',
                        background: 'linear-gradient(135deg, #059669, #047857)',
                        boxShadow: '0 0 15px rgba(5,150,105,0.4)',
                        fontWeight: '900'
                      }}
                    >
                      ✅ COMPLETE EMERGENCY RESPONSE (ARCHIVE)
                    </button>
                  )}
                </div>
              </div>

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

                    {/* Responder Live GPS Marker (renders whenever coordinates exist or status is dispatched/en route/arrived) */}
                    {(() => {
                      const effLat = (selected.responder_lat && !isNaN(parseFloat(selected.responder_lat)) && parseFloat(selected.responder_lat) !== 0)
                        ? parseFloat(selected.responder_lat)
                        : (['Responder Dispatched', 'En Route', 'Arrived'].includes(selected.status) && responderPos.lat ? parseFloat(responderPos.lat) : null);
                      const effLng = (selected.responder_lng && !isNaN(parseFloat(selected.responder_lng)) && parseFloat(selected.responder_lng) !== 0)
                        ? parseFloat(selected.responder_lng)
                        : (['Responder Dispatched', 'En Route', 'Arrived'].includes(selected.status) && responderPos.lng ? parseFloat(responderPos.lng) : null);

                      if (effLat && effLng) {
                        return (
                          <>
                            <Marker position={[effLat, effLng]} icon={responderPin}>
                              <Popup>
                                <b>{selected.responder_unit || 'Responder Unit'}</b><br />
                                Speed: {selected.metrics?.speedKmh || selected.speed || 0} km/h<br />
                                Status: {selected.status}
                              </Popup>
                            </Marker>
                            <Polyline
                              positions={[
                                [effLat, effLng],
                                [parseFloat(selected.latitude), parseFloat(selected.longitude)],
                              ]}
                              pathOptions={{ color: '#0ea5e9', weight: 2.5, dashArray: '6,6' }}
                            />
                            <MapFlyTo lat={effLat} lng={effLng} />
                          </>
                        );
                      }
                      return <MapFlyTo lat={parseFloat(selected.latitude)} lng={parseFloat(selected.longitude)} />;
                    })()}
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

      {/* 1. DISPATCH UNIT ASSIGNMENT MODAL (Prompt Section 4 & Section 8) */}
      {showDispatchModal && selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0d1322', border: '1.5px solid #0ea5e9',
            borderRadius: '12px', width: '100%', maxWidth: '620px',
            padding: '24px', boxShadow: '0 0 40px rgba(14,165,233,0.3)',
            display: 'flex', flexDirection: 'column', gap: '16px', color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🚀</span>
                  <span>DISPATCH RESCUE UNIT & AUTHORIZE ROLLOUT</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                  Incident #{selected.id} • {selected.address_location || 'GPS Position'}
                </div>
              </div>
              <button
                onClick={() => setShowDispatchModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Department Selection */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>ASSIGNED DEPARTMENT / RESCUE SERVICE</label>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '800' }}>⚡ AUTO-POPULATED FROM CITIZEN SOS</span>
              </div>
              <input
                className="tactical-input"
                value={dispatchUnitForm.assigned_department}
                onChange={(e) => setDispatchUnitForm((f) => ({ ...f, assigned_department: e.target.value }))}
                placeholder="e.g. Medical, Fire, Police"
              />
            </div>

            {/* Available Responders in Sector */}
            {availableResponders.length > 0 && (
              <div>
                <label className="form-label">AVAILABLE REGISTERED UNITS IN SECTOR</label>
                <select
                  className="tactical-input"
                  value={dispatchUnitForm.assigned_responder_id || ''}
                  onChange={(e) => {
                    const found = availableResponders.find((r) => r.id === parseInt(e.target.value));
                    if (found) {
                      setDispatchUnitForm((f) => ({
                        ...f,
                        assigned_responder_id: found.id,
                        responder_name: found.name || f.responder_name,
                        responder_unit: found.unit || f.responder_unit,
                        responder_phone: found.phone || f.responder_phone,
                      }));
                    } else {
                      setDispatchUnitForm((f) => ({ ...f, assigned_responder_id: null }));
                    }
                  }}
                  style={{ cursor: 'pointer', color: '#38bdf8', fontWeight: '700' }}
                >
                  <option value="">-- Select from Available Tactical Units --</option>
                  {availableResponders.map((u) => (
                    <option key={u.id} value={u.id} style={{ background: '#0b1120', color: '#fff' }}>
                      {u.unit} — {u.name} ({u.department || 'Rescue'}) • {u.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Responder & Vehicle Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label">ASSIGNED RESPONDER / COMMANDER</label>
                <input
                  className="tactical-input"
                  value={dispatchUnitForm.responder_name}
                  onChange={(e) => setDispatchUnitForm((f) => ({ ...f, responder_name: e.target.value }))}
                  placeholder="Commander Name"
                />
              </div>
              <div>
                <label className="form-label">RESPONSE UNIT ID / VEHICLE</label>
                <input
                  className="tactical-input"
                  value={dispatchUnitForm.responder_unit}
                  onChange={(e) => setDispatchUnitForm((f) => ({ ...f, responder_unit: e.target.value }))}
                  placeholder="e.g. MEDIC-AMBULANCE-01"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label">RESPONDER CONTACT NUMBER</label>
                <input
                  className="tactical-input"
                  value={dispatchUnitForm.responder_phone}
                  onChange={(e) => setDispatchUnitForm((f) => ({ ...f, responder_phone: e.target.value }))}
                  placeholder="0917-xxx-xxxx"
                />
              </div>
              <div>
                <label className="form-label">DISPATCH TACTICAL NOTES</label>
                <input
                  className="tactical-input"
                  value={dispatchUnitForm.dispatcher_notes}
                  onChange={(e) => setDispatchUnitForm((f) => ({ ...f, dispatcher_notes: e.target.value }))}
                  placeholder="Notes for unit rollout..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                disabled={dispatchingUnit}
                onClick={handleConfirmDispatch}
                className="tactical-btn"
                style={{
                  flex: 1, justifyContent: 'center', padding: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 0 20px rgba(16,185,129,0.4)',
                  fontSize: '13px', fontWeight: '900', color: '#fff'
                }}
              >
                {dispatchingUnit ? 'CONFIRMING ROLLOUT...' : '🚀 CONFIRM DISPATCH & AUTHORIZE ROLLOUT'}
              </button>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="tactical-btn secondary"
                style={{ width: '100px', justifyContent: 'center' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MANUAL STAGE OVERRIDE MODAL (Prompt Section 8 & Section 9) */}
      {showOverrideModal && selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0d1322', border: '1.5px solid #f43f5e',
            borderRadius: '12px', width: '100%', maxWidth: '580px',
            padding: '24px', boxShadow: '0 0 40px rgba(244,63,94,0.3)',
            display: 'flex', flexDirection: 'column', gap: '16px', color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚙️</span>
                  <span>MANUAL RESCUE STAGE OVERRIDE</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                  Duty Dispatcher Override Control • Incident #{selected.id}
                </div>
              </div>
              <button
                onClick={() => setShowOverrideModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '11.5px', color: '#fca5a5' }}>
              ⚠️ <b>Operational Intervention Notice:</b> Use manual override when GPS telemetry is offline, device batteries are drained, or field verbal reports (radio) indicate the stage has progressed. This will be permanently recorded in the audit log.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>CURRENT RESCUE STAGE:</span>
              <span style={{
                fontSize: '12px', fontWeight: '900', padding: '4px 10px', borderRadius: '5px',
                background: 'rgba(14,165,233,0.18)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)'
              }}>
                {selected.status.toUpperCase()}
              </span>
            </div>

            {/* Target Stage Selector */}
            <div>
              <label className="form-label">SELECT TARGET RESCUE STAGE</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                {STATUS_FLOW.map((stage) => {
                  const isSel = overrideTargetStatus === stage;
                  return (
                    <button
                      type="button"
                      key={stage}
                      onClick={() => setOverrideTargetStatus(stage)}
                      style={{
                        padding: '10px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer',
                        background: isSel ? '#f43f5e' : 'rgba(255,255,255,0.04)',
                        border: isSel ? '1.5px solid #f43f5e' : '1px solid rgba(255,255,255,0.08)',
                        color: isSel ? '#ffffff' : '#94a3b8',
                        boxShadow: isSel ? '0 0 12px rgba(244,63,94,0.4)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {stage}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Reason Suggestions */}
            <div>
              <label className="form-label">QUICK OVERRIDE REASONS</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {[
                  'Confirmed Arrival via Two-Way Radio',
                  'GPS Hardware Offline / Telemetry Lost',
                  'Unit Started Moving (En Route)',
                  'Operation Finished - Verified by Commander',
                  'Manual Tactical State Correction'
                ].map((reason) => (
                  <button
                    type="button"
                    key={reason}
                    onClick={() => setOverrideReason(reason)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#cbd5e1',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason / Notes Textarea */}
            <div>
              <label className="form-label">TACTICAL OVERRIDE REASON & AUDIT NOTES *</label>
              <textarea
                className="tactical-input"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Detail reason for manual intervention (e.g. Unit confirmed arrived on scene via radio, GPS offline)..."
                style={{ resize: 'none', marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                disabled={applyingOverride || !overrideTargetStatus}
                onClick={handleApplyOverride}
                className="tactical-btn danger"
                style={{
                  flex: 1, justifyContent: 'center', padding: '12px',
                  background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                  boxShadow: '0 0 20px rgba(244,63,94,0.4)',
                  fontSize: '13px', fontWeight: '900', color: '#fff'
                }}
              >
                {applyingOverride ? 'APPLYING OVERRIDE...' : `✓ APPLY OVERRIDE TO "${overrideTargetStatus.toUpperCase()}"`}
              </button>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="tactical-btn secondary"
                style={{ width: '100px', justifyContent: 'center' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

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
