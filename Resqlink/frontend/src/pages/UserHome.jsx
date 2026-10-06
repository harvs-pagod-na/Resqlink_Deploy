import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { io } from 'socket.io-client';
import {
  RESQLINK_MUNICIPALITIES,
  RESQLINK_TOWN_CENTERS,
  RESQLINK_BARANGAY_COORDS,
  PAMPANGA_BARANGAYS_MAP,
  getNearestResqlinkTown,
  geocodePampangaAddress,
} from '../data/PampangaData';
import { EmergencyBadges, CriticalBadge, EmergencyStatusTracker, EMERGENCY_STATUS_STEPS } from '../utils/emergencyHelper';

const SOCKET_URL = typeof window !== 'undefined' 
  ? (window.location.port === '5173' ? window.location.origin : (import.meta.env.VITE_API_URL?.replace('/api', '') || `http://${window.location.hostname}:3000`))
  : 'http://localhost:3000';

const userPin = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(244,63,94,0.35);animation:resqPulse 1.6s infinite;"></div>
    <div style="width:28px;height:28px;border-radius:50%;background:#f43f5e;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 14px rgba(244,63,94,0.6);">🆘</div>
  </div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -20],
});

const responderPin = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(14,165,233,0.4);animation:resqPulse 1.8s infinite;"></div>
    <div style="width:30px;height:30px;border-radius:50%;background:#0ea5e9;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 14px rgba(14,165,233,0.7);">⚡</div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -22],
});

const STATUS_STEPS = ['Pending', 'Assigned', 'Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'Completed'];

const STATUS_COLOR = {
  Pending: '#f59e0b',
  Assigned: '#c084fc',
  Accepted: '#0ea5e9',
  'Responder Dispatched': '#818cf8',
  'En Route': '#38bdf8',
  Arrived: '#10b981',
  Completed: '#059669',
  Cancelled: '#64748b',
};

const EMERGENCY_TYPES = [
  { id: 'Medical', label: 'MEDICAL', icon: '🚑', color: '#f43f5e' },
  { id: 'Fire', label: 'FIRE', icon: '🔥', color: '#f97316' },
  { id: 'Flood/Disaster', label: 'FLOOD / DISASTER', icon: '🌊', color: '#0ea5e9' },
  { id: 'Crime/Police', label: 'POLICE / CRIME', icon: '🚔', color: '#818cf8' },
  { id: 'Accident', label: 'ACCIDENT', icon: '🚗', color: '#f59e0b' },
  { id: 'Evacuation', label: 'EVACUATION', icon: '🏃', color: '#10b981' },
  { id: 'Other', label: 'OTHER', icon: '⚠️', color: '#94a3b8' },
];

const SEVERITY = [
  { id: 'Critical', label: 'CRITICAL', color: '#f43f5e' },
  { id: 'High', label: 'HIGH', color: '#f97316' },
  { id: 'Moderate', label: 'MODERATE', color: '#f59e0b' },
  { id: 'Low', label: 'LOW', color: '#10b981' },
];

function MapFitBounds({ p1, p2 }) {
  const map = useMap();
  useEffect(() => {
    if (p1?.lat && p1?.lng && p2?.lat && p2?.lng) {
      const bounds = L.latLngBounds([p1.lat, p1.lng], [p2.lat, p2.lng]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [p1?.lat, p1?.lng, p2?.lat, p2?.lng, map]);
  return null;
}

function MapFly({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15, { duration: 1.2 });
  }, [lat, lng]);
  return null;
}

export default function UserHome({ user, onLogout }) {
  const [activeRequest, setActiveRequest] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [tab, setTab] = useState('home'); // home | alerts | medical | tracking | history
  
  // Tri-Municipality Selection Focus: Porac, Santa Rita, and Guagua
  const initialTown = user?.profile?.city && RESQLINK_MUNICIPALITIES.includes(user.profile.city)
    ? user.profile.city
    : 'Santa Rita';
  const initialBrgy = user?.profile?.barangay || PAMPANGA_BARANGAYS_MAP[initialTown]?.[0] || 'San Basilio';

  const [selectedTown, setSelectedTown] = useState(initialTown);
  const [selectedBarangay, setSelectedBarangay] = useState(initialBrgy);
  const [sosForm, setSosForm] = useState({
    emergency_type: 'Medical',
    emergency_types: ['Medical'],
    severity_level: 'Critical',
    description: '',
    address_location: '',
    photo_url: '',
    contact_number: user?.phone_number || '',
  });

  const selectedEmergencyTypes = Array.isArray(sosForm.emergency_types) && sosForm.emergency_types.length > 0
    ? sosForm.emergency_types
    : (sosForm.emergency_type ? [sosForm.emergency_type] : ['Medical']);

  const toggleEmergencyType = (typeId) => {
    setSosForm((prev) => {
      const current = Array.isArray(prev.emergency_types) && prev.emergency_types.length > 0
        ? prev.emergency_types
        : (prev.emergency_type ? [prev.emergency_type] : ['Medical']);
      
      let next;
      if (current.includes(typeId)) {
        if (current.length === 1) return prev; // Keep at least one selected
        next = current.filter((id) => id !== typeId);
      } else {
        next = [...current, typeId];
      }

      return {
        ...prev,
        emergency_types: next,
        emergency_type: next[0] || 'Medical',
      };
    });
  };
  const [userLocation, setUserLocation] = useState(RESQLINK_BARANGAY_COORDS['Santa Rita']?.['San Basilio'] || { lat: 15.0339, lng: 120.5842 });
  const [responderLocation, setResponderLocation] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeMeta, setRouteMeta] = useState({ distanceKm: null, etaMins: null, speedKmh: 42 });
  const [metrics, setMetrics] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [publicAlerts, setPublicAlerts] = useState([]);
  const socketRef = useRef(null);
  const simIntervalRef = useRef(null);

  // Switch Municipality Handler (Porac | Santa Rita | Guagua)
  const handleTownChange = (town) => {
    setSelectedTown(town);
    const defaultBrgy = PAMPANGA_BARANGAYS_MAP[town]?.[0] || 'Poblacion';
    setSelectedBarangay(defaultBrgy);
    const center = RESQLINK_TOWN_CENTERS[town] || { lat: 15.0689, lng: 120.5400 };
    setUserLocation(center);
    showNotification(`📍 Set to ${town} Operations Center`, 'info');
  };

  // Switch Barangay Handler
  const handleBarangayChange = (brgy) => {
    setSelectedBarangay(brgy);
    const coords = RESQLINK_BARANGAY_COORDS[selectedTown]?.[brgy] || geocodePampangaAddress(selectedTown, brgy);
    if (coords) {
      setUserLocation(coords);
      showNotification(`📍 Pinned to Brgy. ${brgy}, ${selectedTown}`, 'info');
    }
  };

  // Emergency Health & Safety Profile state
  const [medicalForm, setMedicalForm] = useState({
    blood_type: user?.profile?.blood_type || 'Unknown',
    special_needs: user?.profile?.special_needs || 'None',
    medical_conditions: user?.profile?.medical_conditions || [],
    household_count: user?.profile?.household_count || 1,
    household_infants: user?.profile?.household_infants || 0,
    household_seniors: user?.profile?.household_seniors || 0,
    emergency_contact_name: user?.profile?.emergency_contact_name || '',
    emergency_contact_phone: user?.profile?.emergency_contact_phone || '',
    emergency_contact_relation: user?.profile?.emergency_contact_relation || '',
  });
  const [savingMedical, setSavingMedical] = useState(false);

  const isVerified = user?.is_verified || user?.verification_status === 'approved';

  const saveMedicalProfile = async (e) => {
    if (e) e.preventDefault();
    setSavingMedical(true);
    try {
      const res = await api.put('/profile/me', medicalForm);
      if (res.data?.success) {
        showNotification('🩺 Health & Safety Profile saved successfully!', 'success');
      }
    } catch (err) {
      showNotification('Failed to save profile updates.', 'error');
    } finally {
      setSavingMedical(false);
    }
  };

  const toggleCondition = (cond) => {
    setMedicalForm(f => {
      const list = f.medical_conditions || [];
      const updated = list.includes(cond) ? list.filter(c => c !== cond) : [...list, cond];
      return { ...f, medical_conditions: updated };
    });
  };

  useEffect(() => {
    loadMyRequests();
    loadAlerts();
    initSocket();
    getGPS(false);
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // ─── Real-Time OSRM Road Routing & Turn-by-Turn Telemetry Engine ───
  useEffect(() => {
    if (!activeRequest || !activeRequest.latitude || !activeRequest.longitude) return;

    const victimLat = parseFloat(activeRequest.latitude);
    const victimLng = parseFloat(activeRequest.longitude);

    // Only track responder if real numeric GPS coordinates exist
    const hasRealResponder =
      activeRequest.responder_lat &&
      activeRequest.responder_lng &&
      !isNaN(parseFloat(activeRequest.responder_lat)) &&
      !isNaN(parseFloat(activeRequest.responder_lng)) &&
      parseFloat(activeRequest.responder_lat) !== 0;

    if (!hasRealResponder) {
      setResponderLocation(null);
      setRoutePolyline([]);
      setRouteMeta({ distanceKm: null, etaMins: null, speedKmh: 0 });
      setMetrics(null);
      return;
    }

    const rLat = parseFloat(activeRequest.responder_lat);
    const rLng = parseFloat(activeRequest.responder_lng);
    setResponderLocation({ lat: rLat, lng: rLng });

    // Fetch real road navigation geometry from OSRM
    const fetchRouting = async () => {
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${rLng},${rLat};${victimLng},${victimLat}?overview=full&geometries=geojson&steps=true`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((pt) => [pt[1], pt[0]]);
          setRoutePolyline(coords);

          const km = parseFloat((route.distance / 1000).toFixed(1));
          const mins = Math.max(1, Math.ceil(route.duration / 60));
          setRouteMeta({ distanceKm: km, etaMins: mins, speedKmh: activeRequest.status === 'En Route' ? 45 : 0 });
          setMetrics({ distanceKm: km, etaMinutes: mins });

          if (activeRequest.status === 'Arrived' || activeRequest.status === 'On Scene') {
            setRouteMeta({ distanceKm: 0, etaMins: 0, speedKmh: 0 });
            setMetrics({ distanceKm: 0, etaMinutes: 0 });
          }
        } else {
          // Fallback straight vector
          setRoutePolyline([[rLat, rLng], [victimLat, victimLng]]);
        }
      } catch (err) {
        console.warn('[OSRM ROUTING FALLBACK]', err);
        setRoutePolyline([[rLat, rLng], [victimLat, victimLng]]);
      }
    };

    fetchRouting();
  }, [activeRequest?.id, activeRequest?.status, activeRequest?.latitude, activeRequest?.longitude, activeRequest?.responder_lat, activeRequest?.responder_lng]);

  const loadAlerts = async () => {
    try {
      const res = await api.get('/alerts/active');
      if (res.data?.success) {
        setPublicAlerts(res.data.alerts || []);
      }
    } catch (e) {
      console.error('Failed to load active public alerts', e);
    }
  };

  const initSocket = () => {
    const sock = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    sock.emit('join_user_room', { userId: user.id, role: user.role });

    sock.on('alert:broadcast', (newAlert) => {
      setPublicAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
      showNotification(`🚨 MDRRMO PUBLIC WARNING: ${newAlert.title}`, 'alert');
    });

    sock.on('alert:status_change', (updated) => {
      if (updated.is_active) {
        setPublicAlerts((prev) => [updated, ...prev.filter((a) => a.id !== updated.id)]);
      } else {
        setPublicAlerts((prev) => prev.filter((a) => a.id !== updated.id));
      }
    });

    sock.on('alert:deleted', (data) => {
      setPublicAlerts((prev) => prev.filter((a) => a.id !== data.id));
    });

    sock.on('resq_live_location', (data) => {
      if (activeRequest && data.request_id === activeRequest.id) {
        if (data.responder_lat && data.responder_lng && !isNaN(parseFloat(data.responder_lat)) && parseFloat(data.responder_lat) !== 0) {
          setResponderLocation({ lat: parseFloat(data.responder_lat), lng: parseFloat(data.responder_lng) });
        }
        if (data.metrics) setMetrics(data.metrics);
      }
      setActiveRequest((prev) => {
        if (prev && prev.id === data.request_id) {
          return { ...prev, responder_lat: data.responder_lat, responder_lng: data.responder_lng };
        }
        return prev;
      });
    });

    sock.on('subadmin_confirmed_assignment', (data) => {
      const sectorName = data.assigned_sector || 'Municipal Dispatch';
      showNotification(
        `✓ DISPATCH CONFIRMED: ${sectorName} Command confirmed your emergency assignment! Preparing deployment.`,
        'success'
      );
      setActiveRequest((prev) => {
        if (prev && prev.id === data.request_id) {
          return {
            ...prev,
            status: data.status || prev.status,
            subadmin_confirmed_at: data.subadmin_confirmed_at,
            assigned_sector: data.assigned_sector,
            subadmin_notes: data.subadmin_notes,
          };
        }
        return prev;
      });
      setMyRequests((prev) => prev.map((r) => (r.id === data.request_id ? { ...r, ...data } : r)));
    });

    sock.on('update_rescue_status', (data) => {
      const rid = data.id || data?.dataValues?.id;
      if (activeRequest && (activeRequest.id === rid || data.user_id === user.id)) {
        if (['Completed', 'Cancelled', 'Resolved'].includes(data.status)) {
          showNotification(`✓ Emergency #${rid} marked as COMPLETED and safely resolved!`, 'success');
        } else if (data.status === 'Responder Dispatched') {
          showNotification(`🚨 RESCUER DISPATCHED: Unit ${data.responder_name || data.responder_unit || 'Alpha'} is rolling out to your location!`, 'alert');
        } else if (data.status === 'En Route') {
          showNotification(`🚀 RESPONDER EN ROUTE: Your rescue team is now heading to your location!`, 'alert');
        } else if (data.status === 'Arrived') {
          showNotification(`📍 RESPONDER ARRIVED: The rescue unit has reached your location!`, 'success');
        } else if (data.status === 'Assigned') {
          const sec = data.assigned_sector ? ` (${data.assigned_sector} Sector)` : '';
          showNotification(`⏳ Emergency assigned to ${data.assigned_department || 'Rescue Services'}${sec}. Awaiting sub-admin confirmation.`, 'info');
        } else if (data.status === 'Accepted') {
          showNotification(`✓ Responder ${data.responder_name || 'Unit'} accepted your rescue request!`, 'info');
        } else {
          showNotification(`Incident Status: ${data.status.toUpperCase()}`, 'info');
        }
      }
      setActiveRequest((prev) => {
        if (prev && prev.id === rid) return { ...prev, ...data };
        return prev;
      });
      setMyRequests((prev) => prev.map((r) => (r.id === rid ? { ...r, ...data } : r)));
    });

    sock.on('responder_dispatched', (data) => {
      showNotification(`🚨 OFFICIAL DISPATCH: Unit ${data.responder_name || data.responder_unit || 'Alpha'} dispatched to your location!`, 'alert');
      setActiveRequest((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
      setTab('tracking');
    });

    sock.on('responder_en_route', (data) => {
      showNotification(`🚀 RESPONDER EN ROUTE: Your rescue unit is on the way!`, 'alert');
      setActiveRequest((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
    });

    sock.on('responder_arrived', (data) => {
      showNotification(`📍 RESPONDER ARRIVED: Rescue unit reached your location!`, 'success');
      setActiveRequest((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
    });

    sock.on('rescue_completed', (data) => {
      showNotification(`✓ Emergency resolved and completed! Transferred to history.`, 'success');
      setActiveRequest((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
    });
  };

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadMyRequests = async () => {
    try {
      const res = await api.get('/resq/my-requests');
      if (res.data.success) {
        setMyRequests(res.data.requests || []);
        if (res.data.active_request) {
          const ar = res.data.active_request;
          setActiveRequest(ar);
          if (socketRef.current) {
            socketRef.current.emit('join_resq_room', ar.id);
          }
          if (ar.responder_lat && ar.responder_lng && !isNaN(parseFloat(ar.responder_lat)) && parseFloat(ar.responder_lat) !== 0) {
            setResponderLocation({ lat: parseFloat(ar.responder_lat), lng: parseFloat(ar.responder_lng) });
          } else {
            setResponderLocation(null);
          }
          if (ar.latitude && ar.longitude) {
            setUserLocation({ lat: parseFloat(ar.latitude), lng: parseFloat(ar.longitude) });
          }
          setTab('tracking');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getGPS = async (notify = true) => {
    setGettingGps(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(coords);
          setGettingGps(false);
          
          const detected = getNearestResqlinkTown(coords.lat, coords.lng);
          if (detected?.town) {
            setSelectedTown(detected.town);
            if (detected.barangay) setSelectedBarangay(detected.barangay);
          }
          if (notify) showNotification(`📍 GPS Locked: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (${detected.town})`, 'success');
        },
        async (err) => {
          console.warn('[GPS Hardware Warning]:', err.message);
          const fallback = RESQLINK_TOWN_CENTERS[selectedTown] || { lat: 15.0689, lng: 120.5400 };
          setUserLocation(fallback);
          setGettingGps(false);
          if (notify) showNotification(`📍 Positioned at ${selectedTown} Center.`, 'info');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      const fallback = RESQLINK_TOWN_CENTERS[selectedTown] || { lat: 15.0689, lng: 120.5400 };
      setUserLocation(fallback);
      setGettingGps(false);
    }
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await api.post('/resq/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        const pUrl = res.data.data.publicUrl;
        setSosForm((f) => ({ ...f, photo_url: pUrl }));
        showNotification('📸 Incident photo attached successfully!', 'success');
      }
    } catch (err) {
      console.error('[Media Upload Error]:', err);
      showNotification('Photo upload failed. You can still transmit with GPS.', 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  const submitSOS = async () => {
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      const msg = 'Please allow GPS or select your municipality/barangay on the map.';
      setError(msg);
      showNotification(`⚠️ ${msg}`, 'error');
      return;
    }

    setSubmitting(true);
    setError('');

    // Safety timeout controller (12s) so transmission never hangs indefinitely
    const controller = new AbortController();
    const safetyTimer = setTimeout(() => {
      controller.abort();
    }, 12000);

    try {
      const lat = parseFloat(userLocation.lat);
      const lng = parseFloat(userLocation.lng);

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Valid GPS coordinates could not be detected. Please reposition the pin on the map.');
      }

      // Append emergency health summary to description for immediate responder triage
      const healthSummaryParts = [];
      if (medicalForm?.blood_type && medicalForm.blood_type !== 'Unknown') healthSummaryParts.push(`Blood: ${medicalForm.blood_type}`);
      if (medicalForm?.special_needs && medicalForm.special_needs !== 'None') healthSummaryParts.push(`Special: ${medicalForm.special_needs}`);
      if (Array.isArray(medicalForm?.medical_conditions) && medicalForm.medical_conditions.length > 0) {
        healthSummaryParts.push(`Conditions: ${medicalForm.medical_conditions.join(', ')}`);
      }
      if (medicalForm?.emergency_contact_name) {
        healthSummaryParts.push(`Kin Contact: ${medicalForm.emergency_contact_name} (${medicalForm.emergency_contact_phone || 'N/A'})`);
      }

      const selectedTypes = Array.isArray(sosForm.emergency_types) && sosForm.emergency_types.length > 0
        ? sosForm.emergency_types
        : (sosForm.emergency_type ? [sosForm.emergency_type] : ['Medical']);
      const primaryType = selectedTypes[0] || 'Medical';

      // Auto-assign agency if cross-agency categories are selected
      let determinedAgency = 'MDRRMO';
      const hasFire = selectedTypes.includes('Fire');
      const hasPolice = selectedTypes.includes('Crime/Police');
      const hasMdrrmo = selectedTypes.some((t) => ['Medical', 'Flood/Disaster', 'Accident', 'Evacuation'].includes(t));

      if ((hasFire && hasPolice) || (hasFire && hasMdrrmo) || (hasPolice && hasMdrrmo)) {
        determinedAgency = 'Multi-Agency';
      } else if (hasFire) {
        determinedAgency = 'BFP';
      } else if (hasPolice) {
        determinedAgency = 'PNP';
      }

      const enhancedDescription = [
        selectedTypes.length > 1 ? `[EMERGENCY CATEGORIES: ${selectedTypes.join(', ')}]` : '',
        sosForm.description ? `Note: ${sosForm.description}` : '',
        healthSummaryParts.length > 0 ? `[PATIENT TELEMETRY: ${healthSummaryParts.join(' | ')}]` : ''
      ].filter(Boolean).join('\n');

      const formattedAddress = sosForm.address_location 
        ? `[${selectedTown} - Brgy. ${selectedBarangay}] ${sosForm.address_location}`
        : `[${selectedTown}] Brgy. ${selectedBarangay}`;

      const payload = {
        ...sosForm,
        emergency_type: primaryType,
        emergency_types: selectedTypes,
        severity_level: 'Critical',
        target_agency: determinedAgency,
        municipality: selectedTown,
        barangay: selectedBarangay,
        address_location: formattedAddress,
        description: enhancedDescription,
        latitude: lat,
        longitude: lng,
      };

      let res;
      try {
        res = await api.post('/resq/request', payload, {
          signal: controller.signal,
          timeout: 10000,
        });
      } catch (postErr) {
        // Fallback: If network error or timeout via dev-server proxy, try direct backend port 3000
        const isNetworkOrTimeout = postErr.name === 'AbortError' || postErr.code === 'ECONNABORTED' || postErr.message?.includes('Network');
        if (isNetworkOrTimeout && typeof window !== 'undefined' && window.location?.hostname) {
          console.warn('[ResqLink] Proxy stall detected, trying direct connection to backend port 3000...');
          const directUrl = `http://${window.location.hostname}:3000/api/resq/request`;
          const token = localStorage.getItem('resqlink_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
          const directRes = await fetch(directUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
          const directData = await directRes.json();
          res = { data: directData };
        } else {
          throw postErr;
        }
      }

      if (res.data?.success && res.data.request) {
        setActiveRequest(res.data.request);
        setTab('tracking');
        if (socketRef.current) {
          socketRef.current.emit('join_resq_room', res.data.request.id);
        }
        showNotification('🚨 EMERGENCY DISPATCH TRANSMITTED TO CENTRAL COMMAND!', 'success');
      } else {
        const failMsg = res.data?.message || 'Emergency dispatch failed. Please retry.';
        setError(failMsg);
        showNotification(`⚠️ ${failMsg}`, 'error');
      }
    } catch (err) {
      console.error('[SOS TRANSMISSION ERROR]:', err);
      const isTimeout = err.name === 'AbortError' || err.code === 'ECONNABORTED';
      const errMsg = isTimeout
        ? 'Transmission timed out. Signal weak — please tap to retry transmitting.'
        : (err.response?.data?.message || err.message || 'Emergency dispatch failed. Please retry.');
      setError(errMsg);
      showNotification(`⚠️ ${errMsg}`, 'error');
    } finally {
      clearTimeout(safetyTimer);
      setSubmitting(false);
    }
  };

  const cancelRequest = async () => {
    if (!activeRequest) return;
    if (!window.confirm('Confirm cancellation of this active emergency SOS request?')) return;
    try {
      await api.post(`/resq/cancel/${activeRequest.id}`);
      setActiveRequest(null);
      setTab('home');
      loadMyRequests();
      showNotification('Incident request cancelled.', 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const stepIdx = activeRequest ? STATUS_STEPS.indexOf(activeRequest.status) : -1;

  return (
    <div className="resq-app-wrapper">
      
      {/* Dynamic Responsive Stylesheet */}
      <style>{`
        * {
          box-sizing: border-box;
        }
        .resq-app-wrapper {
          min-height: 100vh;
          width: 100%;
          max-width: 100vw;
          overflow-x: hidden;
          background-color: #070a13;
          color: #f8fafc;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif;
          margin: 0;
          padding: 0;
        }
        @keyframes resqPulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        .glass-panel {
          background: rgba(13, 18, 36, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          box-sizing: border-box;
          width: 100%;
        }
        .glass-card {
          background: rgba(18, 26, 48, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }
        .glass-card:hover {
          border-color: rgba(244, 63, 94, 0.3);
          transform: translateY(-1px);
        }
        .tactical-btn {
          background: #f43f5e;
          color: #ffffff;
          border: none;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 0.4px;
          padding: 12px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-sizing: border-box;
        }
        .tactical-btn:hover:not(:disabled) {
          background: #e11d48;
          box-shadow: 0 0 16px rgba(244, 63, 94, 0.5);
        }
        .tactical-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .tactical-input {
          width: 100%;
          padding: 11px 13px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.45);
          color: #f8fafc;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .tactical-input:focus {
          border-color: #f43f5e;
        }
        .form-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .mono-text {
          font-family: 'JetBrains Mono', monospace, sans-serif;
        }
        .nav-pill {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-weight: 700;
          font-size: 11.5px;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .nav-pill.active {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border-color: #f43f5e;
          box-shadow: 0 0 12px rgba(244, 63, 94, 0.2);
        }
        .dark-tiles {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }

        /* ── RESPONSIVE COMPONENT RULES ── */
        .resq-header {
          height: 60px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(7, 10, 19, 0.95);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(20px);
          width: 100%;
          box-sizing: border-box;
        }
        .resq-nav-scroll {
          max-width: 880px;
          margin: 0 auto;
          padding: 14px 16px 0;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .resq-nav-scroll::-webkit-scrollbar {
          display: none;
        }
        .resq-main-container {
          max-width: 880px;
          margin: 0 auto;
          padding: 14px 16px 40px;
          width: 100%;
          box-sizing: border-box;
        }
        .resq-category-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 10px;
        }
        .resq-severity-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 10px;
        }
        .resq-muni-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 10px;
        }
        .resq-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }
        .resq-medical-grid-1 {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 14px;
        }
        .resq-medical-grid-contacts {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 10px;
          margin-top: 6px;
        }

        /* ── MOBILE BREAKPOINTS (<= 640px) ── */
        @media (max-width: 640px) {
          .resq-header {
            height: 54px;
            padding: 0 12px;
          }
          .resq-header-title {
            font-size: 13.5px !important;
            letter-spacing: 1px !important;
          }
          .desktop-only {
            display: none !important;
          }
          .resq-header-gps {
            display: none !important;
          }
          .resq-nav-scroll {
            padding: 10px 12px 0;
            gap: 6px;
          }
          .resq-main-container {
            padding: 10px 12px 36px;
          }
          .resq-category-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .resq-severity-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
          }
          .resq-severity-btn {
            padding: 9px 2px !important;
            font-size: 10.5px !important;
          }
          .resq-muni-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
          }
          .resq-muni-btn {
            padding: 8px 4px !important;
            text-align: center !important;
          }
          .resq-muni-desc {
            font-size: 9px !important;
            margin-top: 2px !important;
          }
          .resq-form-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .resq-medical-grid-1 {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .resq-medical-grid-contacts {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>

      {/* TOP STATUS BAR */}
      <header className="resq-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e', boxShadow: '0 0 10px #f43f5e', flexShrink: 0 }} />
          <span className="resq-header-title" style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '1.5px', color: '#f8fafc', whiteSpace: 'nowrap' }}>
            RESQLINK<span style={{ color: '#f43f5e' }}>.CITIZEN</span>
          </span>
          <span className="desktop-only" style={{ fontSize: '11px', color: '#64748b', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px', whiteSpace: 'nowrap' }}>
            EMERGENCY RESPONSE PORTAL
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="resq-header-gps" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>GPS:</span>
            <span className="mono-text" style={{ fontSize: '11px', fontWeight: '700', color: userLocation ? '#10b981' : '#f59e0b' }}>
              {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'ACQUIRING...'}
            </span>
          </div>

          <span style={{
            fontSize: '10px', fontWeight: '800', padding: '4px 7px', borderRadius: '4px',
            background: isVerified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: isVerified ? '#10b981' : '#f59e0b',
            border: `1px solid ${isVerified ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            whiteSpace: 'nowrap'
          }}>
            {isVerified ? 'VERIFIED 🛡️' : 'CITIZEN ⚠️'}
          </span>

          <button onClick={onLogout} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8',
            borderRadius: '6px', padding: '5px 10px', fontSize: '10.5px', fontWeight: '800', cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}>
            LOGOUT
          </button>
        </div>
      </header>

      {/* NAVIGATION PILLS */}
      <div className="resq-nav-scroll">
        {[
          { id: 'home', label: 'SOS DISPATCH', icon: '🚨' },
          { id: 'alerts', label: 'PUBLIC ALERTS', icon: '📢', badge: publicAlerts.length > 0 ? `${publicAlerts.length}` : null },
          { id: 'medical', label: 'HEALTH PROFILE', icon: '🩺' },
          { id: 'tracking', label: 'LIVE RADAR', icon: '🗺️' },
          { id: 'history', label: 'HISTORY', icon: '📋' },
        ].map((t) => (
          <button
            key={t.id}
            className={`nav-pill ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ position: 'relative' }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge && (
              <span style={{
                background: '#f43f5e',
                color: '#fff',
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '10px',
                fontWeight: '900',
                marginLeft: '2px'
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* MAIN CONTAINER */}
      <div className="resq-main-container">

        {/* TAB 1: EMERGENCY SOS FORM */}
        {tab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Quick Hero Banner */}
            <div className="glass-panel" style={{ padding: '16px 18px', background: 'radial-gradient(circle at top right, rgba(244,63,94,0.15), rgba(13,18,36,0.9))' }}>
              <div style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc', letterSpacing: '0.5px' }}>
                DIRECT COMMAND EMERGENCY TRANSMITTER
              </div>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', maxWidth: '600px', lineHeight: '1.4' }}>
                Directly alerts Regional Sub-Admin Dispatchers and Response Forces in Porac, Santa Rita, and Guagua.
              </p>
            </div>

            {error && (
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.15)', border: '1px solid #f43f5e', color: '#f43f5e', fontSize: '12px', fontWeight: '700' }}>
                {error}
              </div>
            )}

            {/* Emergency Category Selector */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>1. SELECT EMERGENCY CATEGORY</label>
                {selectedEmergencyTypes.length > 1 && (
                  <span style={{ fontSize: '11px', color: '#f43f5e', fontWeight: '800', background: 'rgba(244,63,94,0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.3)' }}>
                    {selectedEmergencyTypes.length} Selected
                  </span>
                )}
              </div>
              <div className="resq-category-grid">
                {EMERGENCY_TYPES.map((t) => {
                  const isSel = selectedEmergencyTypes.includes(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => toggleEmergencyType(t.id)}
                      style={{
                        padding: '12px 6px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: isSel ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.03)',
                        border: isSel ? '1.5px solid #f43f5e' : '1px solid rgba(255,255,255,0.06)',
                        color: isSel ? '#ffffff' : '#94a3b8',
                        transition: 'all 0.15s ease',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ fontSize: '22px' }}>{t.icon}</div>
                      <div style={{ fontSize: '10.5px', fontWeight: '800', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GPS Location & Media Details */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">2. SITUATION OVERVIEW / INJURY DETAILS</label>
                <textarea
                  className="tactical-input"
                  rows={2}
                  style={{ resize: 'none', marginTop: '6px' }}
                  placeholder="Describe victims, fire state, flood height, trap status..."
                  value={sosForm.description}
                  onChange={(e) => setSosForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Municipality & Barangay Sector Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                  <div>
                    <label className="form-label" style={{ color: '#f43f5e', fontWeight: '800' }}>
                      3. CHOOSE NEAREST EMERGENCY HUB (PORAC • SANTA RITA • GUAGUA)
                    </label>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                      Your SOS will be received directly by the selected hub's emergency command desk.
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '900', background: 'rgba(56,189,248,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.3)' }}>
                    Assigned Hub: {selectedTown.toUpperCase()} HQ
                  </span>
                </div>

                {/* 3 Dedicated Town Selector Cards */}
                <div className="resq-muni-grid">
                  {[
                    { id: 'Porac', label: 'PORAC', icon: '🏛️', color: '#c084fc', count: '22 Brgys' },
                    { id: 'Santa Rita', label: 'STA. RITA', icon: '🏛️', color: '#38bdf8', count: '10 Brgys' },
                    { id: 'Guagua', label: 'GUAGUA', icon: '🏛️', color: '#34d399', count: '31 Brgys' },
                  ].map((t) => {
                    const isSel = selectedTown === t.id;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        className="resq-muni-btn"
                        onClick={() => handleTownChange(t.id)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSel ? `${t.color}20` : 'rgba(255,255,255,0.03)',
                          border: isSel ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.08)',
                          boxShadow: isSel ? `0 0 12px ${t.color}30` : 'none',
                          transition: 'all 0.15s ease',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '14px' }}>{t.icon}</span>
                          <span style={{ fontSize: '11px', fontWeight: '900', color: isSel ? t.color : '#f8fafc', whiteSpace: 'nowrap' }}>
                            {t.label}
                          </span>
                        </div>
                        <div className="resq-muni-desc" style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '3px', textAlign: 'center' }}>
                          {t.count}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Barangay Dropdown & Address */}
                <div className="resq-form-row">
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>BARANGAY IN {selectedTown.toUpperCase()}</label>
                    <select
                      className="tactical-input"
                      value={selectedBarangay}
                      onChange={(e) => handleBarangayChange(e.target.value)}
                      style={{ cursor: 'pointer', fontWeight: '700', color: '#38bdf8' }}
                    >
                      {(PAMPANGA_BARANGAYS_MAP[selectedTown] || []).map((b) => (
                        <option key={b} value={b} style={{ background: '#0b1120', color: '#f8fafc' }}>
                          Brgy. {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>STREET / SITIO / LANDMARK</label>
                    <input
                      className="tactical-input"
                      placeholder="e.g. Near San Basilio Chapel, Block 4..."
                      value={sosForm.address_location}
                      onChange={(e) => setSosForm((f) => ({ ...f, address_location: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Map Action Quick Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '4px', marginBottom: '6px' }}>
                  <button
                    type="button"
                    className="tactical-btn"
                    style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid #0ea5e9', color: '#0ea5e9', padding: '4px 8px', fontSize: '9.5px' }}
                    onClick={() => getGPS(true)}
                    disabled={gettingGps}
                  >
                    {gettingGps ? 'LOCATING...' : '📍 AUTO-LOCK GPS'}
                  </button>
                </div>

                {/* Interactive Map Pin Picker */}
                <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginTop: '6px' }}>
                  {userLocation && (
                    <MapContainer
                      center={[userLocation.lat, userLocation.lng]}
                      zoom={15}
                      style={{ height: '100%', width: '100%', background: '#090d16' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                        className="dark-tiles"
                      />
                      <Marker
                        draggable={true}
                        eventHandlers={{
                          dragend: (e) => {
                            const marker = e.target;
                            const pos = marker.getLatLng();
                            setUserLocation({ lat: pos.lat, lng: pos.lng });
                            const detected = getNearestResqlinkTown(pos.lat, pos.lng);
                            if (detected?.town) {
                              setSelectedTown(detected.town);
                              if (detected.barangay) setSelectedBarangay(detected.barangay);
                            }
                            showNotification(`📍 Pinned to: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)} (${detected.town})`, 'success');
                          }
                        }}
                        position={[userLocation.lat, userLocation.lng]}
                        icon={userPin}
                      >
                        <Popup>
                          <b>{selectedTown} - Brgy. {selectedBarangay}</b><br />
                          Drag me to your exact spot!
                        </Popup>
                      </Marker>
                      <MapFly lat={userLocation.lat} lng={userLocation.lng} />
                    </MapContainer>
                  )}
                </div>
                <div className="mono-text" style={{ fontSize: '9.5px', color: '#38bdf8', marginTop: '6px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span>💡 Hint: I-drag ang 🆘 marker sa eksaktong bahay mo!</span>
                  <span>GPS: {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'N/A'}</span>
                </div>
              </div>

              <div>
                <label className="form-label">4. INCIDENT MEDIA ATTACHMENT</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMediaUpload}
                    disabled={photoUploading}
                    className="tactical-input"
                    style={{ flex: 1, padding: '7px' }}
                  />
                  {photoUploading && <span style={{ fontSize: '10.5px', color: '#0ea5e9' }}>Uploading...</span>}
                </div>
                {sosForm.photo_url && (
                  <div style={{ marginTop: '8px', padding: '8px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={sosForm.photo_url.startsWith('http') || sosForm.photo_url.startsWith('/uploads') ? sosForm.photo_url : `/uploads/${sosForm.photo_url}`}
                      alt="Preview"
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #10b981' }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: '#10b981', fontSize: '11px', fontWeight: '800' }}>✓ Photo Attached</div>
                      <div style={{ color: '#94a3b8', fontSize: '9.5px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sosForm.photo_url.split('/').pop()}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSosForm(f => ({ ...f, photo_url: null }))}
                      style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '10.5px', cursor: 'pointer', fontWeight: '800' }}
                    >
                      REMOVE
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error Banner Above Dispatch Action */}
            {error && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(244,63,94,0.18)',
                border: '1px solid #f43f5e',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Big Emergency SOS Dispatch Action */}
            <button
              className="tactical-btn"
              style={{
                width: '100%', padding: '16px', fontSize: '15px', fontWeight: '900', letterSpacing: '0.8px',
                background: submitting ? 'rgba(244,63,94,0.5)' : 'linear-gradient(135deg, #f43f5e, #e11d48)',
                boxShadow: submitting ? 'none' : '0 4px 20px rgba(244,63,94,0.4)',
                borderRadius: '10px',
                cursor: submitting ? 'wait' : 'pointer'
              }}
              onClick={submitSOS}
              disabled={submitting || photoUploading}
            >
              {submitting ? '⏳ TRANSMITTING DISPATCH... (PLEASE WAIT)' : '🚨 TRANSMIT EMERGENCY SOS'}
            </button>
          </div>
        )}

        {/* TAB 2: LIVE TRACKING & RADAR */}
        {tab === 'tracking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {!activeRequest ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '36px' }}>🗺️</span>
                <div style={{ fontSize: '14px', fontWeight: '800', marginTop: '8px', color: '#f8fafc' }}>
                  NO ACTIVE EMERGENCY INCIDENT
                </div>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>All previous emergencies have been completed or resolved.</p>
                <button className="tactical-btn" style={{ marginTop: '14px', padding: '10px 16px', fontSize: '12px' }} onClick={() => setTab('home')}>
                  TRIGGER NEW SOS
                </button>
              </div>
            ) : (
              <>
                {/* Flow Stage Indicator */}
                <div className="glass-panel" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b' }}>EMERGENCY:</span>
                      <EmergencyBadges incident={activeRequest} size="small" />
                      <CriticalBadge size="small" />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: STATUS_COLOR[activeRequest.status] || '#38bdf8' }}>
                      {activeRequest.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Real-Time Step-by-Step Emergency Status Tracker */}
                  <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                    <EmergencyStatusTracker incident={activeRequest} currentStatus={activeRequest.status} />
                  </div>

                  {/* Contextual Guidance Message */}
                  <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#cbd5e1', background: 'rgba(0,0,0,0.35)', padding: '8px 12px', borderRadius: '6px' }}>
                    {activeRequest.status === 'Pending' && `📡 Transmitted to ${activeRequest.municipality || 'Central'} Emergency Hub HQ — Reviewing incident...`}
                    {activeRequest.status === 'Assigned' && (
                      activeRequest.subadmin_confirmed_at
                        ? `✓ Confirmed by ${activeRequest.assigned_sector || 'Municipal'} Sub-Admin Dispatcher at ${new Date(activeRequest.subadmin_confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Preparing rescue unit rollout.`
                        : `⏳ Assigned to ${activeRequest.assigned_sector || activeRequest.municipality || 'Municipal'} Sector Command — Awaiting Sub-Admin Confirmation...`
                    )}
                    {activeRequest.status === 'Accepted' && `✓ Responder ${activeRequest.responder_name || 'Unit'} accepted mission — Awaiting final dispatch order...`}
                    {activeRequest.status === 'Responder Dispatched' && `⚡ Response Unit dispatched! Vehicle preparing for rollout.`}
                    {activeRequest.status === 'En Route' && `🚀 Responder is en route to your location with real-time GPS telemetry!`}
                    {(activeRequest.status === 'Arrived' || activeRequest.status === 'On Scene') && `📍 Responder has arrived on scene at your location.`}
                    {(activeRequest.status === 'Completed' || activeRequest.status === 'Resolved') && `✓ Emergency operation completed successfully and archived.`}
                  </div>
                </div>

                {/* Tactical Live Navigation HUD */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <div className="glass-panel" style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '800' }}>DISTANCE</div>
                    <div className="mono-text" style={{ fontSize: '15px', fontWeight: '900', color: '#0ea5e9', marginTop: '2px' }}>
                      {routeMeta.distanceKm !== null ? `${routeMeta.distanceKm} km` : (metrics?.distanceKm ? `${metrics.distanceKm} km` : (responderLocation ? 'Calculating...' : 'Standby'))}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '800' }}>ETA TIME</div>
                    <div className="mono-text" style={{ fontSize: '15px', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>
                      {routeMeta.etaMins !== null ? (routeMeta.etaMins <= 0 ? 'On Scene' : `~${routeMeta.etaMins} min`) : (responderLocation ? 'Calculating...' : 'Standby')}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '800' }}>SPEED</div>
                    <div className="mono-text" style={{ fontSize: '15px', fontWeight: '900', color: '#38bdf8', marginTop: '2px' }}>
                      {['En Route', 'Responder Dispatched'].includes(activeRequest.status) ? `${routeMeta.speedKmh} km/h` : '0 km/h'}
                    </div>
                  </div>
                </div>

                {/* Assigned Vehicle Header Banner */}
                <div className="glass-panel" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>⚡</span>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#38bdf8' }}>
                        {activeRequest.responder_unit || 'MDRRMO Santa Rita Unit-01'}
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                        {activeRequest.responder_name ? `Cmdr: ${activeRequest.responder_name}` : 'MDRRMO Rescue Squad'} • {activeRequest.target_agency || 'MDRRMO'}
                      </div>
                      {activeRequest.assigned_sector && (
                        <div style={{ fontSize: '9.5px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#c084fc', fontWeight: '700' }}>Sector: {activeRequest.assigned_sector}</span>
                          {activeRequest.subadmin_confirmed_at ? (
                            <span style={{ color: '#10b981', fontWeight: '800' }}>• Sub-Admin Confirmed ✓</span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: '700' }}>• Awaiting Sub-Admin Confirm ⏳</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '9.5px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                    background: activeRequest.status === 'Arrived' ? 'rgba(16,185,129,0.2)' : activeRequest.status === 'Assigned' ? 'rgba(192,132,252,0.2)' : 'rgba(56,189,248,0.2)',
                    color: activeRequest.status === 'Arrived' ? '#10b981' : activeRequest.status === 'Assigned' ? '#c084fc' : '#38bdf8',
                    border: `1px solid ${activeRequest.status === 'Arrived' ? '#10b981' : activeRequest.status === 'Assigned' ? '#c084fc' : '#38bdf8'}`
                  }}>
                    {activeRequest.status === 'Arrived' ? 'ON SCENE ✓' : activeRequest.status === 'Assigned' ? (activeRequest.subadmin_confirmed_at ? 'CONFIRMED ✓' : 'ASSIGNED ⏳') : 'EN ROUTE 🚨'}
                  </span>
                </div>

                {/* Tactical Live Navigation Map with OSRM Snap-to-Road Polyline */}
                <div className="glass-panel" style={{ height: '340px', overflow: 'hidden', position: 'relative', borderRadius: '10px' }}>
                  {activeRequest.latitude && activeRequest.longitude && (
                    <MapContainer
                      center={[parseFloat(activeRequest.latitude), parseFloat(activeRequest.longitude)]}
                      zoom={15}
                      style={{ height: '100%', width: '100%', background: '#090d16' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                        className="dark-tiles"
                      />

                      {/* Citizen SOS Destination Marker */}
                      <Marker position={[parseFloat(activeRequest.latitude), parseFloat(activeRequest.longitude)]} icon={userPin}>
                        <Popup>
                          <b>My Emergency Location</b><br />
                          {activeRequest.address_location || 'San Basilio, Santa Rita'}
                        </Popup>
                      </Marker>

                      {/* Dispatched Vehicle Marker */}
                      {responderLocation && (
                        <Marker position={[responderLocation.lat, responderLocation.lng]} icon={responderPin}>
                          <Popup>
                            <b>⚡ {activeRequest.responder_unit || 'MDRRMO Unit-01'}</b><br />
                            Status: {activeRequest.status}
                          </Popup>
                        </Marker>
                      )}

                      {/* Luminous Glowing OSRM Navigation Road Polyline */}
                      {routePolyline.length > 0 && (
                        <>
                          {/* Cyan Road Glow Underlay */}
                          <Polyline
                            positions={routePolyline}
                            pathOptions={{ color: '#0ea5e9', weight: 8, opacity: 0.35 }}
                          />
                          {/* Sharp Real-Time Driving Polyline */}
                          <Polyline
                            positions={routePolyline}
                            pathOptions={{
                              color: '#38bdf8',
                              weight: 4,
                              opacity: 0.95,
                              dashArray: activeRequest.status === 'En Route' ? '8, 8' : undefined
                            }}
                          />
                        </>
                      )}

                      {/* Smart Dynamic Auto-Fit or Auto-Fly */}
                      {responderLocation ? (
                        <MapFitBounds
                          p1={{ lat: parseFloat(activeRequest.latitude), lng: parseFloat(activeRequest.longitude) }}
                          p2={responderLocation}
                        />
                      ) : (
                        <MapFly lat={parseFloat(activeRequest.latitude)} lng={parseFloat(activeRequest.longitude)} />
                      )}
                    </MapContainer>
                  )}
                </div>

                {!['Completed', 'Cancelled'].includes(activeRequest.status) && (
                  <button
                    onClick={cancelRequest}
                    style={{
                      width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid rgba(244,63,94,0.3)',
                      background: 'transparent', color: '#f43f5e', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    CANCEL ACTIVE SOS
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 3: INCIDENT HISTORY */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', marginBottom: '4px' }}>INCIDENT ARCHIVE</div>

            {myRequests.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                No prior emergency dispatches logged.
              </div>
            ) : (
              myRequests.map((r) => (
                <div key={r.id} className="glass-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <EmergencyBadges incident={r} size="small" />
                        <CriticalBadge size="small" />
                      </div>
                      <div className="mono-text" style={{ fontSize: '10px', color: '#64748b' }}>{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '9.5px', fontWeight: '800', padding: '3px 7px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.06)', color: STATUS_COLOR[r.status] || '#cbd5e1'
                  }}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: HEALTH & SAFETY PROFILE */}
        {tab === 'medical' && (
          <div className="glass-panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc' }}>
                  🩺 EMERGENCY HEALTH PROFILE
                </div>
                <p style={{ color: '#94a3b8', fontSize: '11.5px', marginTop: '3px' }}>
                  Telemetry transmitted to responders during active SOS calls.
                </p>
              </div>
              <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }}>
                ✓ LINKED TO SOS
              </span>
            </div>

            <form onSubmit={saveMedicalProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              {/* Blood Type & Mobility */}
              <div className="resq-medical-grid-1">
                <div>
                  <label className="form-label">BLOOD TYPE</label>
                  <select
                    className="tactical-input"
                    style={{ marginTop: '4px', cursor: 'pointer' }}
                    value={medicalForm.blood_type}
                    onChange={(e) => setMedicalForm(f => ({ ...f, blood_type: e.target.value }))}
                  >
                    {['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">SPECIAL NEEDS / MOBILITY</label>
                  <select
                    className="tactical-input"
                    style={{ marginTop: '4px', cursor: 'pointer' }}
                    value={medicalForm.special_needs}
                    onChange={(e) => setMedicalForm(f => ({ ...f, special_needs: e.target.value }))}
                  >
                    <option value="None">None (Standard Ambulatory)</option>
                    <option value="Senior Citizen">Senior Citizen (60+ Years)</option>
                    <option value="PWD / Mobility Impaired">PWD / Mobility Impaired</option>
                    <option value="Bedridden">Bedridden (Stretcher Support)</option>
                    <option value="Pregnant">Pregnant Mother</option>
                    <option value="Infant Care">Infant / Young Child</option>
                  </select>
                </div>
              </div>

              {/* Chronic Conditions & Alerts */}
              <div>
                <label className="form-label">CHRONIC CONDITIONS & ALERTS</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {[
                    'Asthma / Respiratory',
                    'Hypertension',
                    'Diabetes',
                    'Heart Condition',
                    'Severe Allergy',
                    'Epilepsy / Seizure',
                    'Dialysis Patient',
                    'Visual / Hearing Impairment'
                  ].map(cond => {
                    const active = medicalForm.medical_conditions?.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => toggleCondition(cond)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          background: active ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.03)',
                          border: active ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.08)',
                          color: active ? '#ffffff' : '#94a3b8',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {active ? '✓ ' : '+ '}{cond}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Household Counts */}
              <div>
                <label className="form-label">HOUSEHOLD OCCUPANT COUNT (FOR EVACUATION LOGISTICS)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Total:</span>
                    <input
                      type="number"
                      min="1"
                      className="tactical-input"
                      style={{ marginTop: '2px' }}
                      value={medicalForm.household_count}
                      onChange={(e) => setMedicalForm(f => ({ ...f, household_count: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Infants:</span>
                    <input
                      type="number"
                      min="0"
                      className="tactical-input"
                      style={{ marginTop: '2px' }}
                      value={medicalForm.household_infants}
                      onChange={(e) => setMedicalForm(f => ({ ...f, household_infants: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Elderly:</span>
                    <input
                      type="number"
                      min="0"
                      className="tactical-input"
                      style={{ marginTop: '2px' }}
                      value={medicalForm.household_seniors}
                      onChange={(e) => setMedicalForm(f => ({ ...f, household_seniors: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="form-label">EMERGENCY NEXT-OF-KIN CONTACT</label>
                <div className="resq-medical-grid-contacts">
                  <input
                    className="tactical-input"
                    placeholder="Relative Full Name"
                    value={medicalForm.emergency_contact_name}
                    onChange={(e) => setMedicalForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                  />
                  <input
                    className="tactical-input"
                    placeholder="Relationship (e.g. Spouse)"
                    value={medicalForm.emergency_contact_relation}
                    onChange={(e) => setMedicalForm(f => ({ ...f, emergency_contact_relation: e.target.value }))}
                  />
                  <input
                    className="tactical-input"
                    placeholder="Phone (0917-xxx)"
                    value={medicalForm.emergency_contact_phone}
                    onChange={(e) => setMedicalForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                  />
                </div>
              </div>

              <button className="tactical-btn" type="submit" disabled={savingMedical} style={{ marginTop: '4px' }}>
                {savingMedical ? 'SAVING...' : '💾 SAVE HEALTH & SAFETY PROFILE'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: PUBLIC EMERGENCY ALERTS FEED */}
        {tab === 'alerts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '16px', background: 'radial-gradient(circle at top right, rgba(14,165,233,0.2), rgba(13,18,36,0.95))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc' }}>
                    📢 MDRRMO EMERGENCY ALERTS
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '11.5px', marginTop: '3px' }}>
                    Real-time disaster warnings for Porac, Santa Rita, and Guagua.
                  </p>
                </div>
                <button onClick={loadAlerts} className="tactical-btn" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#38bdf8', padding: '6px 10px', fontSize: '10.5px' }}>
                  ↻ REFRESH
                </button>
              </div>
            </div>

            {publicAlerts.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🛡️</div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#94a3b8' }}>NO ACTIVE EMERGENCY WARNINGS</div>
                <div style={{ fontSize: '11.5px', marginTop: '4px' }}>All sectors are currently under normal operating status.</div>
              </div>
            ) : (
              publicAlerts.map((alt) => {
                const isCrit = alt.severity === 'Critical' || alt.severity === 'High';
                return (
                  <div
                    key={alt.id}
                    className="glass-panel"
                    style={{
                      padding: '16px',
                      borderLeft: `4px solid ${isCrit ? '#f43f5e' : '#0ea5e9'}`,
                      background: isCrit ? 'rgba(244, 63, 94, 0.04)' : 'rgba(14, 165, 233, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>
                          {alt.alert_type?.includes('Fire') ? '🔥' : alt.alert_type?.includes('Flood') || alt.alert_type?.includes('Typhoon') ? '🌊' : alt.alert_type?.includes('Road') ? '🚧' : '⚠️'}
                        </span>
                        <div>
                          <div style={{ fontWeight: '900', fontSize: '14.5px', color: '#f8fafc' }}>
                            {alt.title}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                            ISSUED BY: <b style={{ color: '#38bdf8' }}>{alt.author_name}</b> • {new Date(alt.published_at || alt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{
                          fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                          background: isCrit ? 'rgba(244,63,94,0.2)' : 'rgba(14,165,233,0.2)',
                          color: isCrit ? '#f43f5e' : '#38bdf8',
                          border: `1px solid ${isCrit ? 'rgba(244,63,94,0.4)' : 'rgba(14,165,233,0.4)'}`
                        }}>
                          {alt.severity.toUpperCase()}
                        </span>
                        <span style={{
                          fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.06)', color: '#cbd5e1'
                        }}>
                          📍 {alt.target_barangay || 'All Sectors'}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px', fontSize: '12.5px', lineHeight: '1.5', color: '#e2e8f0', whiteSpace: 'pre-line' }}>
                      {alt.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      {/* Floating Notification */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: '16px', right: '16px', left: '16px', zIndex: 1000,
          background: 'rgba(13, 18, 36, 0.98)', border: '1px solid #0ea5e9',
          padding: '11px 16px', borderRadius: '8px', color: '#f8fafc',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', fontSize: '12px', fontWeight: '700',
          maxWidth: '480px', margin: '0 auto', textAlign: 'center'
        }}>
          {notification.msg}
        </div>
      )}

    </div>
  );
}
