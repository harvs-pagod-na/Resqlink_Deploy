import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { io } from 'socket.io-client';
import { RESQLINK_TOWN_CENTERS } from '../data/PampangaData';
import { EmergencyBadges, CriticalBadge, getIncidentEmergencies, EmergencyStatusTracker, EMERGENCY_STATUS_STEPS } from '../utils/emergencyHelper';
import { getSocketUrl } from '../utils/urlHelper';

const SOCKET_URL = getSocketUrl();

const victimIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(244,63,94,0.4);animation:resqPulse 1.5s infinite;"></div>
    <div style="width:30px;height:30px;border-radius:50%;background:#f43f5e;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 14px rgba(244,63,94,0.7);color:#fff;">🆘</div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -22],
});

const responderIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(14,165,233,0.45);animation:resqPulse 1.8s infinite;"></div>
    <div style="width:32px;height:32px;border-radius:50%;background:#0ea5e9;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 14px rgba(14,165,233,0.75);">🚑</div>
  </div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -24],
});

function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center?.lat && center?.lng) {
      map.flyTo([center.lat, center.lng], 16, { duration: 1.2 });
    }
  }, [center?.lat, center?.lng, map]);
  return null;
}

function MapFitBoth({ p1, p2 }) {
  const map = useMap();
  useEffect(() => {
    if (p1?.lat && p1?.lng && p2?.lat && p2?.lng) {
      const bounds = L.latLngBounds([p1.lat, p1.lng], [p2.lat, p2.lng]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [p1?.lat, p1?.lng, p2?.lat, p2?.lng, map]);
  return null;
}

const EMERGENCY_ICONS = {
  Medical: '🚑',
  Fire: '🔥',
  'Flood/Disaster': '🌊',
  'Crime/Police': '🚔',
  Accident: '🚗',
  Evacuation: '🏃',
  Other: '⚠️',
};

const SEVERITY_COLORS = {
  Critical: { bg: 'rgba(244,63,94,0.15)', text: '#f43f5e', border: '#f43f5e' },
  High: { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: '#f97316' },
  Moderate: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: '#f59e0b' },
  Low: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: '#10b981' },
};

export default function ResponderPortal({ user, onLogout }) {
  const [activeIncident, setActiveIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsPos, setGpsPos] = useState(null);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeMeta, setRouteMeta] = useState({ distanceKm: 0, etaMins: 0, speedKmh: 0 });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [notification, setNotification] = useState(null);

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  // Initialize hardware GPS & Socket
  useEffect(() => {
    initSocket();
    startGpsTracking();
    loadActiveIncident();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Hardware GPS Telemetry Ingestion (Real device data)
  const startGpsTracking = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device.');
      return;
    }

    // Initial position fetch
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsPos(coords);
        setGpsLocked(true);
        setGpsError('');
      },
      (err) => {
        console.warn('[GPS Hardware Warning]:', err.message);
        // Fallback center for Santa Rita / Pampanga if GPS permission denied
        const fallback = RESQLINK_TOWN_CENTERS['Santa Rita'] || { lat: 15.0006, lng: 120.6128 };
        setGpsPos(fallback);
        setGpsError('GPS signal weak or permission denied. Using base station coordinates.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    // Continuous real-time GPS stream
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsPos(coords);
        setGpsLocked(true);
        setGpsError('');

        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        setRouteMeta((prev) => ({ ...prev, speedKmh: speed }));

        // If currently on an active emergency mission, emit real GPS coordinates to server
        if (activeIncident && ['Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'On Scene'].includes(activeIncident.status)) {
          broadcastLiveLocation(activeIncident.id, coords.lat, coords.lng, speed, pos.coords.heading);
        }
      },
      (err) => console.warn('[GPS Watch Error]:', err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  };

  const broadcastLiveLocation = (incidentId, lat, lng, speed = 0, heading = 0) => {
    const payload = {
      request_id: incidentId,
      user_id: user.id,
      responder_lat: lat,
      responder_lng: lng,
      speed,
      heading: heading || 0,
      responder_unit: user.profile?.responder_unit || user.unit_name || 'Unit-01',
      responder_name: `${user.profile?.first_name || 'Responder'} ${user.profile?.last_name || ''}`.trim(),
    };

    if (socketRef.current) {
      socketRef.current.emit('update_responder_location', payload);
      socketRef.current.emit('telemetry_ping', payload);
    }
  };

  const initSocket = () => {
    const sock = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    sock.emit('join_user_room', { userId: user.id, role: 'responder' });

    sock.on('new_rescue_request', (data) => {
      // Only notify if assigned to this responder
      if (data.assigned_responder_id === user.id) {
        showNotification(`🚨 NEW EMERGENCY ASSIGNED: ${data.emergency_type} at ${data.address_location || 'GPS Pin'}`, 'alert');
        loadActiveIncident();
      }
    });

    sock.on('new_assignment_alert', (data) => {
      showNotification(`🚨 NEW EMERGENCY ASSIGNMENT: ${data.emergency_type} in ${data.municipality || 'Pampanga'}`, 'alert');
      loadActiveIncident();
    });

    sock.on('responder_dispatched', (data) => {
      showNotification(`⚡ DISPATCH ORDER AUTHORIZED: Proceed immediately to ${data.address_location || 'emergency location'}!`, 'alert');
      loadActiveIncident();
    });

    sock.on('update_rescue_status', (data) => {
      const rid = data.id || data?.dataValues?.id;
      if (activeIncident && activeIncident.id === rid) {
        if (['Completed', 'Cancelled', 'Resolved'].includes(data.status)) {
          setActiveIncident(null);
          setRoutePolyline([]);
          showNotification('✓ Mission completed and archived into History. Standby for next dispatch.', 'success');
        } else {
          setActiveIncident((prev) => ({ ...prev, ...data }));
        }
      } else if (data.assigned_responder_id === user.id) {
        loadActiveIncident();
      }
    });
  };

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Strict Privacy: Only load incident assigned to this responder
  const loadActiveIncident = async () => {
    setLoading(true);
    try {
      const res = await api.get('/resq/responder/active');
      if (res.data.success && res.data.active_incident) {
        const inc = res.data.active_incident;
        setActiveIncident(inc);
        if (socketRef.current) {
          socketRef.current.emit('join_resq_room', inc.id);
        }
      } else {
        setActiveIncident(null);
        setRoutePolyline([]);
      }
    } catch (e) {
      console.error('[LOAD ACTIVE RESCUE ERROR]', e);
      setActiveIncident(null);
    } finally {
      setLoading(false);
    }
  };

  // 1-Tap Responder Accept Assignment
  const handleAcceptEmergency = async () => {
    if (!activeIncident) return;
    setUpdatingStatus(true);
    try {
      const res = await api.post(`/resq/accept/${activeIncident.id}`);
      if (res.data.success) {
        setActiveIncident(res.data.request);
        showNotification('✓ Emergency accepted! Dispatch Command notified. Awaiting official dispatch order.', 'success');
      }
    } catch (e) {
      showNotification(e.response?.data?.message || 'Failed to accept emergency.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Turn-by-Turn Road Route from Responder to Victim via OSRM
  useEffect(() => {
    if (!activeIncident || !activeIncident.latitude || !activeIncident.longitude || !gpsPos) return;

    const victimLat = parseFloat(activeIncident.latitude);
    const victimLng = parseFloat(activeIncident.longitude);
    const startLat = gpsPos.lat;
    const startLng = gpsPos.lng;

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${victimLng},${victimLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes?.[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((pt) => [pt[1], pt[0]]);
          setRoutePolyline(coords);

          const km = parseFloat((route.distance / 1000).toFixed(1));
          const mins = Math.max(1, Math.ceil(route.duration / 60));
          setRouteMeta((prev) => ({ ...prev, distanceKm: km, etaMins: mins }));
        } else {
          setRoutePolyline([[startLat, startLng], [victimLat, victimLng]]);
        }
      } catch (err) {
        setRoutePolyline([[startLat, startLng], [victimLat, victimLng]]);
      }
    };

    fetchRoute();
  }, [activeIncident?.id, activeIncident?.latitude, activeIncident?.longitude, gpsPos?.lat, gpsPos?.lng]);

  // Milestone Status Handlers
  const handleUpdateStatus = async (newStatus, notes = '') => {
    if (!activeIncident) return;
    setUpdatingStatus(true);
    try {
      const payload = {
        status: newStatus,
        responder_name: `${user.profile?.first_name || 'Commander'} ${user.profile?.last_name || ''}`.trim(),
        responder_unit: user.profile?.responder_unit || user.unit_name || 'Unit-01',
        responder_phone: user.phone_number || '0917-123-4567',
        responder_lat: gpsPos?.lat,
        responder_lng: gpsPos?.lng,
        resolution_notes: notes || undefined,
      };

      const res = await api.put(`/resq/dispatch/${activeIncident.id}`, payload);
      if (res.data.success) {
        if (newStatus === 'Completed' || newStatus === 'Resolved') {
          setActiveIncident(null);
          setRoutePolyline([]);
          setShowResolutionModal(false);
          setResolutionNotes('');
          showNotification('✓ Incident marked Completed and archived into History.', 'success');
        } else {
          setActiveIncident(res.data.request);
          showNotification(`Status updated: ${newStatus.toUpperCase()}`, 'success');
        }

        // Live broadcast
        if (gpsPos) {
          broadcastLiveLocation(activeIncident.id, gpsPos.lat, gpsPos.lng, routeMeta.speedKmh);
        }
      }
    } catch (e) {
      showNotification(e.response?.data?.message || 'Failed to update milestone.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const sevColor = activeIncident ? (SEVERITY_COLORS[activeIncident.severity_level] || SEVERITY_COLORS.Moderate) : null;
  const victimProfile = activeIncident?.requester?.profile;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070a13',
      color: '#f8fafc',
      fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ─── TOP RESPONDER APP BAR ─── */}
      <header style={{
        padding: '12px 16px',
        backgroundColor: '#0d1224',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 500,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🚨</span>
          <div>
            <div style={{ fontWeight: '900', fontSize: '14px', letterSpacing: '0.8px', color: '#f43f5e' }}>
              RESQLINK <span style={{ color: '#38bdf8', fontSize: '12px' }}>RESPONDER</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{user.profile?.responder_unit || 'Unit-01'}</span> • 
              <span style={{ color: gpsLocked ? '#10b981' : '#f59e0b', fontWeight: '700' }}>
                {gpsLocked ? '🛰️ GPS LIVE' : '📡 ACQUIRING GPS...'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={loadActiveIncident}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#38bdf8',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            ↻ REFRESH
          </button>
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#94a3b8',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* STANDBY MODE BANNER (When no active emergency is assigned) */}
        {!activeIncident && !loading && (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'linear-gradient(180deg, rgba(14,165,233,0.08) 0%, rgba(7,10,19,0) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🟢</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', margin: 0 }}>
              STANDBY • READY FOR DISPATCH
            </h2>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '6px', maxWidth: '400px', margin: '6px auto 0' }}>
              Your device GPS is active and connected to the central MDRRMO Dispatch Command. You will be alerted immediately upon emergency assignment.
            </p>
          </div>
        )}

        {/* ─── ACTIVE INCIDENT BANNER & CONTROLS ─── */}
        {activeIncident && (
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(180deg, rgba(244,63,94,0.12) 0%, rgba(9,13,26,0.95) 100%)',
            borderBottom: '1px solid rgba(244,63,94,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {/* Mission Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '900', fontSize: '15px', color: '#f8fafc' }}>
                      INCIDENT #{activeIncident.id}
                    </span>
                    <EmergencyBadges incident={activeIncident} size="medium" />
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    📍 {activeIncident.municipality || 'Pampanga'} • {activeIncident.address_location || 'GPS Locked'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <CriticalBadge size="small" />
                <span style={{
                  fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                  background: 'rgba(56,189,248,0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)'
                }}>
                  {activeIncident.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Victim Telemetry & Contact Bar */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12.5px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>VICTIM:</span>{' '}
                  <b>{victimProfile?.first_name || activeIncident.reporter_name || 'Citizen'} {victimProfile?.last_name || ''}</b>
                </div>

                {/* 1-Tap Dial Buttons */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <a
                    href={`tel:${activeIncident.contact_number || activeIncident.requester?.phone_number}`}
                    style={{
                      background: '#10b981', color: '#fff', textDecoration: 'none', padding: '4px 10px',
                      borderRadius: '5px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    📞 CALL
                  </a>
                  {activeIncident.photo_url && (
                    <button
                      onClick={() => setShowPhotoModal(true)}
                      style={{
                        background: 'rgba(255,255,255,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)',
                        padding: '4px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      📸 PHOTO
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '11px' }}>LOCATION:</span>{' '}
                <span style={{ color: '#e2e8f0' }}>{activeIncident.address_location || 'GPS Locked'}</span>
              </div>

              {activeIncident.description && (
                <div style={{ color: '#cbd5e1', fontSize: '12px', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                  <b>Note:</b> {activeIncident.description.replace(/^\[EMERGENCY CATEGORIES: [^\]]+\]\s*/, '') || activeIncident.description}
                </div>
              )}

              {/* Patient Medical Telemetry Badges */}
              {(victimProfile?.blood_type || victimProfile?.special_needs || victimProfile?.medical_conditions?.length) && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {victimProfile?.blood_type && (
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(244,63,94,0.2)', color: '#f43f5e', padding: '2px 6px', borderRadius: '4px' }}>
                      🩸 {victimProfile.blood_type}
                    </span>
                  )}
                  {victimProfile?.special_needs && victimProfile.special_needs !== 'None' && (
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px' }}>
                      ♿ {victimProfile.special_needs}
                    </span>
                  )}
                  {victimProfile?.emergency_contact_phone && (
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      Kin: {victimProfile.emergency_contact_name} ({victimProfile.emergency_contact_phone})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Real-Time Step-by-Step Emergency Status Tracker */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <EmergencyStatusTracker incident={activeIncident} />
            </div>

            {/* Navigation Telemetry Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>DISTANCE</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#38bdf8' }}>{routeMeta.distanceKm} km</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>EST. TIME</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#10b981' }}>~{routeMeta.etaMins} min</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>GPS SPEED</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#f59e0b' }}>{routeMeta.speedKmh} km/h</div>
              </div>
            </div>

            {/* 1-TAP MILESTONE ACTION BUTTONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              
              {/* STAGE 1: Assigned -> Responder Must Accept */}
              {activeIncident.status === 'Assigned' && (
                <div style={{
                  background: 'rgba(244,63,94,0.15)',
                  border: '1.5px solid #f43f5e',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '12px', color: '#f43f5e', fontWeight: '800', marginBottom: '8px' }}>
                    ⚠️ NEW EMERGENCY ASSIGNED BY COMMAND NOC • ACCEPTANCE REQUIRED
                  </div>
                  <button
                    disabled={updatingStatus}
                    onClick={handleAcceptEmergency}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '14px',
                      borderRadius: '8px',
                      fontWeight: '900',
                      fontSize: '13.5px',
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(244,63,94,0.5)',
                    }}
                  >
                    {updatingStatus ? 'TRANSMITTING...' : '🚨 ACCEPT EMERGENCY REQUEST'}
                  </button>
                </div>
              )}

              {/* STAGE 2: Accepted -> Waiting for Admin Dispatch Order */}
              {activeIncident.status === 'Accepted' && (
                <div style={{
                  background: 'rgba(56,189,248,0.12)',
                  border: '1px solid rgba(56,189,248,0.35)',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8' }}>
                    ⏳ MISSION ACCEPTED • AWAITING COMMAND NOC DISPATCH ORDER
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Command NOC has been notified of your acceptance. Preparing vehicle & response gear.
                  </div>
                </div>
              )}

              {/* STAGE 3: Responder Dispatched -> Press En Route */}
              {activeIncident.status === 'Responder Dispatched' && (
                <div>
                  <div style={{ fontSize: '11.5px', color: '#10b981', fontWeight: '800', marginBottom: '6px', textAlign: 'center' }}>
                    ⚡ DISPATCH AUTHORIZED! PRESS "EN ROUTE" WHEN LEAVING BASE
                  </div>
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleUpdateStatus('En Route')}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '13px',
                      borderRadius: '8px',
                      fontWeight: '900',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(14,165,233,0.4)',
                    }}
                  >
                    {updatingStatus ? 'TRANSMITTING...' : '🚀 EN ROUTE (START NAVIGATION)'}
                  </button>
                </div>
              )}

              {/* STAGE 4: En Route -> Press Arrived */}
              {activeIncident.status === 'En Route' && (
                <button
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus('Arrived')}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '13px',
                    borderRadius: '8px',
                    fontWeight: '900',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                  }}
                >
                  {updatingStatus ? 'TRANSMITTING...' : '📍 ARRIVED (ON SCENE)'}
                </button>
              )}

              {/* STAGE 5: Arrived -> Press Complete */}
              {(activeIncident.status === 'Arrived' || activeIncident.status === 'On Scene') && (
                <button
                  disabled={updatingStatus}
                  onClick={() => setShowResolutionModal(true)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '13px',
                    borderRadius: '8px',
                    fontWeight: '900',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                  }}
                >
                  ✓ COMPLETE RESCUE OPERATION
                </button>
              )}
            </div>

          </div>
        )}

        {/* ─── FULLSCREEN NAVIGATION MAP ─── */}
        <div style={{ flex: 1, minHeight: '380px', position: 'relative' }}>
          <MapContainer
            center={gpsPos ? [gpsPos.lat, gpsPos.lng] : [15.0006, 120.6128]}
            zoom={15}
            style={{ height: '100%', width: '100%', minHeight: '380px', background: '#090d16' }}
          >
            {gpsPos && <MapFlyTo center={gpsPos} />}
            {gpsPos && activeIncident?.latitude && (
              <MapFitBoth
                p1={gpsPos}
                p2={{ lat: parseFloat(activeIncident.latitude), lng: parseFloat(activeIncident.longitude) }}
              />
            )}

            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="tactical-dark-tile"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Responder Live GPS Marker */}
            {gpsPos && (
              <Marker position={[gpsPos.lat, gpsPos.lng]} icon={responderIcon}>
                <Popup>
                  <b>{user.profile?.responder_unit || 'My Rescue Unit'}</b><br />
                  Speed: {routeMeta.speedKmh} km/h<br />
                  GPS: {gpsPos.lat.toFixed(5)}, {gpsPos.lng.toFixed(5)}
                </Popup>
              </Marker>
            )}

            {/* Victim GPS Marker */}
            {activeIncident?.latitude && activeIncident?.longitude && (
              <Marker
                position={[parseFloat(activeIncident.latitude), parseFloat(activeIncident.longitude)]}
                icon={victimIcon}
              >
                <Popup>
                  <b>SOS Incident #{activeIncident.id}</b><br />
                  <b>Categories:</b> {getIncidentEmergencies(activeIncident).join(', ')}<br />
                  <b>Severity:</b> <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>Critical</span><br />
                  Reporter: {activeIncident.reporter_name}<br />
                  {activeIncident.address_location}
                </Popup>
              </Marker>
            )}

            {/* Turn-by-turn Road Polyline */}
            {routePolyline.length > 1 && (
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: '#38bdf8',
                  weight: 5,
                  opacity: 0.9,
                  dashArray: activeIncident?.status === 'En Route' ? '8, 8' : undefined,
                }}
              />
            )}
          </MapContainer>
        </div>

      </main>

      {/* ─── PHOTO LIGHTBOX MODAL ─── */}
      {showPhotoModal && activeIncident?.photo_url && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }}
          onClick={() => setShowPhotoModal(false)}
        >
          <div style={{ maxWidth: '90%', maxHeight: '90%', position: 'relative' }}>
            <img
              src={activeIncident.photo_url}
              alt="Emergency Scene"
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            <button
              onClick={() => setShowPhotoModal(false)}
              style={{
                marginTop: '12px', width: '100%', padding: '10px', background: '#f43f5e',
                color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer'
              }}
            >
              CLOSE PHOTO
            </button>
          </div>
        </div>
      )}

      {/* ─── INCIDENT RESOLUTION MODAL ─── */}
      {showResolutionModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowResolutionModal(false)}
        >
          <div style={{
            width: '100%', maxWidth: '440px', background: '#0d1224', border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: '12px', padding: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: '900', fontSize: '15px', color: '#10b981' }}>
                ✓ COMPLETE & ARCHIVE INCIDENT
              </div>
              <button onClick={() => setShowResolutionModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '0 0 12px' }}>
              Document field actions taken. This will officially close Incident #{activeIncident?.id} and archive it into system history.
            </p>

            <textarea
              rows="3"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '13px', resize: 'none', boxSizing: 'border-box'
              }}
              placeholder="e.g. Patient stabilized on scene, transported to DHVTSU Infirmary/Hospital without further complications..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => setShowResolutionModal(false)}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
              >
                CANCEL
              </button>
              <button
                disabled={updatingStatus}
                onClick={() => handleUpdateStatus('Completed', resolutionNotes || 'Incident resolved and cleared by field squad.')}
                style={{ flex: 1, padding: '10px', background: '#10b981', border: 'none', color: '#fff', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}
              >
                {updatingStatus ? 'SAVING...' : '✓ CONFIRM RESOLVED'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: '16px', left: '16px', right: '16px', zIndex: 1200,
          background: '#0d1224', border: '1px solid #38bdf8', padding: '12px 16px',
          borderRadius: '8px', color: '#f8fafc', fontSize: '12.5px', fontWeight: '700',
          boxShadow: '0 8px 30px rgba(0,0,0,0.7)', textAlign: 'center',
        }}>
          {notification.msg}
        </div>
      )}
    </div>
  );
}
