import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { io } from 'socket.io-client';
import { EmergencyBadges, CriticalBadge, CriticalWarningLogo, getIncidentEmergencies, RESCUE_DEPARTMENTS, mapEmergencyCategoriesToDepartments, EmergencyStatusTracker, EMERGENCY_STATUS_STEPS } from '../utils/emergencyHelper';

const SOCKET_URL = typeof window !== 'undefined' 
  ? (window.location.port === '5173' ? window.location.origin : (import.meta.env.VITE_API_URL?.replace('/api', '') || `http://${window.location.hostname}:3000`))
  : 'http://localhost:3000';

const STATUS_COLOR = {
  Pending: '#f59e0b',
  Assigned: '#c084fc',
  Accepted: '#0ea5e9',
  Validated: '#0ea5e9',
  'Responder Dispatched': '#818cf8',
  Dispatched: '#818cf8',
  'En Route': '#38bdf8',
  'On Scene': '#10b981',
  Arrived: '#10b981',
  'In Progress': '#38bdf8',
  Completed: '#059669',
  Resolved: '#059669',
  Cancelled: '#64748b',
  Closed: '#64748b',
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

const STATUS_FLOW = ['Pending', 'Assigned', 'Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'Completed'];

const reqPin = (severity) =>
  L.divIcon({
    className: '',
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:${SEVERITY_CONFIG[severity]?.bg || 'rgba(244,63,94,0.2)'};animation:resqPulse 1.8s infinite;"></div>
      <div style="width:26px;height:26px;border-radius:50%;background:${SEVERITY_CONFIG[severity]?.color || '#f43f5e'};border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 4px 10px rgba(0,0,0,0.5);">🆘</div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });

const responderTacticalPin = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(14,165,233,0.4);animation:resqPulse 1.6s infinite;"></div>
    <div style="width:28px;height:28px;border-radius:50%;background:#0ea5e9;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 10px rgba(14,165,233,0.8);">🚑</div>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const completedPin = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
    <div style="width:24px;height:24px;border-radius:50%;background:#059669;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.4);opacity:0.9;">✅</div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const cancelledPin = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
    <div style="width:24px;height:24px;border-radius:50%;background:#64748b;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.4);opacity:0.75;">✕</div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const isLiveEmergency = (status) =>
  ['Pending', 'Assigned', 'Accepted', 'Validated', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress'].includes(status);

function DispatchModal({ request, onClose, onSave }) {
  const [respondersList, setRespondersList] = useState([]);
  const [loadingResponders, setLoadingResponders] = useState(false);
  const [subadminsList, setSubadminsList] = useState([]);
  const [loadingSubadmins, setLoadingSubadmins] = useState(false);

  // 1. Automatically identify emergency categories and map to required departments
  const incidentCategories = useMemo(() => getIncidentEmergencies(request), [request]);
  const autoMappedDepts = useMemo(() => mapEmergencyCategoriesToDepartments(incidentCategories), [incidentCategories]);

  // Initial department selection: use previously saved or auto-mapped from citizen categories
  const initialDepts = useMemo(() => {
    if (request.assigned_department) {
      const parts = request.assigned_department.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts;
    }
    return autoMappedDepts;
  }, [request.assigned_department, autoMappedDepts]);

  const [selectedDepartments, setSelectedDepartments] = useState(initialDepts);
  const [selectedRespondersByDept, setSelectedRespondersByDept] = useState({});

  const initialSector = request.assigned_sector || request.municipality || 'Santa Rita';

  const [form, setForm] = useState({
    status: request.status === 'Pending' ? 'Assigned' : (request.status === 'Accepted' ? 'Responder Dispatched' : request.status),
    assigned_sector: initialSector,
    assigned_subadmin_id: request.assigned_subadmin_id || null,
    assigned_department: initialDepts.join(', '),
    target_agency: initialDepts.map(d => d === 'Fire' ? 'BFP' : d === 'Police' ? 'PNP' : 'MDRRMO').join(' + '),
    assigned_responder_id: request.assigned_responder_id || null,
    responder_name: request.responder_name || '',
    responder_phone: request.responder_phone || '',
    responder_unit: request.responder_unit || '',
    responder_lat: request.responder_lat || '',
    responder_lng: request.responder_lng || '',
    dispatcher_notes: request.dispatcher_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetchSubAdmins();
  }, [form.assigned_sector]);

  useEffect(() => {
    fetchResponders();
  }, [form.assigned_sector]);

  const fetchSubAdmins = async () => {
    setLoadingSubadmins(true);
    try {
      const res = await api.get(`/resq/subadmins?municipality=${form.assigned_sector}`);
      if (res.data?.success) {
        const list = res.data.subadmins || [];
        setSubadminsList(list);
        if (list.length > 0 && !form.assigned_subadmin_id) {
          set('assigned_subadmin_id', list[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubadmins(false);
    }
  };

  const fetchResponders = async () => {
    setLoadingResponders(true);
    try {
      const town = form.assigned_sector || request.municipality || 'Santa Rita';
      const res = await api.get(`/resq/responders?municipality=${town}&department=all`);
      if (res.data?.success) {
        setRespondersList(res.data.responders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResponders(false);
    }
  };

  // Synchronize form fields whenever selected departments or units change
  const syncDispatchPayload = (deptMap, depts) => {
    const chosenUnits = depts.map((d) => deptMap[d]).filter(Boolean);
    if (!chosenUnits.length) return;

    const primaryUnit = chosenUnits[0];
    const combinedAgencies = Array.from(new Set(chosenUnits.map((u) => u.department === 'Fire' ? 'BFP' : u.department === 'Police' ? 'PNP' : 'MDRRMO'))).join(' + ');
    const combinedNames = chosenUnits.map((u) => u.name).join(' & ');
    const combinedUnits = chosenUnits.map((u) => `${u.unit} (${u.badge})`).join(' + ');
    const combinedPhones = chosenUnits.map((u) => `${u.phone} [${u.department}]`).join(' / ');

    const town = form.assigned_sector || request.municipality || 'Santa Rita';
    const autoNotes = `[AUTO-DISPATCH] Multi-agency emergency response deployed for ${incidentCategories.join(' + ').toUpperCase()} in ${town} Sector. Deployed units: ${chosenUnits.map((u) => u.unit).join(' & ')} coordinated for immediate field intervention.`;

    setForm((f) => ({
      ...f,
      assigned_department: depts.join(', '),
      target_agency: combinedAgencies,
      assigned_responder_id: primaryUnit.id,
      responder_name: combinedNames,
      responder_unit: combinedUnits,
      responder_phone: combinedPhones,
      responder_lat: primaryUnit.lat || f.responder_lat,
      responder_lng: primaryUnit.lng || f.responder_lng,
      dispatcher_notes: (!f.dispatcher_notes || f.dispatcher_notes.startsWith('[AUTO-DISPATCH]')) ? autoNotes : f.dispatcher_notes,
    }));
  };

  // Automatic Data-Driven Selection of Available Units per Department
  useEffect(() => {
    if (!respondersList.length || !selectedDepartments.length) return;

    let changed = false;
    const nextMap = { ...selectedRespondersByDept };

    // Prune unselected departments
    Object.keys(nextMap).forEach((dept) => {
      if (!selectedDepartments.includes(dept)) {
        delete nextMap[dept];
        changed = true;
      }
    });

    // Auto-select best available unit for each active department
    selectedDepartments.forEach((dept) => {
      const existing = nextMap[dept];
      const stillValid = existing && respondersList.some((r) => r.id === existing.id && r.department.toLowerCase() === dept.toLowerCase());

      if (!stillValid) {
        const deptUnits = respondersList.filter((r) => r.department.toLowerCase() === dept.toLowerCase());
        // Prioritize units with is_available === true (not on active mission)
        const availableUnit = deptUnits.find((r) => r.is_available) || deptUnits[0];
        if (availableUnit) {
          nextMap[dept] = availableUnit;
          changed = true;
        }
      }
    });

    if (changed || Object.keys(nextMap).length > 0) {
      setSelectedRespondersByDept(nextMap);
      syncDispatchPayload(nextMap, selectedDepartments);
    }
  }, [respondersList, selectedDepartments, form.assigned_sector]);

  // Review/Change unit selection per department
  const handleSelectResponderForDept = (dept, responderId) => {
    if (!responderId) {
      const nextMap = { ...selectedRespondersByDept };
      delete nextMap[dept];
      setSelectedRespondersByDept(nextMap);
      syncDispatchPayload(nextMap, selectedDepartments);
      return;
    }
    const unit = respondersList.find((r) => r.id === parseInt(responderId));
    if (unit) {
      const nextMap = { ...selectedRespondersByDept, [dept]: unit };
      setSelectedRespondersByDept(nextMap);
      syncDispatchPayload(nextMap, selectedDepartments);
    }
  };

  // Toggle department inclusion in multi-agency dispatch
  const toggleDepartment = (deptId) => {
    setSelectedDepartments((prev) => {
      let next;
      if (prev.includes(deptId)) {
        if (prev.length === 1) return prev; // Keep at least one department active
        next = prev.filter((d) => d !== deptId);
      } else {
        next = [...prev, deptId];
      }
      return next;
    });
  };

  const handleSave = async (overrideStatus = null) => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (overrideStatus) payload.status = overrideStatus;
      await onSave(request.id, payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const sev = SEVERITY_CONFIG[request.severity_level] || SEVERITY_CONFIG.Moderate;
  const isVerified = request.requester?.is_verified || request.requester?.verification_status === 'approved';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflow: 'auto',
          boxShadow: '0 25px 70px rgba(0,0,0,0.8)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          background: 'rgba(9, 13, 26, 0.95)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(13, 18, 36, 0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <CriticalWarningLogo size={42} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '900', fontSize: '16px', color: '#f8fafc', letterSpacing: '0.5px' }}>
                  DISPATCH COMMAND & INCIDENT DOSSIER #{request.id}
                </span>
                <EmergencyBadges incident={request} size="medium" />
                <CriticalBadge size="small" />
              </div>
              <div className="mono-text" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                Logged at: {new Date(request.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Real-Time Step-by-Step Emergency Status Tracker */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <EmergencyStatusTracker incident={request} currentStatus={form.status} />
          </div>

          {/* Top Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: request.photo_url ? '1fr 1fr' : '1fr', gap: '14px' }}>
            
            {/* Citizen & Emergency Details Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '800', color: '#f43f5e', fontSize: '11px', letterSpacing: '1px' }}>
                  REPORTER & INCIDENT DETAILS
                </span>
                <span style={{
                  fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                  background: isVerified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: isVerified ? '#10b981' : '#f59e0b',
                  border: `1px solid ${isVerified ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                }}>
                  {isVerified ? 'VERIFIED CITIZEN 🛡️' : 'UNVERIFIED ⚠️'}
                </span>
              </div>

              <div style={{ color: '#cbd5e1', fontSize: '12.5px', lineHeight: '1.7' }}>
                <div><b>Full Name:</b> {request.requester?.profile?.first_name || 'Citizen'} {request.requester?.profile?.last_name || ''}</div>
                <div><b>Phone / Callback:</b> <a href={`tel:${request.contact_number || request.requester?.phone_number}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '700' }}>{request.contact_number || request.requester?.phone_number || 'N/A'}</a></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '3px 0' }}>
                  <b>Emergency Categories:</b> <EmergencyBadges incident={request} size="small" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '3px 0' }}>
                  <b>Priority Level:</b> <CriticalBadge size="small" />
                </div>
                <div><b>Exact GPS:</b> <span className="mono-text" style={{ color: '#38bdf8' }}>{request.latitude}, {request.longitude}</span></div>
                <div><b>Spot / Landmark:</b> {request.address_location || 'GPS Location Captured'}</div>
              </div>

              {/* Full Description Callout */}
              <div style={{
                marginTop: '4px', padding: '10px 12px', borderRadius: '6px',
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
                color: '#f8fafc', fontSize: '12px'
              }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '2px' }}>INCIDENT SITUATION / USER NOTES:</div>
                <i>"{request.description || 'No description provided by sender.'}"</i>
              </div>
            </div>

            {/* Attached Photo Preview / Status */}
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontWeight: '800', color: request.photo_url ? '#38bdf8' : '#64748b', fontSize: '11px', letterSpacing: '1px' }}>
                ATTACHED INCIDENT MEDIA
              </span>
              {request.photo_url ? (
                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
                  <img
                    src={request.photo_url.startsWith('http') || request.photo_url.startsWith('/uploads') ? request.photo_url : `/uploads/${request.photo_url}`}
                    alt="Emergency Attachment"
                    style={{ width: '100%', height: '170px', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                    onClick={() => setShowFullPhoto(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFullPhoto(true)}
                    style={{
                      position: 'absolute', bottom: '6px', right: '6px',
                      background: 'rgba(0,0,0,0.75)', color: '#fff', border: '1px solid #555',
                      padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', cursor: 'pointer'
                    }}
                  >
                    🔍 ENLARGE PHOTO
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '30px 14px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)',
                  textAlign: 'center', color: '#64748b', fontSize: '12px'
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>📷</div>
                  <div style={{ fontWeight: '700', color: '#94a3b8' }}>NO MEDIA ATTACHED</div>
                  <div style={{ fontSize: '10.5px', marginTop: '2px' }}>Citizen submitted emergency with GPS and description only.</div>
                </div>
              )}
            </div>

          </div>

          {/* Fullscreen Photo Lightbox Modal */}
          {showFullPhoto && request.photo_url && (
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.95)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
              }}
              onClick={() => setShowFullPhoto(false)}
            >
              <img src={request.photo_url} alt="Full Incident" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }} />
            </div>
          )}

          {/* 1. MUNICIPAL SECTOR & SUB-ADMIN DISPATCHER DELEGATION */}
          <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.25)', padding: '14px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ color: '#38bdf8', marginBottom: 0 }}>
                1. ASSIGN TO MUNICIPAL SECTOR & SUB-ADMIN DISPATCHER
              </label>
              {loadingSubadmins && <span style={{ fontSize: '10px', color: '#38bdf8' }}>Loading sub-admins...</span>}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                  OPERATIONAL SECTOR
                </label>
                <select
                  className="tactical-input"
                  value={form.assigned_sector}
                  onChange={(e) => {
                    set('assigned_sector', e.target.value);
                    set('assigned_subadmin_id', null);
                  }}
                  style={{ cursor: 'pointer', fontWeight: '800' }}
                >
                  <option value="Santa Rita">Santa Rita Sector</option>
                  <option value="Porac">Porac Sector</option>
                  <option value="Guagua">Guagua Sector</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                  DUTY DISPATCHER (SUB-ADMIN)
                </label>
                <select
                  className="tactical-input"
                  value={form.assigned_subadmin_id || ''}
                  onChange={(e) => set('assigned_subadmin_id', e.target.value ? parseInt(e.target.value) : null)}
                  style={{ cursor: 'pointer', fontWeight: '800', color: '#38bdf8' }}
                >
                  <option value="">-- Select Sub-Admin Dispatcher --</option>
                  {subadminsList.map((s) => (
                    <option key={s.id} value={s.id} style={{ background: '#0b1120', color: '#fff' }}>
                      {s.name} ({s.sector}) • {s.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-Admin Confirmation Status Banner */}
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {request.subadmin_confirmed_at ? (
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✅</span>
                  <span>CONFIRMED: Sub-Admin confirmed incident receipt at {new Date(request.subadmin_confirmed_at).toLocaleTimeString()}. Dual alerts broadcasted.</span>
                </div>
              ) : form.assigned_subadmin_id ? (
                <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⏳</span>
                  <span>AWAITING SUB-ADMIN CONFIRMATION: Once assigned, the Sub-Admin will confirm receipt to notify both Admin & Citizen.</span>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  ℹ️ Delegating to a sector sub-admin will route this emergency directly to their tactical dispatch terminal.
                </div>
              )}
            </div>
          </div>

          {/* 2. Department & Inter-Agency Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                2. SELECT ASSIGNED DEPARTMENT / RESCUE SERVICE
              </label>
              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '800' }}>
                ⚡ AUTO-POPULATED FROM CITIZEN SOS ({selectedDepartments.length} ACTIVE)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {RESCUE_DEPARTMENTS.map((ag) => {
                const isSelected = selectedDepartments.includes(ag.id);
                return (
                  <button
                    type="button"
                    key={ag.id}
                    onClick={() => toggleDepartment(ag.id)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      background: isSelected ? `${ag.color}25` : 'rgba(255,255,255,0.04)',
                      border: isSelected ? `2px solid ${ag.color}` : '1px solid rgba(255,255,255,0.08)',
                      color: isSelected ? ag.color : '#94a3b8',
                      boxShadow: isSelected ? `0 0 12px ${ag.color}35` : 'none',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <div>{ag.label}</div>
                    {isSelected && (
                      <div style={{ fontSize: '9px', fontWeight: '900', color: ag.color, marginTop: '2px' }}>
                        ✓ SELECTED
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Quick Select Registered Responders Dropdown */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                {selectedDepartments.length === 1
                  ? `3. AVAILABLE ${selectedDepartments[0].toUpperCase()} UNITS IN ${(form.assigned_sector || request.municipality || 'SANTA RITA').toUpperCase()}`
                  : `3. AVAILABLE UNITS IN ${(form.assigned_sector || request.municipality || 'SANTA RITA').toUpperCase()} (${selectedDepartments.join(' + ').toUpperCase()} MULTI-AGENCY)`}
              </label>
              {loadingResponders && <span style={{ fontSize: '10px', color: '#38bdf8' }}>Loading units...</span>}
            </div>

            {selectedDepartments.length === 1 ? (
              <div>
                <select
                  className="tactical-input"
                  value={selectedRespondersByDept[selectedDepartments[0]]?.id || ''}
                  onChange={(e) => handleSelectResponderForDept(selectedDepartments[0], e.target.value)}
                  style={{ cursor: 'pointer', color: '#38bdf8', fontWeight: '700' }}
                >
                  <option value="">-- Choose Registered Field Responder Unit --</option>
                  {respondersList
                    .filter((r) => r.department.toLowerCase() === selectedDepartments[0].toLowerCase())
                    .map((r) => (
                      <option key={r.id} value={r.id} style={{ background: '#0b1120', color: r.is_available ? '#fff' : '#f43f5e' }}>
                        {r.name} • {r.unit} ({r.badge}) - {r.phone} {r.is_available ? '✓ [AVAILABLE]' : '⚠️ [BUSY ON MISSION]'}
                      </option>
                    ))}
                </select>
                {selectedRespondersByDept[selectedDepartments[0]] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px',
                      background: selectedRespondersByDept[selectedDepartments[0]].is_available ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                      color: selectedRespondersByDept[selectedDepartments[0]].is_available ? '#10b981' : '#f43f5e',
                      border: `1px solid ${selectedRespondersByDept[selectedDepartments[0]].is_available ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`
                    }}>
                      ● {selectedRespondersByDept[selectedDepartments[0]].is_available ? 'UNIT AVAILABLE FOR DISPATCH' : 'UNIT CURRENTLY ENGAGED (BUSY)'}
                    </span>
                    <span style={{ color: '#94a3b8' }}>
                      Agency: <b>{selectedRespondersByDept[selectedDepartments[0]].department}</b> • Call: {selectedRespondersByDept[selectedDepartments[0]].phone}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDepartments.map((dept) => {
                  const deptConf = RESCUE_DEPARTMENTS.find((d) => d.id === dept) || { color: '#0ea5e9', label: dept };
                  const assignedUnit = selectedRespondersByDept[dept];
                  const deptUnits = respondersList.filter((r) => r.department.toLowerCase() === dept.toLowerCase());

                  return (
                    <div
                      key={dept}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${deptConf.color}40`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '900', color: deptConf.color }}>
                          {deptConf.label}
                        </span>
                        {assignedUnit && (
                          <span style={{
                            padding: '1px 6px', borderRadius: '3px', fontSize: '9.5px', fontWeight: '800',
                            background: assignedUnit.is_available ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
                            color: assignedUnit.is_available ? '#10b981' : '#f43f5e',
                            border: `1px solid ${assignedUnit.is_available ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`
                          }}>
                            {assignedUnit.is_available ? '✓ AVAILABLE' : '⚠️ BUSY'}
                          </span>
                        )}
                      </div>
                      <select
                        className="tactical-input"
                        value={assignedUnit?.id || ''}
                        onChange={(e) => handleSelectResponderForDept(dept, e.target.value)}
                        style={{ cursor: 'pointer', color: '#f8fafc', fontWeight: '700', fontSize: '12px' }}
                      >
                        <option value="">-- Choose {dept} Response Unit --</option>
                        {deptUnits.map((r) => (
                          <option key={r.id} value={r.id} style={{ background: '#0b1120', color: r.is_available ? '#fff' : '#f43f5e' }}>
                            {r.name} • {r.unit} ({r.badge}) - {r.phone} {r.is_available ? '✓ [AVAILABLE]' : '⚠️ [BUSY ON MISSION]'}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Operational Status Pipeline */}
          <div>
            <label className="form-label">4. DISPATCH STATUS PIPELINE</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
              {STATUS_FLOW.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => set('status', s)}
                  style={{
                    padding: '8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', cursor: 'pointer',
                    background: form.status === s ? '#f43f5e' : 'rgba(255,255,255,0.04)',
                    border: form.status === s ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.08)',
                    color: form.status === s ? '#ffffff' : '#94a3b8',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Responder Assignment Form Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">ASSIGNED RESPONDER / COMMANDER</label>
              <input
                value={form.responder_name}
                onChange={(e) => set('responder_name', e.target.value)}
                placeholder="Commander Juan Santos"
                className="tactical-input"
                style={{ marginTop: '4px' }}
              />
            </div>
            <div>
              <label className="form-label">RESPONSE UNIT ID / VEHICLE</label>
              <input
                value={form.responder_unit}
                onChange={(e) => set('responder_unit', e.target.value)}
                placeholder="EMS Ambulance 1"
                className="tactical-input"
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">RESPONDER CONTACT NUMBER</label>
              <input
                value={form.responder_phone}
                onChange={(e) => set('responder_phone', e.target.value)}
                placeholder="0917-123-4567"
                className="tactical-input"
                style={{ marginTop: '4px' }}
              />
            </div>
            <div>
              <label className="form-label">DISPATCHER TACTICAL NOTES</label>
              <input
                value={form.dispatcher_notes}
                onChange={(e) => set('dispatcher_notes', e.target.value)}
                placeholder="Urgent dispatch required..."
                className="tactical-input"
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          {/* Contextual Guidance Banner */}
          {request.status === 'Pending' && (
            <div style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', padding: '10px', borderRadius: '6px', fontSize: '11.5px', color: '#38bdf8' }}>
              💡 <b>Next Step:</b> Accept this emergency and assign to the <b>{form.assigned_sector} Sector Sub-Admin</b>.
            </div>
          )}
          {request.status === 'Assigned' && !request.subadmin_confirmed_at && (
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', padding: '10px', borderRadius: '6px', fontSize: '11.5px', color: '#f59e0b' }}>
              ⏳ <b>Awaiting Sub-Admin Confirmation:</b> Incident assigned to {form.assigned_sector} Sector. The Duty Dispatcher must confirm to notify Citizen and Command.
            </div>
          )}
          {request.status === 'Assigned' && request.subadmin_confirmed_at && (
            <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '10px', borderRadius: '6px', fontSize: '11.5px', color: '#10b981' }}>
              ✓ <b>Sub-Admin Confirmed!</b> Dispatcher acknowledged emergency. Proceed to authorize deployment or assign field responder.
            </div>
          )}
          {request.status === 'Accepted' && (
            <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '10px', borderRadius: '6px', fontSize: '11.5px', color: '#10b981' }}>
              ✓ <b>Responder / Sub-Admin Accepted!</b> Click "DISPATCH RESPONDER" to authorize deployment and notify the citizen.
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
            {request.status === 'Pending' ? (
              <button
                onClick={() => handleSave('Assigned')}
                disabled={saving || !form.assigned_subadmin_id}
                className="tactical-btn"
                style={{
                  flex: 1, justifyContent: 'center', padding: '14px', fontSize: '13px',
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  boxShadow: '0 0 20px rgba(14,165,233,0.4)',
                  opacity: (!form.assigned_subadmin_id) ? 0.6 : 1
                }}
              >
                {saving ? 'ASSIGNING DISPATCHER...' : `⚡ ASSIGN DISPATCHER & NOTIFY SUB-ADMIN`}
              </button>
            ) : request.status === 'Accepted' ? (
              <button
                onClick={() => handleSave('Responder Dispatched')}
                disabled={saving}
                className="tactical-btn"
                style={{
                  flex: 1, justifyContent: 'center', padding: '14px', fontSize: '13px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 0 20px rgba(16,185,129,0.4)'
                }}
              >
                {saving ? 'DISPATCHING...' : '🚀 DISPATCH RESPONDER (AUTHORIZE MOVEMENT)'}
              </button>
            ) : (
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="tactical-btn"
                style={{
                  flex: 1, justifyContent: 'center', padding: '14px', fontSize: '13px',
                  background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                  boxShadow: '0 0 20px rgba(244,63,94,0.4)'
                }}
              >
                {saving ? 'SAVING...' : '✓ UPDATE INCIDENT DISPATCH STATUS'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="tactical-btn secondary"
              style={{ width: '100px', justifyContent: 'center' }}
            >
              CANCEL
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// Helper for town detection & styling
const MUNICIPALITIES = ['Porac', 'Santa Rita', 'Guagua'];
const TOWN_CONFIG = {
  Porac: { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.35)', coords: [15.0719, 120.5419], label: 'PORAC' },
  'Santa Rita': { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.35)', coords: [15.0006, 120.6128], label: 'SANTA RITA' },
  Guagua: { color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)', coords: [14.9667, 120.6333], label: 'GUAGUA' },
};

function detectMunicipality(obj) {
  if (obj?.municipality && ['Porac', 'Santa Rita', 'Guagua'].includes(obj.municipality)) {
    return obj.municipality;
  }
  const str = `${obj?.municipality || ''} ${obj?.city || ''} ${obj?.address_location || ''} ${obj?.address || ''} ${obj?.barangay || ''} ${obj?.requester?.profile?.city || ''} ${obj?.profile?.city || ''} ${obj?.profile?.address || ''} ${obj?.email || ''} ${obj?.profile?.headline || ''} ${obj?.profile?.responder_unit || ''} ${obj?.badge_or_unit_id || ''}`.toLowerCase();
  if (str.includes('santa rita') || str.includes('sta. rita') || str.includes('starita') || str.includes('santarita') || str.includes('san basilio') || str.includes('becuran') || str.includes('dila dila') || str.includes('str-')) return 'Santa Rita';
  if (str.includes('guagua') || str.includes('pulungmasle') || str.includes('ascomo') || str.includes('bancal') || str.includes('gua-')) return 'Guagua';
  if (str.includes('porac') || str.includes('cangatba') || str.includes('manibaug') || str.includes('pulung santol') || str.includes('inararo') || str.includes('por-')) return 'Porac';

  if (obj?.latitude && parseFloat(obj.latitude) !== 0) {
    const lat = parseFloat(obj.latitude);
    if (lat >= 15.035) return 'Porac';
    if (lat >= 14.985) return 'Santa Rita';
    return 'Guagua';
  }

  return 'Porac';
}

function MapFlyToCenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 13, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function AdminDashboard({ user, onLogout }) {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, active: 0, completed: 0, total: 0 });
  const [filter, setFilter] = useState('active_queue');

  // Pre-filter to Admin Hub if account belongs to Porac, Santa Rita, or Guagua
  const isSuperAdmin = user?.role === 'super_admin' || user?.email?.includes('superadmin');
  const userHub = user?.profile?.city && ['Porac', 'Santa Rita', 'Guagua'].includes(user.profile.city)
    ? user.profile.city
    : (user?.email?.includes('porac') ? 'Porac' : user?.email?.includes('santarita') ? 'Santa Rita' : user?.email?.includes('guagua') ? 'Guagua' : 'all');

  const assignedJurisdiction = isSuperAdmin ? 'all' : userHub;
  const isJurisdictionLocked = !isSuperAdmin && assignedJurisdiction !== 'all';

  const [townFilter, setTownFilter] = useState(isJurisdictionLocked ? assignedJurisdiction : 'all'); // all | Porac | Santa Rita | Guagua
  const [tab, setTab] = useState('incidents'); // incidents | map | users | fleet
  const [selected, setSelected] = useState(null);
  const [selectedUserDossier, setSelectedUserDossier] = useState(null);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userTownFilter, setUserTownFilter] = useState(isJurisdictionLocked ? assignedJurisdiction : 'all');
  const [userCategoryTab, setUserCategoryTab] = useState('citizens'); // 'admins' | 'sub_admins' | 'citizens' | 'responders'
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // 'all' | 'active' | 'deactivated'
  const [responderDeptFilter, setResponderDeptFilter] = useState('all'); // 'all' | 'Medical' | 'Police' | 'Fire' | 'Rescue'
  const [responderAvailabilityFilter, setResponderAvailabilityFilter] = useState('all'); // 'all' | 'Available' | 'Busy' | 'Offline'
  const [citizenKycFilter, setCitizenKycFilter] = useState('all'); // 'all' | 'verified' | 'unverified'
  const [showCreateSubAdminModal, setShowCreateSubAdminModal] = useState(false);

  const initialCoords = isJurisdictionLocked && TOWN_CONFIG[assignedJurisdiction]
    ? TOWN_CONFIG[assignedJurisdiction].coords
    : [15.0250, 120.5900];
  const [mapCenter, setMapCenter] = useState(initialCoords);
  const [mapZoom, setMapZoom] = useState(isJurisdictionLocked ? 14 : 12);
  const [mapIncidentFilter, setMapIncidentFilter] = useState('active'); // 'active' | 'all'
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const socketRef = useRef(null);

  const [subAdminForm, setSubAdminForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    unit_name: '',
    assigned_town: isJurisdictionLocked ? assignedJurisdiction : 'Porac',
  });
  const [creatingSub, setCreatingSub] = useState(false);
  const [subAdminMsg, setSubAdminMsg] = useState('');

  const [showCreateResponderModal, setShowCreateResponderModal] = useState(false);
  const [responderForm, setResponderForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
    department: 'Medical',
    municipality: isJurisdictionLocked ? assignedJurisdiction : 'Porac',
    unit_name: '',
    badge_number: '',
  });
  const [creatingResponder, setCreatingResponder] = useState(false);
  const [responderMsg, setResponderMsg] = useState('');

  const handleCreateResponder = async (e) => {
    if (e) e.preventDefault();
    setCreatingResponder(true);
    setResponderMsg('');
    try {
      const res = await api.post('/auth/responder', responderForm);
      if (res.data.success) {
        setResponderMsg(`✅ First Responder deployed successfully for ${responderForm.municipality} (${responderForm.department})!`);
        setResponderForm({
          first_name: '',
          last_name: '',
          email: '',
          password: '',
          phone_number: '',
          department: 'Medical',
          municipality: isJurisdictionLocked ? assignedJurisdiction : 'Porac',
          unit_name: '',
          badge_number: '',
        });
        loadUsers();
      } else {
        setResponderMsg('❌ ' + (res.data.message || 'Creation failed'));
      }
    } catch (err) {
      setResponderMsg('❌ ' + (err.response?.data?.message || err.message || 'Deployment failed'));
    } finally {
      setCreatingResponder(false);
    }
  };

  const [alertsList, setAlertsList] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [newAlertForm, setNewAlertForm] = useState({
    title: '',
    message: '',
    severity: 'High',
    alert_type: 'Typhoon/Flood',
    target_barangay: isJurisdictionLocked ? `All ${assignedJurisdiction}` : 'All Porac',
  });

  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Military Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadRequests();
    loadUsers();
    loadAlerts();
    loadAnalytics();
    initSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const loadAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await api.get('/alerts/all');
      if (res.data?.success) {
        setAlertsList(res.data.alerts || []);
      }
    } catch (e) {
      console.error('Failed to load alerts', e);
    } finally {
      setAlertsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get('/resq/analytics');
      if (res.data?.success) {
        setAnalyticsData(res.data);
      }
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!newAlertForm.title || !newAlertForm.message) {
      showNotification('Alert Title and Message are required.', 'error');
      return;
    }
    setCreatingAlert(true);
    try {
      const payload = {
        ...newAlertForm,
        target_municipality: isJurisdictionLocked ? assignedJurisdiction : (newAlertForm.target_municipality || 'All Municipalities'),
      };
      const res = await api.post('/alerts/create', payload);
      if (res.data?.success) {
        showNotification('📢 Public Emergency Alert broadcasted to all citizens!', 'success');
        setNewAlertForm({
          title: '',
          message: '',
          severity: 'High',
          alert_type: 'Typhoon/Flood',
          target_barangay: isJurisdictionLocked ? `All ${assignedJurisdiction}` : 'All Porac',
          target_municipality: isJurisdictionLocked ? assignedJurisdiction : 'All Municipalities',
        });
        loadAlerts();
      }
    } catch (e) {
      showNotification(e.response?.data?.message || 'Broadcast failed', 'error');
    } finally {
      setCreatingAlert(false);
    }
  };

  const toggleAlertStatus = async (id) => {
    try {
      const res = await api.patch(`/alerts/toggle/${id}`);
      if (res.data?.success) {
        setAlertsList((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: res.data.alert.is_active } : a)));
        showNotification(res.data.message, 'success');
      }
    } catch (e) {
      showNotification('Failed to toggle alert status', 'error');
    }
  };

  const deleteAlert = async (id) => {
    if (!window.confirm('Delete this public alert record?')) return;
    try {
      const res = await api.delete(`/alerts/${id}`);
      if (res.data?.success) {
        setAlertsList((prev) => prev.filter((a) => a.id !== id));
        showNotification('Alert deleted successfully.', 'info');
      }
    } catch (e) {
      showNotification('Failed to delete alert', 'error');
    }
  };

  const calculateCounts = (reqList = []) => ({
    pending: reqList.filter((r) => r.status === 'Pending').length,
    validated: reqList.filter((r) => r.status === 'Validated' || r.status === 'Accepted').length,
    active: reqList.filter((r) => isLiveEmergency(r.status)).length,
    resolved: reqList.filter((r) => ['Resolved', 'Completed', 'Closed'].includes(r.status)).length,
    cancelled: reqList.filter((r) => r.status === 'Cancelled').length,
    total: reqList.length,
  });

  const initSocket = () => {
    const sock = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    sock.emit('join_user_room', { userId: user.id, role: 'admin', hub: userHub !== 'all' ? userHub : null });

    sock.on('new_rescue_request', (data) => {
      setRequests((prev) => {
        const next = [data, ...prev.filter((r) => r.id !== data.id)];
        setCounts(calculateCounts(next));
        return next;
      });
      showNotification(`🚨 INCOMING SOS: ${data.emergency_type} in ${detectMunicipality(data)}`, 'alert');
      loadAnalytics();
      loadRequests();
    });

    sock.on('responder_accepted_assignment', (data) => {
      showNotification(`✓ Unit ${data.responderName || 'Responder'} ACCEPTED Emergency #${data.incidentId}! Ready to dispatch.`, 'alert');
      loadRequests();
    });

    sock.on('subadmin_confirmed_assignment', (data) => {
      showNotification(`✓ Duty Dispatcher ${data.subadminName || 'Sub-Admin'} (${data.sector || 'Sector'} Command) CONFIRMED Emergency #${data.incidentId}!`, 'alert');
      loadRequests();
    });

    sock.on('update_rescue_status', (data) => {
      const rid = data.id || data?.dataValues?.id;
      setRequests((prev) => {
        const next = prev.map((r) => (r.id === rid ? { ...r, ...data } : r));
        setCounts(calculateCounts(next));
        return next;
      });
      loadRequests();
      loadAnalytics();
    });

    sock.on('rescue_completed', (data) => {
      const rid = data.id || data?.dataValues?.id;
      setRequests((prev) => {
        const next = prev.map((r) => (r.id === rid ? { ...r, ...data, status: 'Completed' } : r));
        setCounts(calculateCounts(next));
        return next;
      });
      showNotification(`✓ Emergency #${rid || data?.id} safely RESOLVED and COMPLETED!`, 'success');
      loadRequests();
      loadAnalytics();
    });

    sock.on('emergency:status_change', (data) => {
      const rid = data.id || data?.dataValues?.id;
      setRequests((prev) => {
        const next = prev.map((r) => (r.id === rid ? { ...r, ...data } : r));
        setCounts(calculateCounts(next));
        return next;
      });
      loadRequests();
      loadAnalytics();
    });

    sock.on('responder_dispatched', (data) => {
      showNotification(`🚨 Responders Dispatched to Emergency #${data.id}!`, 'alert');
      loadRequests();
    });

    sock.on('responder_en_route', (data) => {
      showNotification(`🚀 Responders EN ROUTE to Emergency #${data.id}!`, 'info');
      loadRequests();
    });

    sock.on('responder_arrived', (data) => {
      showNotification(`📍 Responders ARRIVED at Scene #${data.id}!`, 'info');
      loadRequests();
    });

    sock.on('resq_live_location', (data) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === data.request_id
            ? { ...r, responder_lat: data.responder_lat, responder_lng: data.responder_lng, speed: data.speed }
            : r
        )
      );
    });

    sock.on('alert:broadcast', (newAlert) => {
      setAlertsList((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
    });
  };

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/resq/admin/all');
      if (res.data.success) {
        const fetched = res.data.requests || [];
        setRequests(fetched);
        setCounts(res.data.counts || calculateCounts(fetched));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  };

  const toggleUserActive = async (targetUser) => {
    try {
      const newStatus = !targetUser.is_active;
      const res = await api.patch(`/admin/users/${targetUser.id}/active`, { is_active: newStatus });
      if (res.data.success) {
        setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: newStatus } : u)));
        showNotification(`User account ${newStatus ? 'Activated' : 'Deactivated'} successfully.`, 'success');
      }
    } catch (e) {
      showNotification('Failed to update account status.', 'error');
    }
  };

  const toggleUserVerification = async (targetUser, newStatus) => {
    try {
      const res = await api.patch(`/admin/users/${targetUser.id}/verification`, {
        is_verified: newStatus === 'approved',
        verification_status: newStatus,
      });
      if (res.data.success) {
        setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_verified: newStatus === 'approved', verification_status: newStatus } : u)));
        if (selectedUserDossier?.id === targetUser.id) {
          setSelectedUserDossier((prev) => ({ ...prev, is_verified: newStatus === 'approved', verification_status: newStatus }));
        }
        showNotification(`User credentials: ${newStatus.toUpperCase()}`, 'success');
      }
    } catch (e) {
      showNotification('Failed to update verification status.', 'error');
    }
  };

  const dispatchRequest = async (id, form) => {
    const res = await api.put(`/resq/dispatch/${id}`, form);
    if (res.data.success) {
      setRequests((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, ...res.data.request } : r));
        setCounts(calculateCounts(next));
        return next;
      });
      showNotification(`Request #${id} status updated to: ${form.status}`, 'success');
      loadRequests();
      loadAnalytics();
    }
  };

  const createSubAdmin = async () => {
    setCreatingSub(true);
    setSubAdminMsg('');
    try {
      const res = await api.post('/auth/sub-admin', {
        ...subAdminForm,
        municipality: subAdminForm.assigned_town,
      });
      if (res.data.success) {
        setSubAdminMsg(`✅ Sub-Admin unit account deployed successfully for ${subAdminForm.assigned_town} HQ!`);
        setSubAdminForm({ email: '', password: '', first_name: '', last_name: '', phone_number: '', unit_name: '', assigned_town: 'Porac' });
        loadUsers();
      } else {
        setSubAdminMsg('❌ ' + (res.data.message || 'Creation failed'));
      }
    } catch (e) {
      setSubAdminMsg('❌ ' + (e.response?.data?.message || 'Creation failed'));
    }
    setCreatingSub(false);
  };

  // Filtered requests based on Status and Municipality (Active Queue vs Archived History)
  const filteredRequests = requests.filter((r) => {
    const matchesStatus =
      filter === 'active_queue' ? ['Pending', 'Assigned', 'Accepted', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress'].includes(r.status) :
      filter === 'pending' ? r.status === 'Pending' :
      filter === 'assigned' ? r.status === 'Assigned' :
      filter === 'accepted' ? r.status === 'Accepted' :
      filter === 'en_route' ? ['En Route', 'Responder Dispatched', 'Dispatched'].includes(r.status) :
      (filter === 'history' || filter === 'completed') ? ['Completed', 'Resolved', 'Closed', 'Cancelled'].includes(r.status) :
      filter === 'all' ? true : true;

    const incidentTown = detectMunicipality(r);
    const activeTownFilter = isJurisdictionLocked ? assignedJurisdiction : townFilter;
    const matchesTown = activeTownFilter === 'all' ? true : incidentTown === activeTownFilter;

    return matchesStatus && matchesTown;
  });

  // Filtered requests for the Tactical Map (respecting jurisdiction + Active vs All layer)
  const visibleMapRequests = requests.filter((r) => {
    if (!r.latitude || !r.longitude) return false;
    const incidentTown = detectMunicipality(r);
    const activeTownFilter = isJurisdictionLocked ? assignedJurisdiction : townFilter;
    const matchesTown = activeTownFilter === 'all' ? true : incidentTown === activeTownFilter;
    if (!matchesTown) return false;

    if (mapIncidentFilter === 'active') {
      return isLiveEmergency(r.status);
    }
    return true;
  });

  // Categorization & Role Classification Helpers
  const categorizeUser = (u) => {
    const r = (u.role || '').toLowerCase();
    if (['admin', 'super_admin', 'mdrrmo_admin'].includes(r)) return 'admins';
    if (['sub_admin'].includes(r)) return 'sub_admins';
    if (['responder', 'pnp_responder', 'bfp_responder'].includes(r)) return 'responders';
    return 'citizens';
  };

  const getResponderDept = (u) => {
    if (u.agency && ['Medical', 'Police', 'Fire', 'Rescue'].includes(u.agency)) return u.agency;
    const email = (u.email || '').toLowerCase();
    const headline = (u.profile?.headline || '').toLowerCase();
    const unit = (u.profile?.responder_unit || '').toLowerCase();
    if (email.includes('police') || headline.includes('police') || unit.includes('police') || u.role === 'pnp_responder') return 'Police';
    if (email.includes('fire') || headline.includes('fire') || unit.includes('fire') || u.role === 'bfp_responder') return 'Fire';
    if (email.includes('medic') || headline.includes('medic') || headline.includes('mdrrmo') || unit.includes('medic') || unit.includes('ambulance')) return 'Medical';
    if (headline.includes('rescue') || unit.includes('rescue') || u.agency === 'Rescue') return 'Rescue';
    return 'Medical';
  };

  const getResponderAvailability = (u) => {
    if (!u.is_active) {
      return {
        status: 'Offline',
        label: 'OFFLINE',
        color: '#64748b',
        bg: 'rgba(100,116,139,0.15)',
        border: 'rgba(100,116,139,0.3)',
        activeIncident: null,
        desc: 'Account Deactivated / Off-Duty'
      };
    }
    const activeIncident = requests.find(r => 
      r.assigned_responder_id === u.id && 
      ['Assigned', 'Accepted', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress'].includes(r.status)
    );
    if (activeIncident) {
      return {
        status: 'Busy',
        label: 'BUSY (ON MISSION)',
        color: '#f43f5e',
        bg: 'rgba(244,63,94,0.15)',
        border: 'rgba(244,63,94,0.35)',
        activeIncident,
        desc: `Incident #${activeIncident.id} (${activeIncident.emergency_type || 'Emergency'})`
      };
    }
    return {
      status: 'Available',
      label: 'AVAILABLE',
      color: '#10b981',
      bg: 'rgba(16,185,129,0.15)',
      border: 'rgba(16,185,129,0.35)',
      activeIncident: null,
      desc: 'Ready for emergency dispatch'
    };
  };

  // Category counts
  const userCategoryCounts = {
    all: users.length,
    admins: users.filter(u => categorizeUser(u) === 'admins').length,
    sub_admins: users.filter(u => categorizeUser(u) === 'sub_admins').length,
    citizens: users.filter(u => categorizeUser(u) === 'citizens').length,
    responders: users.filter(u => categorizeUser(u) === 'responders').length,
  };

  // Responders Department counts
  const responderDeptCounts = {
    all: users.filter(u => categorizeUser(u) === 'responders').length,
    Medical: users.filter(u => categorizeUser(u) === 'responders' && getResponderDept(u) === 'Medical').length,
    Police: users.filter(u => categorizeUser(u) === 'responders' && getResponderDept(u) === 'Police').length,
    Fire: users.filter(u => categorizeUser(u) === 'responders' && getResponderDept(u) === 'Fire').length,
    Rescue: users.filter(u => categorizeUser(u) === 'responders' && getResponderDept(u) === 'Rescue').length,
  };

  // Responders Availability counts
  const responderAvailabilityCounts = {
    all: users.filter(u => categorizeUser(u) === 'responders').length,
    Available: users.filter(u => categorizeUser(u) === 'responders' && getResponderAvailability(u).status === 'Available').length,
    Busy: users.filter(u => categorizeUser(u) === 'responders' && getResponderAvailability(u).status === 'Busy').length,
    Offline: users.filter(u => categorizeUser(u) === 'responders' && getResponderAvailability(u).status === 'Offline').length,
  };

  // Citizens KYC counts
  const citizenKycCounts = {
    all: users.filter(u => categorizeUser(u) === 'citizens').length,
    verified: users.filter(u => categorizeUser(u) === 'citizens' && (u.is_verified || u.verification_status === 'approved')).length,
    unverified: users.filter(u => categorizeUser(u) === 'citizens' && (!u.is_verified && u.verification_status !== 'approved')).length,
  };

  // Active Category Pool
  const categoryPoolUsers = users.filter(u => categorizeUser(u) === userCategoryTab);

  // Active Category Town Stats
  const categoryTownStats = {
    total: categoryPoolUsers.length,
    porac: categoryPoolUsers.filter(u => detectMunicipality(u) === 'Porac').length,
    santaRita: categoryPoolUsers.filter(u => detectMunicipality(u) === 'Santa Rita').length,
    guagua: categoryPoolUsers.filter(u => detectMunicipality(u) === 'Guagua').length,
  };

  // Filtered users for active category
  const filteredUsers = categoryPoolUsers.filter((u) => {
    const uTown = detectMunicipality(u);
    const activeUserTownFilter = isJurisdictionLocked ? assignedJurisdiction : userTownFilter;
    const matchesTown = activeUserTownFilter === 'all' ? true : uTown === activeUserTownFilter;

    // Search query
    const q = userSearchQuery.trim().toLowerCase();
    const fullName = `${u.profile?.first_name || ''} ${u.profile?.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone_number || '').toLowerCase();
    const idStr = String(u.id);
    const townStr = uTown.toLowerCase();
    const addressStr = `${u.profile?.barangay || ''} ${u.profile?.address || ''}`.toLowerCase();
    const badgeStr = `${u.profile?.responder_badge_number || ''} ${u.profile?.responder_unit || ''} ${u.badge_or_unit_id || ''}`.toLowerCase();
    const deptStr = getResponderDept(u).toLowerCase();

    const matchesSearch = !q ||
      fullName.includes(q) ||
      email.includes(q) ||
      phone.includes(q) ||
      idStr === q ||
      `#${idStr}` === q ||
      townStr.includes(q) ||
      addressStr.includes(q) ||
      badgeStr.includes(q) ||
      deptStr.includes(q);

    // Account status filter
    const matchesStatus =
      userStatusFilter === 'all' ? true :
      userStatusFilter === 'active' ? u.is_active :
      userStatusFilter === 'deactivated' ? !u.is_active : true;

    // Category-specific filters
    if (userCategoryTab === 'responders') {
      const matchesDept = responderDeptFilter === 'all' ? true : getResponderDept(u) === responderDeptFilter;
      const matchesAvail = responderAvailabilityFilter === 'all' ? true : getResponderAvailability(u).status === responderAvailabilityFilter;
      return matchesTown && matchesSearch && matchesStatus && matchesDept && matchesAvail;
    }

    if (userCategoryTab === 'citizens') {
      const matchesKyc =
        citizenKycFilter === 'all' ? true :
        citizenKycFilter === 'verified' ? (u.is_verified || u.verification_status === 'approved') :
        citizenKycFilter === 'unverified' ? (!u.is_verified && u.verification_status !== 'approved') : true;
      return matchesTown && matchesSearch && matchesStatus && matchesKyc;
    }

    return matchesTown && matchesSearch && matchesStatus;
  });

  // Global user breakdown statistics
  const userStats = {
    total: users.length,
    porac: users.filter((u) => detectMunicipality(u) === 'Porac').length,
    santaRita: users.filter((u) => detectMunicipality(u) === 'Santa Rita').length,
    guagua: users.filter((u) => detectMunicipality(u) === 'Guagua').length,
    verified: users.filter((u) => u.is_verified || u.verification_status === 'approved').length,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#070a13', color: '#f8fafc', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      
      {/* Embedded Global Styles */}
      <style>{`
        @keyframes resqPulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
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
          border-color: rgba(244, 63, 94, 0.3);
          transform: translateY(-1px);
        }
        .tactical-btn {
          background: #f43f5e;
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
          background: #e11d48;
          box-shadow: 0 0 14px rgba(244, 63, 94, 0.4);
        }
        .tactical-btn.secondary {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
        }
        .tactical-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .tactical-input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.4);
          color: #f8fafc;
          font-size: 12.5px;
          outline: none;
          box-sizing: border-box;
        }
        .tactical-input:focus {
          border-color: #f43f5e;
        }
        .form-label {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .mono-text {
          font-family: 'JetBrains Mono', monospace, sans-serif;
        }
        .nav-tab {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-weight: 700;
          font-size: 12px;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nav-tab.active {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.3);
        }
        .pill-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pill-btn.active {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border-color: rgba(244, 63, 94, 0.35);
        }
        .town-pill-porac.active {
          background: rgba(192, 132, 252, 0.18);
          color: #c084fc;
          border-color: rgba(192, 132, 252, 0.4);
        }
        .town-pill-santarita.active {
          background: rgba(56, 189, 248, 0.18);
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.4);
        }
        .town-pill-guagua.active {
          background: rgba(52, 211, 153, 0.18);
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.4);
        }
      `}</style>

      {/* TOP COMMAND HEADER */}
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
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f43f5e', boxShadow: '0 0 10px #f43f5e' }} />
            <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '2px', color: '#f8fafc' }}>
              RESQLINK<span style={{ color: '#f43f5e' }}>.ADMIN</span>
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
            {isSuperAdmin
              ? 'CENTRAL COMMAND NOC • PROVINCIAL JURISDICTION (PORAC | SANTA RITA | GUAGUA)'
              : `MUNICIPAL COMMAND DESK • ${assignedJurisdiction.toUpperCase()} OFFICIAL JURISDICTION`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>SYS TIME</span>
            <span className="mono-text" style={{ fontSize: '12px', fontWeight: '700', color: '#f43f5e' }}>{currentTime}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(244,63,94,0.1)', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(244,63,94,0.3)' }}>
            <span style={{ fontSize: '10px', color: '#f43f5e', fontWeight: '800' }}>ACTIVE SOS</span>
            <span className="mono-text" style={{ fontSize: '13px', fontWeight: '900', color: '#f43f5e' }}>{requests.filter(r => isLiveEmergency(r.status)).length}</span>
          </div>

          <button onClick={onLogout} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8',
            borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
          }}>
            LOGOUT
          </button>
        </div>
      </header>

      {/* KPI METRICS BAR */}
      <div style={{ padding: '16px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'ACTIVE INCIDENT QUEUE', val: requests.filter(r => isLiveEmergency(r.status)).length, icon: '📋', color: '#38bdf8' },
          { label: 'PENDING TRIAGE QUEUE', val: requests.filter(r => r.status === 'Pending').length, icon: '🚨', color: '#f43f5e' },
          { label: 'REGISTERED CITIZENS & FLEET', val: users.length || 0, icon: '👥', color: '#a855f7' },
          { label: 'RESOLVED & ARCHIVED INCIDENTS', val: requests.filter(r => ['Completed', 'Resolved', 'Closed'].includes(r.status)).length, icon: '✅', color: '#10b981' },
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

      {/* NAVIGATION TABS WITH ALERTS AND ANALYTICS */}
      <div style={{ padding: '16px 24px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'incidents', label: 'INCIDENTS COMMAND QUEUE', icon: '🚨', badge: counts.pending ? `${counts.pending}` : null },
          { id: 'map', label: 'REGIONAL TACTICAL MAP', icon: '🗺️' },
          { id: 'alerts', label: 'PUBLIC EMERGENCY ALERTS', icon: '📢', badge: alertsList.filter(a => a.is_active).length ? `${alertsList.filter(a => a.is_active).length}` : null },
          { id: 'analytics', label: 'REAL-TIME ANALYTICS & REPORTS', icon: '📊' },
          { id: 'users', label: 'USER MANAGEMENT', icon: '👥', badge: `${users.length}` },
          { id: 'fleet', label: 'FLEET & DISPATCHER DESK', icon: '📡' },
        ].map((t) => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge && (
              <span style={{
                background: tab === t.id ? '#f43f5e' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: '900'
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1: INCIDENTS COMMAND QUEUE ==================== */}
      {tab === 'incidents' && (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Dual Filtering Bar: Status + Municipality */}
          <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            
            {/* Municipality Sector Filter */}
            {isJurisdictionLocked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '6px 14px', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '900', color: '#38bdf8', letterSpacing: '0.5px' }}>
                  📍 {assignedJurisdiction.toUpperCase()} COMMAND JURISDICTION
                </span>
                <span style={{ fontSize: '9px', fontWeight: '800', background: '#38bdf8', color: '#070a13', padding: '1px 6px', borderRadius: '4px' }}>
                  ASSIGNED SECTOR
                </span>
                <span className="mono-text" style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>
                  ({filteredRequests.length} Incidents)
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="form-label">SECTOR:</span>
                <button
                  className={`pill-btn ${townFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTownFilter('all')}
                >
                  ALL TOWNS ({requests.length})
                </button>
                <button
                  className={`pill-btn town-pill-porac ${townFilter === 'Porac' ? 'active' : ''}`}
                  onClick={() => setTownFilter('Porac')}
                >
                  📍 PORAC ({requests.filter((r) => detectMunicipality(r) === 'Porac').length})
                </button>
                <button
                  className={`pill-btn town-pill-santarita ${townFilter === 'Santa Rita' ? 'active' : ''}`}
                  onClick={() => setTownFilter('Santa Rita')}
                >
                  📍 SANTA RITA ({requests.filter((r) => detectMunicipality(r) === 'Santa Rita').length})
                </button>
                <button
                  className={`pill-btn town-pill-guagua ${townFilter === 'Guagua' ? 'active' : ''}`}
                  onClick={() => setTownFilter('Guagua')}
                >
                  📍 GUAGUA ({requests.filter((r) => detectMunicipality(r) === 'Guagua').length})
                </button>
              </div>
            )}

            {/* Status Filter / Active vs History Queue Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span className="form-label">VIEW:</span>
              <button
                onClick={() => setFilter('active_queue')}
                className={`pill-btn ${filter === 'active_queue' ? 'active' : ''}`}
                style={filter === 'active_queue' ? { background: '#0284c7', color: '#fff', border: '1px solid #38bdf8' } : {}}
              >
                ⚡ ACTIVE QUEUE ({requests.filter(r => ['Pending', 'Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'On Scene'].includes(r.status)).length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`pill-btn ${filter === 'pending' ? 'active' : ''}`}
              >
                🚨 PENDING ({requests.filter(r => r.status === 'Pending').length})
              </button>
              <button
                onClick={() => setFilter('history')}
                className={`pill-btn ${filter === 'history' || filter === 'completed' ? 'active' : ''}`}
                style={filter === 'history' ? { background: '#059669', color: '#fff', border: '1px solid #10b981' } : {}}
              >
                📁 ARCHIVED / HISTORY ({requests.filter(r => ['Completed', 'Resolved', 'Cancelled', 'Closed'].includes(r.status)).length})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`pill-btn ${filter === 'all' ? 'active' : ''}`}
              >
                ALL RECORDS ({requests.length})
              </button>
              <button onClick={loadRequests} style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', marginLeft: '6px' }}>
                ↻ REFRESH
              </button>
            </div>
          </div>

          {/* Incident List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredRequests.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
                No emergency incidents found matching the selected municipality and status filters.
              </div>
            ) : (
              filteredRequests.map((r) => {
                const sev = SEVERITY_CONFIG[r.severity_level] || SEVERITY_CONFIG.Moderate;
                const town = detectMunicipality(r);
                const townConf = TOWN_CONFIG[town] || TOWN_CONFIG.Porac;

                return (
                  <div key={r.id} className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <CriticalWarningLogo size={46} />

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <EmergencyBadges incident={r} size="medium" />
                          
                          {/* Municipality Badge */}
                          <span style={{
                            fontSize: '9.5px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px',
                            background: townConf.bg, color: townConf.color, border: `1px solid ${townConf.border}`, letterSpacing: '0.5px'
                          }}>
                            📍 {townConf.label}
                          </span>

                          <CriticalBadge size="small" />
                          <span style={{
                            fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.06)', color: STATUS_COLOR[r.status] || '#cbd5e1'
                          }}>
                            {r.status.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                          📍 {r.address_location || 'GPS Captured'} • Reporter: <b style={{ color: '#cbd5e1' }}>{r.requester?.profile?.first_name || 'Citizen'}</b> ({r.contact_number || r.requester?.phone_number || 'N/A'})
                        </div>

                        {/* Assigned Dispatcher / Sub-Admin */}
                        <div style={{ fontSize: '11px', color: (r.assigned_subadmin || r.assigned_subadmin_id) ? '#38bdf8' : '#f59e0b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{(r.assigned_subadmin || r.assigned_subadmin_id) ? '👤 Assigned Dispatcher:' : '⚠️ Duty Dispatcher:'}</span>
                          <b>
                            {r.assigned_subadmin?.profile?.first_name
                              ? `${r.assigned_subadmin.profile.first_name} ${r.assigned_subadmin.profile.last_name || ''} (${r.assigned_sector || r.municipality || 'Sector'})`
                              : (r.assigned_subadmin_id ? `Dispatcher #${r.assigned_subadmin_id} (${r.assigned_sector || r.municipality || 'Operations'})` : 'Unassigned • Action Required')}
                          </b>
                          {r.subadmin_confirmed_at && (
                            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '800' }}>[✓ ACCEPTED]</span>
                          )}
                        </div>

                        {r.responder_name && (
                          <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>
                            ⚡ Assigned Force: <b>{r.responder_name}</b> ({r.responder_unit || 'Unit Alpha'})
                          </div>
                        )}

                        {/* Step-by-Step Status Tracker */}
                        <div style={{ marginTop: '10px', maxWidth: '620px' }}>
                          <EmergencyStatusTracker incident={r} compact={true} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {r.status === 'Accepted' && (
                        <button
                          className="tactical-btn"
                          style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            boxShadow: '0 0 12px rgba(16,185,129,0.4)',
                            fontWeight: '800',
                          }}
                          onClick={() => dispatchRequest(r.id, { status: 'Responder Dispatched' })}
                        >
                          🚀 DISPATCH RESPONDER
                        </button>
                      )}
                      
                      {r.status === 'Pending' && (
                        <button
                          className="tactical-btn"
                          style={{
                            background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                            boxShadow: '0 0 14px rgba(14,165,233,0.4)',
                            fontWeight: '800',
                          }}
                          onClick={() => setSelected(r)}
                        >
                          ⚡ ASSIGN DISPATCHER
                        </button>
                      )}

                      <button
                        className="tactical-btn secondary"
                        onClick={() => setSelected(r)}
                      >
                        MANAGE
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: REGIONAL TACTICAL MAP ==================== */}
      {tab === 'map' && (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Tactical Sector Control Bar */}
          <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            {isJurisdictionLocked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="form-label">TACTICAL SECTOR FOCUS:</span>
                <button
                  className="pill-btn active"
                  onClick={() => {
                    if (TOWN_CONFIG[assignedJurisdiction]) {
                      setMapCenter(TOWN_CONFIG[assignedJurisdiction].coords);
                      setMapZoom(14);
                    }
                  }}
                >
                  📍 {assignedJurisdiction.toUpperCase()} SECTOR (ASSIGNED JURISDICTION)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="form-label">TACTICAL SECTOR FOCUS:</span>
                <button
                  className={`pill-btn ${mapZoom === 12 ? 'active' : ''}`}
                  onClick={() => { setMapCenter([15.0250, 120.5900]); setMapZoom(12); }}
                >
                  🎯 TRI-MUNICIPALITY OVERVIEW (PORAC • STA. RITA • GUAGUA)
                </button>
                <button
                  className="pill-btn town-pill-porac"
                  onClick={() => { setMapCenter(TOWN_CONFIG.Porac.coords); setMapZoom(14); }}
                >
                  📍 PORAC SECTOR (15.0719, 120.5419)
                </button>
                <button
                  className="pill-btn town-pill-santarita"
                  onClick={() => { setMapCenter(TOWN_CONFIG['Santa Rita'].coords); setMapZoom(14); }}
                >
                  📍 SANTA RITA SECTOR (15.0006, 120.6128)
                </button>
                <button
                  className="pill-btn town-pill-guagua"
                  onClick={() => { setMapCenter(TOWN_CONFIG.Guagua.coords); setMapZoom(14); }}
                >
                  📍 GUAGUA SECTOR (14.9667, 120.6333)
                </button>
              </div>
            )}

            {/* Map Incident Layer Controls: LIVE ACTIVE ONLY vs ARCHIVED/ALL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="form-label">MAP LAYER:</span>
              <button
                className={`pill-btn ${mapIncidentFilter === 'active' ? 'active' : ''}`}
                onClick={() => setMapIncidentFilter('active')}
                style={mapIncidentFilter === 'active' ? { background: '#f43f5e', color: '#fff', borderColor: '#f43f5e', boxShadow: '0 0 10px rgba(244,63,94,0.35)' } : {}}
              >
                🚨 LIVE ACTIVE ONLY ({requests.filter(r => isLiveEmergency(r.status)).length})
              </button>
              <button
                className={`pill-btn ${mapIncidentFilter === 'all' ? 'active' : ''}`}
                onClick={() => setMapIncidentFilter('all')}
                style={mapIncidentFilter === 'all' ? { background: '#059669', color: '#fff', borderColor: '#10b981' } : {}}
              >
                📁 ALL / ARCHIVE ({requests.length})
              </button>
              <div style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                🗺️ Scope: <b>{isSuperAdmin ? 'Porac, Santa Rita, Guagua (Pampanga)' : `${assignedJurisdiction} Sector`}</b>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ height: 'calc(100vh - 280px)', overflow: 'hidden', position: 'relative' }}>
            {/* Status Alert Banner if No Active Incidents */}
            {mapIncidentFilter === 'active' && visibleMapRequests.length === 0 && (
              <div style={{
                position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 1000, background: 'rgba(7, 10, 19, 0.92)', border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10b981', padding: '8px 22px', borderRadius: '20px', fontSize: '12px', fontWeight: '800',
                letterSpacing: '0.5px', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                ALL SECTORS SECURE • NO ACTIVE SOS INCIDENTS
              </div>
            )}

            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%', background: '#090d16' }}
            >
              <MapFlyToCenter center={mapCenter} zoom={mapZoom} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className="tactical-dark-tile"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {/* Sector Hub Reference Markers */}
              {Object.entries(TOWN_CONFIG).map(([townName, conf]) => (
                <Marker
                  key={townName}
                  position={conf.coords}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.85); border: 2px solid ${conf.color}; color: ${conf.color}; font-size: 10px; font-weight: 900; white-space: nowrap; box-shadow: 0 0 10px ${conf.color}; transform: translate(-50%, -50%);">
                      🏛️ ${conf.label} COMMAND HUB
                    </div>`,
                    iconSize: [120, 24],
                    iconAnchor: [60, 12],
                  })}
                >
                  <Popup>
                    <b>{conf.label} Emergency Operations Desk</b><br />
                    Central Response Coordination Hub
                  </Popup>
                </Marker>
              ))}

              {/* Tactical Map: Dual Live Pins for Victims & Assigned Responders */}
              {visibleMapRequests.map((r) => {
                const town = detectMunicipality(r);
                const hasResponderGps = r.responder_lat && r.responder_lng && !isNaN(parseFloat(r.responder_lat)) && !isNaN(parseFloat(r.responder_lng)) && parseFloat(r.responder_lat) !== 0;
                const isActive = ['Assigned', 'Accepted', 'Responder Dispatched', 'Dispatched', 'En Route', 'Arrived', 'On Scene'].includes(r.status);
                const isCompleted = ['Completed', 'Resolved', 'Closed'].includes(r.status);
                const isCancelled = r.status === 'Cancelled';
                const markerIcon = isCompleted ? completedPin : (isCancelled ? cancelledPin : reqPin(r.severity_level));

                return (
                  <React.Fragment key={r.id}>
                    {/* Victim SOS Marker */}
                    <Marker
                      position={[parseFloat(r.latitude), parseFloat(r.longitude)]}
                      icon={markerIcon}
                    >
                      <Popup>
                        <div style={{ minWidth: '160px' }}>
                          <b style={{ color: isCompleted ? '#10b981' : (isCancelled ? '#94a3b8' : '#f43f5e') }}>
                            {isCompleted ? '✅ Resolved Incident' : (isCancelled ? '✕ Cancelled SOS' : '🆘 Emergency')} #{r.id} ({town})
                          </b><br />
                          <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <EmergencyBadges incident={r} size="small" />
                            <CriticalBadge size="small" />
                          </div>
                          <b>Status:</b> <span style={{ color: STATUS_COLOR[r.status] || '#fff', fontWeight: '700' }}>{r.status}</span><br />
                          <b>Victim:</b> {r.requester?.profile?.first_name || 'Citizen'} ({r.contact_number || 'N/A'})<br />
                          <b>Location:</b> {r.address_location || 'GPS'}<br />
                          {r.responder_name && (
                            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ddd', color: '#0ea5e9' }}>
                              🚑 <b>Unit:</b> {r.responder_unit || 'Unit-01'} ({r.responder_name})
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>

                    {/* Assigned Responder Live GPS Pin (When active) */}
                    {hasResponderGps && isActive && (
                      <>
                        <Marker
                          position={[parseFloat(r.responder_lat), parseFloat(r.responder_lng)]}
                          icon={responderTacticalPin}
                        >
                          <Popup>
                            <div style={{ minWidth: '150px' }}>
                              <b style={{ color: '#0ea5e9' }}>🚑 {r.responder_unit || 'Rescue Force'}</b><br />
                              <b>Assigned to:</b> SOS #{r.id}<br />
                              <b>Status:</b> {r.status}<br />
                              <b>Commander:</b> {r.responder_name || 'MDRRMO Alpha'}<br />
                              <b>Speed:</b> {r.speed || 0} km/h
                            </div>
                          </Popup>
                        </Marker>

                        {/* Dashed line connecting Responder to Victim */}
                        <Polyline
                          positions={[
                            [parseFloat(r.responder_lat), parseFloat(r.responder_lng)],
                            [parseFloat(r.latitude), parseFloat(r.longitude)]
                          ]}
                          pathOptions={{ color: '#38bdf8', weight: 3, opacity: 0.8, dashArray: '6, 6' }}
                        />
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </MapContainer>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: USER MANAGEMENT (ROLE-SEPARATED) ==================== */}
      {tab === 'users' && (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* PRIMARY CATEGORY SELECTION TABS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              {
                id: 'admins',
                title: 'ADMINISTRATORS',
                count: userCategoryCounts.admins,
                icon: '👑',
                color: '#f43f5e',
                border: '#f43f5e',
                desc: 'Full access, user governance, triage & reporting',
              },
              {
                id: 'sub_admins',
                title: 'SUB-ADMINISTRATORS',
                count: userCategoryCounts.sub_admins,
                icon: '🔰',
                color: '#38bdf8',
                border: '#38bdf8',
                desc: 'Municipal dispatch desks & localized triage',
              },
              {
                id: 'citizens',
                title: 'CITIZENS / USERS',
                count: userCategoryCounts.citizens,
                icon: '👥',
                color: '#10b981',
                border: '#10b981',
                desc: 'Resident SOS protection & emergency profiles',
              },
              {
                id: 'responders',
                title: 'FIRST RESPONDERS',
                count: userCategoryCounts.responders,
                icon: '🚑',
                color: '#f59e0b',
                border: '#f59e0b',
                desc: 'Medical, Police, Fire & Rescue tactical units',
              },
            ].map((cat) => {
              const isActive = userCategoryTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setUserCategoryTab(cat.id);
                    setUserTownFilter(isJurisdictionLocked ? assignedJurisdiction : 'all');
                  }}
                  className="glass-panel"
                  style={{
                    padding: '16px 18px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: isActive ? `linear-gradient(135deg, rgba(13, 18, 36, 0.95), ${cat.color}18)` : 'rgba(13, 18, 36, 0.65)',
                    borderColor: isActive ? cat.color : 'rgba(255,255,255,0.08)',
                    boxShadow: isActive ? `0 0 20px ${cat.color}30` : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isActive && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: cat.color }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: isActive ? '#f8fafc' : '#94a3b8', letterSpacing: '0.5px' }}>
                        {cat.title}
                      </span>
                    </div>
                    <span
                      className="mono-text"
                      style={{
                        fontSize: '14px',
                        fontWeight: '900',
                        color: cat.color,
                        background: `${cat.color}15`,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${cat.color}40`,
                      }}
                    >
                      {cat.count}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', lineHeight: '1.4' }}>
                    {cat.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ACTIVE CATEGORY CONTEXTUAL BANNER */}
          <div
            className="glass-panel"
            style={{
              padding: '16px 20px',
              borderLeft: `4px solid ${
                userCategoryTab === 'admins' ? '#f43f5e' :
                userCategoryTab === 'sub_admins' ? '#38bdf8' :
                userCategoryTab === 'citizens' ? '#10b981' : '#f59e0b'
              }`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>
                  {userCategoryTab === 'admins' ? '👑' :
                   userCategoryTab === 'sub_admins' ? '🔰' :
                   userCategoryTab === 'citizens' ? '👥' : '🚑'}
                </span>
                <span style={{ fontWeight: '900', fontSize: '15px', color: '#f8fafc', letterSpacing: '0.5px' }}>
                  {userCategoryTab === 'admins' ? 'ADMINISTRATORS (FULL COMMAND ACCESS)' :
                   userCategoryTab === 'sub_admins' ? 'SUB-ADMINISTRATORS (MUNICIPAL DISPATCH DESKS)' :
                   userCategoryTab === 'citizens' ? 'REGISTERED CITIZENS DIRECTORY' :
                   'EMERGENCY FIRST RESPONDERS & TACTICAL UNITS'}
                </span>
                <span className="mono-text" style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                  {filteredUsers.length} shown of {categoryPoolUsers.length} total
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px', maxWidth: '850px', lineHeight: '1.45' }}>
                {userCategoryTab === 'admins' && (
                  <>Admins hold unrestricted administrative privileges across Resqlink. Responsible for assigning emergency responders, monitoring triage queues, reviewing system security audit logs, managing municipal user accounts, and generating reports across Porac, Santa Rita, and Guagua.</>
                )}
                {userCategoryTab === 'sub_admins' && (
                  <>Sub-Admins operate localized municipal dispatch terminals. They handle sector incident intake, verify local citizen identities, and direct municipal response units with scoped access granted by central Command.</>
                )}
                {userCategoryTab === 'citizens' && (
                  <>Resident accounts registered for emergency SOS protection and telemetry. Displays verification status, contact information, municipality (Porac, Santa Rita, or Guagua), and health/emergency contact details.</>
                )}
                {userCategoryTab === 'responders' && (
                  <>Tactical response personnel separated by operational department: Medical (EMS/Ambulance), Police (PNP), Fire (BFP), and MDRRMO/Rescue. Live telemetry tracks availability status, unit call-signs, and current incident assignments.</>
                )}
              </div>
            </div>

            {/* Contextual Action Button */}
            {userCategoryTab === 'sub_admins' && (
              <button
                onClick={() => setShowCreateSubAdminModal(true)}
                className="tactical-btn"
                style={{
                  background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                  color: '#fff',
                  padding: '10px 16px',
                  fontSize: '12px',
                  fontWeight: '800',
                  boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)',
                }}
              >
                + DEPLOY NEW SUB-ADMIN UNIT
              </button>
            )}
            {userCategoryTab === 'responders' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981' }}>{responderAvailabilityCounts.Available} AVAILABLE</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e', animation: 'resqPulse 1.5s infinite' }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#f43f5e' }}>{responderAvailabilityCounts.Busy} BUSY ON CALL</span>
                </div>
                <button
                  onClick={() => setShowCreateResponderModal(true)}
                  className="tactical-btn"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    padding: '8px 14px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)',
                  }}
                >
                  + DEPLOY NEW FIRST RESPONDER
                </button>
              </div>
            )}
          </div>

          {/* FILTERING & SEARCH CONTROLS TOOLBAR */}
          <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Primary Row: Search + Municipality Filter */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              
              {/* Municipality Filter Pills */}
              {isJurisdictionLocked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '5px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#38bdf8' }}>
                    📍 {assignedJurisdiction.toUpperCase()} RESIDENTS & PERSONNEL JURISDICTION
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: '800', background: '#38bdf8', color: '#070a13', padding: '1px 5px', borderRadius: '4px' }}>
                    LOCKED SECTOR
                  </span>
                  <span className="mono-text" style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>
                    ({filteredUsers.length} Users)
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span className="form-label">MUNICIPALITY:</span>
                  <button
                    className={`pill-btn ${userTownFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setUserTownFilter('all')}
                  >
                    ALL TOWNS ({categoryTownStats.total})
                  </button>
                  <button
                    className={`pill-btn town-pill-porac ${userTownFilter === 'Porac' ? 'active' : ''}`}
                    onClick={() => setUserTownFilter('Porac')}
                  >
                    📍 PORAC ({categoryTownStats.porac})
                  </button>
                  <button
                    className={`pill-btn town-pill-santarita ${userTownFilter === 'Santa Rita' ? 'active' : ''}`}
                    onClick={() => setUserTownFilter('Santa Rita')}
                  >
                    📍 SANTA RITA ({categoryTownStats.santaRita})
                  </button>
                  <button
                    className={`pill-btn town-pill-guagua ${userTownFilter === 'Guagua' ? 'active' : ''}`}
                    onClick={() => setUserTownFilter('Guagua')}
                  >
                    📍 GUAGUA ({categoryTownStats.guagua})
                  </button>
                </div>
              )}

              {/* Live Search Input */}
              <div style={{ width: '320px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder={`🔍 Search ${userCategoryTab === 'responders' ? 'responder, unit, department...' : userCategoryTab === 'citizens' ? 'citizen, email, phone...' : 'name, email, ID...'}`}
                  className="tactical-input"
                  style={{ padding: '8px 30px 8px 12px', fontSize: '12px' }}
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
                {userSearchQuery && (
                  <button
                    onClick={() => setUserSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Secondary Row: Category-Specific Filters + Account Status */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              
              {/* RESPONDERS: Department Sub-Tabs */}
              {userCategoryTab === 'responders' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span className="form-label">DEPARTMENT:</span>
                  {[
                    { id: 'all', label: `ALL (${responderDeptCounts.all})`, icon: '' },
                    { id: 'Medical', label: `MEDICAL (${responderDeptCounts.Medical})`, icon: '🚑' },
                    { id: 'Police', label: `POLICE (${responderDeptCounts.Police})`, icon: '🚔' },
                    { id: 'Fire', label: `FIRE (${responderDeptCounts.Fire})`, icon: '🚒' },
                    { id: 'Rescue', label: `RESCUE (${responderDeptCounts.Rescue})`, icon: '⛑️' },
                  ].map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => setResponderDeptFilter(dept.id)}
                      className={`pill-btn ${responderDeptFilter === dept.id ? 'active' : ''}`}
                      style={{ fontSize: '10.5px', padding: '4px 9px' }}
                    >
                      {dept.icon} {dept.label}
                    </button>
                  ))}
                </div>
              )}

              {/* RESPONDERS: Availability Status Filter */}
              {userCategoryTab === 'responders' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="form-label">AVAILABILITY:</span>
                  {[
                    { id: 'all', label: `ALL (${responderAvailabilityCounts.all})` },
                    { id: 'Available', label: `🟢 AVAILABLE (${responderAvailabilityCounts.Available})` },
                    { id: 'Busy', label: `🔴 BUSY (${responderAvailabilityCounts.Busy})` },
                    { id: 'Offline', label: `⚪ OFFLINE (${responderAvailabilityCounts.Offline})` },
                  ].map((av) => (
                    <button
                      key={av.id}
                      onClick={() => setResponderAvailabilityFilter(av.id)}
                      className={`pill-btn ${responderAvailabilityFilter === av.id ? 'active' : ''}`}
                      style={{ fontSize: '10px', padding: '4px 8px' }}
                    >
                      {av.label}
                    </button>
                  ))}
                </div>
              )}

              {/* CITIZENS: KYC Verification Status Filter */}
              {userCategoryTab === 'citizens' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="form-label">KYC VERIFICATION:</span>
                  {[
                    { id: 'all', label: `ALL (${citizenKycCounts.all})` },
                    { id: 'verified', label: `✓ VERIFIED (${citizenKycCounts.verified})` },
                    { id: 'unverified', label: `⏳ PENDING / UNVERIFIED (${citizenKycCounts.unverified})` },
                  ].map((kyc) => (
                    <button
                      key={kyc.id}
                      onClick={() => setCitizenKycFilter(kyc.id)}
                      className={`pill-btn ${citizenKycFilter === kyc.id ? 'active' : ''}`}
                      style={{ fontSize: '10px', padding: '4px 8px' }}
                    >
                      {kyc.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Common Account Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="form-label">ACCOUNT STATUS:</span>
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'active', label: 'ACTIVE' },
                  { id: 'deactivated', label: 'DEACTIVATED / SUSPENDED' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setUserStatusFilter(s.id)}
                    className={`pill-btn ${userStatusFilter === s.id ? 'active' : ''}`}
                    style={{ fontSize: '10px', padding: '4px 8px' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadUsers}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f43f5e', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                ↻ REFRESH USERS
              </button>
            </div>
          </div>

          {/* DEDICATED TABLE CONTAINER */}
          <div className="glass-panel" style={{ padding: '18px', overflowX: 'auto' }}>
            
            {usersLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading directory records...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
                No {userCategoryTab} accounts found matching the current municipality or search filters.
              </div>
            ) : (
              <>
                {/* 1. ADMINISTRATORS TABLE */}
                {userCategoryTab === 'admins' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>ADMINISTRATOR IDENTITY</th>
                        <th style={{ padding: '10px' }}>MUNICIPAL HUB / JURISDICTION</th>
                        <th style={{ padding: '10px' }}>PRIVILEGE LEVEL</th>
                        <th style={{ padding: '10px' }}>SYSTEM CAPABILITIES</th>
                        <th style={{ padding: '10px' }}>ACCOUNT STATUS</th>
                        <th style={{ padding: '10px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const uTown = detectMunicipality(u);
                        const tConf = TOWN_CONFIG[uTown] || TOWN_CONFIG.Porac;
                        const isSuper = u.role === 'super_admin';

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '36px', height: '36px', borderRadius: '50%',
                                  background: isSuper ? 'linear-gradient(135deg, rgba(244,63,94,0.3), rgba(225,29,72,0.5))' : 'rgba(192,132,252,0.2)',
                                  border: isSuper ? '1.5px solid #f43f5e' : '1.5px solid #c084fc',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                                }}>
                                  {isSuper ? '👑' : '🛡️'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {u.profile?.first_name || 'Admin'} {u.profile?.last_name || ''}
                                    <span className="mono-text" style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>#{u.id}</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {u.email} • {u.phone_number || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                                background: isSuper ? 'rgba(244,63,94,0.15)' : tConf.bg,
                                color: isSuper ? '#f43f5e' : tConf.color,
                                border: `1px solid ${isSuper ? '#f43f5e' : tConf.border}`,
                                letterSpacing: '0.5px'
                              }}>
                                📍 {isSuper ? 'CENTRAL COMMAND (ALL HUBS)' : tConf.label}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '9.5px', fontWeight: '900', padding: '3px 8px', borderRadius: '4px',
                                background: isSuper ? 'rgba(244,63,94,0.2)' : 'rgba(192,132,252,0.15)',
                                color: isSuper ? '#f43f5e' : '#c084fc',
                                border: `1px solid ${isSuper ? '#f43f5e' : '#c084fc'}`,
                              }}>
                                {isSuper ? 'SUPER ADMIN' : 'MDRRMO ADMIN'}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                                  ⚡ Dispatch Control
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                                  👥 User Governance
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                                  📊 Reports & NOC
                                </span>
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
                                background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                                color: u.is_active ? '#10b981' : '#f43f5e',
                                border: `1px solid ${u.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                              }}>
                                {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => setSelectedUserDossier(u)}
                                  style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  DOSSIER
                                </button>
                                {u.id !== user.id && (
                                  <button
                                    onClick={() => toggleUserActive(u)}
                                    style={{
                                      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                      color: u.is_active ? '#f43f5e' : '#10b981', padding: '4px 8px', borderRadius: '4px',
                                      fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                    }}
                                  >
                                    {u.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* 2. SUB-ADMINISTRATORS TABLE */}
                {userCategoryTab === 'sub_admins' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>SUB-ADMIN / DISPATCHER</th>
                        <th style={{ padding: '10px' }}>ASSIGNED SECTOR HQ</th>
                        <th style={{ padding: '10px' }}>CALL-SIGN / UNIT</th>
                        <th style={{ padding: '10px' }}>PERMISSIONS SCOPE</th>
                        <th style={{ padding: '10px' }}>ACCOUNT STATUS</th>
                        <th style={{ padding: '10px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const uTown = detectMunicipality(u);
                        const tConf = TOWN_CONFIG[uTown] || TOWN_CONFIG.Porac;

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '36px', height: '36px', borderRadius: '50%',
                                  background: 'rgba(56,189,248,0.2)', border: '1.5px solid #38bdf8',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                                }}>
                                  🔰
                                </div>
                                <div>
                                  <div style={{ fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {u.profile?.first_name || 'Sub-Admin'} {u.profile?.last_name || ''}
                                    <span className="mono-text" style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>#{u.id}</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {u.email} • {u.phone_number || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                                background: tConf.bg, color: tConf.color, border: `1px solid ${tConf.border}`, letterSpacing: '0.5px'
                              }}>
                                📍 {tConf.label} SECTOR HQ
                              </span>
                            </td>

                            <td style={{ padding: '10px', color: '#cbd5e1' }}>
                              <span style={{ fontWeight: '700', color: '#38bdf8' }}>
                                {u.profile?.responder_unit || u.badge_or_unit_id || `${uTown} Dispatch Terminal`}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '3px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>
                                  📡 Local Sector Triage
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '3px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>
                                  📋 Citizen Vetting
                                </span>
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
                                background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                                color: u.is_active ? '#10b981' : '#f43f5e',
                                border: `1px solid ${u.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                              }}>
                                {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => setSelectedUserDossier(u)}
                                  style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  DOSSIER
                                </button>
                                <button
                                  onClick={() => toggleUserActive(u)}
                                  style={{
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                    color: u.is_active ? '#f43f5e' : '#10b981', padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  {u.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* 3. CITIZENS / REGISTERED USERS TABLE */}
                {userCategoryTab === 'citizens' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>CITIZEN IDENTITY</th>
                        <th style={{ padding: '10px' }}>MUNICIPALITY (PAMPANGA)</th>
                        <th style={{ padding: '10px' }}>BARANGAY / ADDRESS</th>
                        <th style={{ padding: '10px' }}>KYC STATUS</th>
                        <th style={{ padding: '10px' }}>ACCOUNT STATUS</th>
                        <th style={{ padding: '10px' }}>HEALTH & EMERGENCY PROFILE</th>
                        <th style={{ padding: '10px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const uTown = detectMunicipality(u);
                        const tConf = TOWN_CONFIG[uTown] || TOWN_CONFIG.Porac;
                        const isVer = u.is_verified || u.verification_status === 'approved';

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                  {u.profile?.avatar_url ? (
                                    <img src={u.profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                  ) : (
                                    '👤'
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {u.profile?.first_name || 'Citizen'} {u.profile?.last_name || ''}
                                    <span className="mono-text" style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>#{u.id}</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {u.email} • {u.phone_number || 'No phone'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                                background: tConf.bg, color: tConf.color, border: `1px solid ${tConf.border}`, letterSpacing: '0.5px'
                              }}>
                                📍 {tConf.label}
                              </span>
                            </td>

                            <td style={{ padding: '10px', color: '#cbd5e1' }}>
                              {u.profile?.barangay || u.profile?.address || `${uTown}, Pampanga`}
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                                background: isVer ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                color: isVer ? '#10b981' : '#f59e0b',
                                border: `1px solid ${isVer ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                              }}>
                                {isVer ? '✓ VERIFIED' : '⏳ PENDING KYC'}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
                                background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                                color: u.is_active ? '#10b981' : '#f43f5e',
                                border: `1px solid ${u.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                              }}>
                                {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.3)' }}>
                                  🩸 {u.profile?.blood_type || 'Unknown'}
                                </span>
                                {u.profile?.emergency_contact_phone && (
                                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }} title={`Emergency: ${u.profile?.emergency_contact_name || 'Kin'} (${u.profile?.emergency_contact_phone})`}>
                                    📞 SOS Kin Ready
                                  </span>
                                )}
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {!isVer && (
                                  <button
                                    onClick={() => toggleUserVerification(u, 'approved')}
                                    style={{
                                      background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981',
                                      color: '#10b981', padding: '4px 8px', borderRadius: '4px',
                                      fontSize: '10.5px', fontWeight: '800', cursor: 'pointer'
                                    }}
                                  >
                                    ✓ VET & APPROVE
                                  </button>
                                )}
                                <button
                                  onClick={() => setSelectedUserDossier(u)}
                                  style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  DOSSIER
                                </button>
                                <button
                                  onClick={() => toggleUserActive(u)}
                                  style={{
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                    color: u.is_active ? '#f43f5e' : '#10b981', padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  {u.is_active ? 'SUSPEND' : 'ACTIVATE'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* 4. RESPONDERS TABLE */}
                {userCategoryTab === 'responders' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>RESPONDER IDENTITY</th>
                        <th style={{ padding: '10px' }}>DEPARTMENT</th>
                        <th style={{ padding: '10px' }}>MUNICIPALITY</th>
                        <th style={{ padding: '10px' }}>UNIT CALL-SIGN & BADGE</th>
                        <th style={{ padding: '10px' }}>AVAILABILITY STATUS</th>
                        <th style={{ padding: '10px' }}>CURRENT ASSIGNMENT</th>
                        <th style={{ padding: '10px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const uTown = detectMunicipality(u);
                        const tConf = TOWN_CONFIG[uTown] || TOWN_CONFIG.Porac;
                        const dept = getResponderDept(u);
                        const deptMeta = DEPT_CONFIG[dept] || DEPT_CONFIG.Medical;
                        const avail = getResponderAvailability(u);

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '38px', height: '38px', borderRadius: '50%',
                                  background: deptMeta.bg, border: `1.5px solid ${deptMeta.border}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
                                }}>
                                  {deptMeta.icon}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {u.profile?.first_name || u.profile?.full_name || 'Responder'} {u.profile?.last_name || ''}
                                    <span className="mono-text" style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>#{u.id}</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {u.email} • {u.phone_number || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '900', padding: '3px 9px', borderRadius: '4px',
                                background: deptMeta.bg, color: deptMeta.color, border: `1px solid ${deptMeta.border}`,
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}>
                                <span>{deptMeta.icon}</span>
                                <span>{dept.toUpperCase()} RESPONDER</span>
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                                background: tConf.bg, color: tConf.color, border: `1px solid ${tConf.border}`, letterSpacing: '0.5px'
                              }}>
                                📍 {tConf.label}
                              </span>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '12px' }}>
                                {u.profile?.responder_unit || `${dept} Unit Alpha`}
                              </div>
                              <div className="mono-text" style={{ fontSize: '10.5px', color: '#64748b' }}>
                                BADGE: {u.profile?.responder_badge_number || u.badge_or_unit_id || 'N/A'}
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '4px', background: avail.bg, border: `1px solid ${avail.border}` }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: avail.color, boxShadow: `0 0 6px ${avail.color}` }} />
                                <span style={{ fontSize: '10px', fontWeight: '900', color: avail.color }}>
                                  {avail.label}
                                </span>
                              </div>
                            </td>

                            <td style={{ padding: '10px' }}>
                              {avail.activeIncident ? (
                                <button
                                  onClick={() => setSelected(avail.activeIncident)}
                                  style={{
                                    background: 'rgba(244,63,94,0.15)', border: '1px solid #f43f5e',
                                    color: '#f43f5e', padding: '3px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '800', cursor: 'pointer', textAlign: 'left'
                                  }}
                                >
                                  🚨 Incident #{avail.activeIncident.id} ({avail.activeIncident.status})
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                                  ✓ Standby (Unassigned)
                                </span>
                              )}
                            </td>

                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => setSelectedUserDossier(u)}
                                  style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  DOSSIER
                                </button>
                                <button
                                  onClick={() => toggleUserActive(u)}
                                  style={{
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                    color: u.is_active ? '#f43f5e' : '#10b981', padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  {u.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: QUICK DEPLOY SUB-ADMIN UNIT */}
      {showCreateSubAdminModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={(e) => e.target === e.currentTarget && setShowCreateSubAdminModal(false)}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px', background: 'rgba(9, 13, 26, 0.98)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '900', fontSize: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔰</span>
                <span>DEPLOY MUNICIPAL SUB-ADMIN / DISPATCHER</span>
              </div>
              <button onClick={() => setShowCreateSubAdminModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {subAdminMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '12px', background: subAdminMsg.includes('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: subAdminMsg.includes('✅') ? '#10b981' : '#f43f5e', border: `1px solid ${subAdminMsg.includes('✅') ? '#10b981' : '#f43f5e'}` }}>
                {subAdminMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">ASSIGNED MUNICIPALITY SECTOR</label>
                {isJurisdictionLocked ? (
                  <div style={{ marginTop: '4px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '800' }}>
                    📍 {assignedJurisdiction} Municipal Sector (Locked to your Jurisdiction)
                  </div>
                ) : (
                  <select
                    className="tactical-input"
                    style={{ marginTop: '4px', background: '#090d16', color: '#f8fafc', cursor: 'pointer' }}
                    value={subAdminForm.assigned_town}
                    onChange={(e) => setSubAdminForm((f) => ({ ...f, assigned_town: e.target.value }))}
                  >
                    <option value="Porac">Porac Municipal Sector</option>
                    <option value="Santa Rita">Santa Rita Municipal Sector</option>
                    <option value="Guagua">Guagua Municipal Sector</option>
                  </select>
                )}
              </div>

              <div>
                <label className="form-label">DISPATCH UNIT / CALL-SIGN</label>
                <input
                  type="text"
                  placeholder="e.g. Santa Rita Triage Desk 1"
                  className="tactical-input"
                  style={{ marginTop: '4px' }}
                  value={subAdminForm.unit_name}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, unit_name: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">FIRST NAME</label>
                  <input
                    type="text"
                    placeholder="First Name"
                    className="tactical-input"
                    style={{ marginTop: '4px' }}
                    value={subAdminForm.first_name}
                    onChange={(e) => setSubAdminForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">LAST NAME</label>
                  <input
                    type="text"
                    placeholder="Last Name"
                    className="tactical-input"
                    style={{ marginTop: '4px' }}
                    value={subAdminForm.last_name}
                    onChange={(e) => setSubAdminForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">OFFICIAL EMAIL ADDRESS</label>
                <input
                  type="email"
                  placeholder="subadmin.sector@resqlink.gov.ph"
                  className="tactical-input"
                  style={{ marginTop: '4px' }}
                  value={subAdminForm.email}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">PHONE NUMBER</label>
                <input
                  type="text"
                  placeholder="0917-000-0000"
                  className="tactical-input"
                  style={{ marginTop: '4px' }}
                  value={subAdminForm.phone_number}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, phone_number: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">TEMPORARY PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="tactical-input"
                  style={{ marginTop: '4px' }}
                  value={subAdminForm.password}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateSubAdminModal(false)}
                  className="tactical-btn secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await createSubAdmin();
                    setTimeout(() => setShowCreateSubAdminModal(false), 1500);
                  }}
                  disabled={creatingSub || !subAdminForm.email || !subAdminForm.password}
                  className="tactical-btn"
                  style={{
                    flex: 2,
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                  }}
                >
                  {creatingSub ? 'DEPLOYING UNIT...' : '🚀 DEPLOY SUB-ADMIN ACCOUNT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: FLEET & DISPATCHER DESK ==================== */}
      {tab === 'fleet' && (
        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px' }}>
          
          {/* Deploy Sub-Admin Form */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '12px', color: '#f8fafc' }}>
              DEPLOY NEW DISPATCHER / SUB-ADMIN UNIT
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="form-label">ASSIGNED MUNICIPALITY SECTOR</label>
                {isJurisdictionLocked ? (
                  <div style={{ marginTop: '3px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '800' }}>
                    📍 {assignedJurisdiction} Command Sector (Locked to your Jurisdiction)
                  </div>
                ) : (
                  <select
                    className="tactical-input"
                    style={{ marginTop: '3px', background: '#090d16', color: '#f8fafc', cursor: 'pointer' }}
                    value={subAdminForm.assigned_town}
                    onChange={(e) => setSubAdminForm((f) => ({ ...f, assigned_town: e.target.value }))}
                  >
                    <option value="Porac">Porac Command Sector</option>
                    <option value="Santa Rita">Santa Rita Command Sector</option>
                    <option value="Guagua">Guagua Command Sector</option>
                  </select>
                )}
              </div>

              <div>
                <label className="form-label">UNIT / CALLSIGN</label>
                <input
                  className="tactical-input"
                  style={{ marginTop: '3px' }}
                  placeholder="e.g. Porac Medic Unit-01"
                  value={subAdminForm.unit_name}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, unit_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">DISPATCHER EMAIL</label>
                <input
                  className="tactical-input"
                  style={{ marginTop: '3px' }}
                  value={subAdminForm.email}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label">PASSWORD</label>
                <input
                  type="password"
                  className="tactical-input"
                  style={{ marginTop: '3px' }}
                  value={subAdminForm.password}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="form-label">FIRST NAME</label>
                  <input
                    className="tactical-input"
                    style={{ marginTop: '3px' }}
                    value={subAdminForm.first_name}
                    onChange={(e) => setSubAdminForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">LAST NAME</label>
                  <input
                    className="tactical-input"
                    style={{ marginTop: '3px' }}
                    value={subAdminForm.last_name}
                    onChange={(e) => setSubAdminForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">CONTACT NUMBER</label>
                <input
                  className="tactical-input"
                  style={{ marginTop: '3px' }}
                  value={subAdminForm.phone_number}
                  onChange={(e) => setSubAdminForm((f) => ({ ...f, phone_number: e.target.value }))}
                />
              </div>

              {subAdminMsg && (
                <div style={{ fontSize: '11.5px', color: subAdminMsg.startsWith('✅') ? '#10b981' : '#f43f5e', marginTop: '4px' }}>
                  {subAdminMsg}
                </div>
              )}

              <button
                className="tactical-btn"
                style={{ marginTop: '6px', justifyContent: 'center' }}
                onClick={createSubAdmin}
                disabled={creatingSub}
              >
                {creatingSub ? 'DEPLOYING...' : '⚡ DEPLOY SUB-ADMIN UNIT'}
              </button>
            </div>
          </div>

          {/* Active Field Force Units */}
          <div className="glass-panel" style={{ padding: '18px', overflowX: 'auto' }}>
            <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '14px', color: '#f8fafc' }}>
              DEPLOYED DISPATCHERS & RESPONSE UNITS
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>DISPATCHER / UNIT</th>
                  <th style={{ padding: '10px' }}>SECTOR</th>
                  <th style={{ padding: '10px' }}>ROLE</th>
                  <th style={{ padding: '10px' }}>STATUS</th>
                  <th style={{ padding: '10px' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {users.filter((u) => u.role === 'sub_admin' || u.role === 'admin').map((u) => {
                  const town = detectMunicipality(u);
                  const tConf = TOWN_CONFIG[town] || TOWN_CONFIG.Porac;

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: '700', color: '#f8fafc' }}>{u.profile?.first_name || 'Unit'} {u.profile?.last_name || ''}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email} • {u.phone_number || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px',
                          background: tConf.bg, color: tConf.color, border: `1px solid ${tConf.border}`
                        }}>
                          📍 {tConf.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                          background: u.role === 'admin' ? 'rgba(244,63,94,0.15)' : 'rgba(14,165,233,0.15)',
                          color: u.role === 'admin' ? '#f43f5e' : '#38bdf8'
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ fontSize: '11px', color: u.is_active ? '#10b981' : '#64748b', fontWeight: '700' }}>
                          {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => toggleUserActive(u)}
                          style={{
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                            color: u.is_active ? '#f43f5e' : '#10b981', padding: '4px 8px', borderRadius: '4px',
                            fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          {u.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: PUBLIC EMERGENCY ALERTS STUDIO ==================== */}
      {tab === 'alerts' && (
        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '16px' }}>
          
          {/* Create Alert Form */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontWeight: '800', fontSize: '15px', color: '#f8fafc', marginBottom: '6px' }}>
              📢 BROADCAST PUBLIC EMERGENCY ALERT
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
              Broadcast official real-time evacuation directives, weather advisories, or road hazards to citizen devices in {isSuperAdmin ? 'Porac, Santa Rita, and Guagua' : `${assignedJurisdiction}`}.
            </p>

            <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">MUNICIPALITY SECTOR</label>
                {isJurisdictionLocked ? (
                  <div style={{ marginTop: '4px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '800' }}>
                    📍 {assignedJurisdiction} (Official Local Jurisdiction Broadcast)
                  </div>
                ) : (
                  <select
                    className="tactical-input"
                    style={{ marginTop: '4px', background: '#090d16', color: '#f8fafc', cursor: 'pointer' }}
                    value={newAlertForm.target_municipality || 'All Municipalities'}
                    onChange={(e) => setNewAlertForm({ ...newAlertForm, target_municipality: e.target.value })}
                  >
                    <option value="All Municipalities">All Municipalities (Provincial Command Broadcast)</option>
                    <option value="Porac">Porac Municipal Sector</option>
                    <option value="Santa Rita">Santa Rita Municipal Sector</option>
                    <option value="Guagua">Guagua Municipal Sector</option>
                  </select>
                )}
              </div>

              <div>
                <label className="form-label">ALERT TITLE / HEADLINE</label>
                <input
                  className="tactical-input"
                  style={{ marginTop: '4px' }}
                  placeholder="e.g. FLASH FLOOD WARNING: BRGY. CANGATBA"
                  value={newAlertForm.title}
                  onChange={(e) => setNewAlertForm({ ...newAlertForm, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">HAZARD CATEGORY</label>
                  <select
                    className="tactical-input"
                    style={{ marginTop: '4px' }}
                    value={newAlertForm.alert_type}
                    onChange={(e) => setNewAlertForm({ ...newAlertForm, alert_type: e.target.value })}
                  >
                    <option value="Typhoon/Flood">🌊 Typhoon / Flood</option>
                    <option value="Fire Hazard">🔥 Fire Hazard</option>
                    <option value="Earthquake">🌋 Earthquake</option>
                    <option value="Road Advisory">🚧 Road Advisory</option>
                    <option value="Public Safety">🚔 Public Safety</option>
                    <option value="Health Advisory">🏥 Health Advisory</option>
                    <option value="General Announcement">📢 General Announcement</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">SEVERITY LEVEL</label>
                  <select
                    className="tactical-input"
                    style={{ marginTop: '4px' }}
                    value={newAlertForm.severity}
                    onChange={(e) => setNewAlertForm({ ...newAlertForm, severity: e.target.value })}
                  >
                    <option value="Critical">🔴 CRITICAL (Immediate Action)</option>
                    <option value="High">🟠 HIGH (Warning)</option>
                    <option value="Moderate">🟡 MODERATE (Advisory)</option>
                    <option value="Low">🟢 LOW (Informational)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">TARGET BARANGAY / SECTOR</label>
                <input
                  className="tactical-input"
                  style={{ marginTop: '4px' }}
                  placeholder={isJurisdictionLocked ? `e.g. All ${assignedJurisdiction}, Central, San Basilio` : 'e.g. All Porac, Cangatba, Poblacion, Babo Sacan'}
                  value={newAlertForm.target_barangay}
                  onChange={(e) => setNewAlertForm({ ...newAlertForm, target_barangay: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">OFFICIAL DIRECTIVE & SAFETY INSTRUCTIONS</label>
                <textarea
                  className="tactical-input"
                  rows="4"
                  style={{ marginTop: '4px', resize: 'vertical' }}
                  placeholder="Detail the safety instructions, evacuation center locations, and emergency contacts..."
                  value={newAlertForm.message}
                  onChange={(e) => setNewAlertForm({ ...newAlertForm, message: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={creatingAlert}
                className="tactical-btn"
                style={{ marginTop: '6px', justifyContent: 'center', padding: '12px' }}
              >
                {creatingAlert ? 'TRANSMITTING BROADCAST...' : '⚡ TRANSMIT PUBLIC EMERGENCY ALERT'}
              </button>
            </form>
          </div>

          {/* Broadcasted Alerts List */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#f8fafc' }}>
                ACTIVE & HISTORICAL BROADCAST LOGS ({alertsList.length})
              </div>
              <button onClick={loadAlerts} className="tactical-btn secondary" style={{ padding: '6px 10px', fontSize: '11px' }}>
                ↻ REFRESH
              </button>
            </div>

            {alertsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                No public emergency alerts have been issued yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                {alertsList.map((alt) => {
                  const isCrit = alt.severity === 'Critical' || alt.severity === 'High';
                  return (
                    <div
                      key={alt.id}
                      className="glass-card"
                      style={{
                        padding: '14px 18px',
                        borderLeft: `4px solid ${alt.is_active ? (isCrit ? '#f43f5e' : '#0ea5e9') : '#64748b'}`,
                        opacity: alt.is_active ? 1 : 0.65,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '800', fontSize: '14px', color: '#f8fafc' }}>{alt.title}</span>
                            <span style={{
                              fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                              background: alt.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)',
                              color: alt.is_active ? '#10b981' : '#94a3b8'
                            }}>
                              {alt.is_active ? 'ACTIVE BROADCAST' : 'DEACTIVATED'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {alt.alert_type} • 📍 {alt.target_barangay} • {new Date(alt.published_at || alt.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => toggleAlertStatus(alt.id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: alt.is_active ? '#f59e0b' : '#10b981',
                              padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer'
                            }}
                          >
                            {alt.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                          </button>
                          <button
                            onClick={() => deleteAlert(alt.id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(244,63,94,0.3)',
                              color: '#f43f5e',
                              padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer'
                            }}
                          >
                            DELETE
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
                        {alt.message}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 6: REAL-TIME SQL ANALYTICS & REPORTS ==================== */}
      {tab === 'analytics' && (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#f8fafc' }}>
                📊 REAL-TIME MUNICIPAL EMERGENCY RESPONSE ANALYTICS
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Dynamically computed directly from the live MySQL database for operational evaluation and Capstone Defense reporting.
              </p>
            </div>
            <button onClick={loadAnalytics} className="tactical-btn secondary" style={{ padding: '8px 14px', fontSize: '11px' }}>
              ↻ REFRESH SQL ANALYTICS
            </button>
          </div>

          {/* KPI Analytics Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>AVERAGE RESPONSE DURATION</div>
              <div className="mono-text" style={{ fontSize: '24px', fontWeight: '900', color: '#38bdf8', marginTop: '4px' }}>
                {analyticsData?.summary?.avg_response_time_minutes || 0} <span style={{ fontSize: '14px', color: '#94a3b8' }}>min</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                ({analyticsData?.summary?.avg_response_time_seconds || 0} seconds from Dispatch to Scene)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>TOTAL INCIDENTS LOGGED</div>
              <div className="mono-text" style={{ fontSize: '24px', fontWeight: '900', color: '#f8fafc', marginTop: '4px' }}>
                {analyticsData?.summary?.total || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                ✓ {analyticsData?.summary?.resolved || 0} Resolved & Closed
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>PENDING & IN-TRIAGE</div>
              <div className="mono-text" style={{ fontSize: '24px', fontWeight: '900', color: '#f43f5e', marginTop: '4px' }}>
                {analyticsData?.summary?.pending || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                ⚡ {analyticsData?.summary?.active || 0} Active in Field
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>ACTIVE PUBLIC ADVISORIES</div>
              <div className="mono-text" style={{ fontSize: '24px', fontWeight: '900', color: '#a855f7', marginTop: '4px' }}>
                {alertsList.filter(a => a.is_active).length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Broadcasting in {isSuperAdmin ? 'All Municipalities' : assignedJurisdiction}
              </div>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* Breakdown by Emergency Type */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#f8fafc', marginBottom: '12px' }}>
                🔥 INCIDENTS BY EMERGENCY TYPE
              </div>
              {analyticsData?.charts?.by_emergency_type?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analyticsData.charts.by_emergency_type.map((t) => (
                    <div key={t.emergency_type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#f8fafc' }}>
                        {EMERGENCY_ICONS[t.emergency_type] || '🚨'} {t.emergency_type}
                      </span>
                      <span className="mono-text" style={{ fontWeight: '900', color: '#f43f5e', fontSize: '14px' }}>
                        {t.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No incident data recorded.</div>
              )}
            </div>

            {/* Breakdown by Target Agency */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#f8fafc', marginBottom: '12px' }}>
                🏢 INTER-AGENCY DEPLOYMENT DISTRIBUTION
              </div>
              {analyticsData?.charts?.by_agency?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analyticsData.charts.by_agency.map((ag) => (
                    <div key={ag.target_agency} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#f8fafc' }}>
                        🛡️ {ag.target_agency}
                      </span>
                      <span className="mono-text" style={{ fontWeight: '900', color: '#38bdf8', fontSize: '14px' }}>
                        {ag.count} incidents
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No agency dispatch data recorded.</div>
              )}
            </div>

            {/* Breakdown by Barangay in Porac */}
            <div className="glass-panel" style={{ padding: '18px', gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#f8fafc', marginBottom: '12px' }}>
                📍 INCIDENT DENSITY BY BARANGAY (PORAC, PAMPANGA)
              </div>
              {analyticsData?.charts?.by_barangay?.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {analyticsData.charts.by_barangay.map((b) => (
                    <div key={b.barangay} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>BARANGAY</div>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: '#c084fc', marginTop: '2px' }}>{b.barangay}</div>
                      <div className="mono-text" style={{ fontSize: '18px', fontWeight: '900', color: '#f8fafc', marginTop: '4px' }}>
                        {b.count} <span style={{ fontSize: '11px', color: '#64748b' }}>reports</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No barangay density data recorded yet.</div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Dispatch Modal Popup */}
      {selected && (
        <DispatchModal
          request={selected}
          onClose={() => setSelected(null)}
          onSave={dispatchRequest}
        />
      )}

      {/* User Dossier Modal */}
      {selectedUserDossier && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={(e) => e.target === e.currentTarget && setSelectedUserDossier(null)}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '24px', background: 'rgba(9, 13, 26, 0.98)', border: '1px solid rgba(255,255,255,0.15)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '900', fontSize: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>
                  {categorizeUser(selectedUserDossier) === 'admins' ? '👑' :
                   categorizeUser(selectedUserDossier) === 'sub_admins' ? '🔰' :
                   categorizeUser(selectedUserDossier) === 'responders' ? '🚑' : '👥'}
                </span>
                <span>
                  {categorizeUser(selectedUserDossier) === 'admins' ? 'ADMINISTRATOR PROFILE' :
                   categorizeUser(selectedUserDossier) === 'sub_admins' ? 'SUB-ADMINISTRATOR PROFILE' :
                   categorizeUser(selectedUserDossier) === 'responders' ? 'FIRST RESPONDER PROFILE' : 'CITIZEN PROFILE'}
                </span>
                <span className="mono-text" style={{ fontSize: '11px', color: '#64748b' }}>#{selectedUserDossier.id}</span>
              </div>
              <button onClick={() => setSelectedUserDossier(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>FULL LEGAL NAME:</span>
                <b>{selectedUserDossier.profile?.first_name || selectedUserDossier.profile?.full_name || 'N/A'} {selectedUserDossier.profile?.last_name || ''}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>MUNICIPALITY:</span>
                <span style={{ color: TOWN_CONFIG[detectMunicipality(selectedUserDossier)]?.color, fontWeight: '800' }}>
                  📍 {detectMunicipality(selectedUserDossier)}, Pampanga
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>BARANGAY / ADDRESS:</span>
                <span>{selectedUserDossier.profile?.barangay || selectedUserDossier.profile?.address || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>OFFICIAL EMAIL:</span>
                <span>{selectedUserDossier.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>PHONE NUMBER:</span>
                <span>{selectedUserDossier.phone_number || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>ACCOUNT ROLE:</span>
                <span style={{ fontWeight: '700', color: '#38bdf8' }}>{selectedUserDossier.role.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>KYC VERIFICATION:</span>
                <span style={{ color: (selectedUserDossier.is_verified || selectedUserDossier.verification_status === 'approved') ? '#10b981' : '#f59e0b', fontWeight: '800' }}>
                  {(selectedUserDossier.is_verified || selectedUserDossier.verification_status === 'approved') ? '✓ VERIFIED' : '⏳ UNVERIFIED / PENDING'}
                </span>
              </div>

              {/* RESPONDER SPECIFIC METRICS */}
              {categorizeUser(selectedUserDossier) === 'responders' && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b' }}>⚡ TACTICAL UNIT & TELEMETRY</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>DEPARTMENT:</span>
                    <span style={{ fontWeight: '800', color: DEPT_CONFIG[getResponderDept(selectedUserDossier)]?.color }}>
                      {getResponderDept(selectedUserDossier)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>CALL-SIGN / UNIT:</span>
                    <span style={{ fontWeight: '700' }}>{selectedUserDossier.profile?.responder_unit || 'Unit Alpha'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>BADGE NUMBER:</span>
                    <span className="mono-text" style={{ color: '#cbd5e1' }}>{selectedUserDossier.profile?.responder_badge_number || selectedUserDossier.badge_or_unit_id || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>AVAILABILITY STATUS:</span>
                    <span style={{ fontWeight: '800', color: getResponderAvailability(selectedUserDossier).color }}>
                      {getResponderAvailability(selectedUserDossier).label}
                    </span>
                  </div>
                </div>
              )}

              {/* CITIZEN SPECIFIC HEALTH & SAFETY TELEMETRY */}
              {categorizeUser(selectedUserDossier) === 'citizens' && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>🩺 HEALTH & SAFETY TELEMETRY</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>BLOOD TYPE:</span>
                    <span style={{ fontWeight: '800', color: '#f43f5e' }}>{selectedUserDossier.profile?.blood_type || 'Unknown'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>SPECIAL STATUS / MOBILITY:</span>
                    <span>{selectedUserDossier.profile?.special_needs || 'None'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>CHRONIC ALERTS:</span>
                    <span style={{ color: '#f59e0b', fontWeight: '700' }}>
                      {Array.isArray(selectedUserDossier.profile?.medical_conditions) && selectedUserDossier.profile?.medical_conditions.length > 0
                        ? selectedUserDossier.profile.medical_conditions.join(', ')
                        : 'None Declared'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>EMERGENCY KIN:</span>
                    <span>
                      {selectedUserDossier.profile?.emergency_contact_name
                        ? `${selectedUserDossier.profile.emergency_contact_name} (${selectedUserDossier.profile.emergency_contact_phone || 'No phone'})`
                        : 'None Listed'}
                    </span>
                  </div>
                </div>
              )}

              {/* ADMIN & SUB-ADMIN SPECIFIC PRIVILEGES */}
              {(categorizeUser(selectedUserDossier) === 'admins' || categorizeUser(selectedUserDossier) === 'sub_admins') && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#c084fc' }}>🛡️ COMMAND PRIVILEGES & SCOPE</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>SECTOR HQ:</span>
                    <span style={{ fontWeight: '800', color: '#38bdf8' }}>
                      {selectedUserDossier.role === 'super_admin' ? 'Central Command (Tri-Municipality)' : `${detectMunicipality(selectedUserDossier)} Sector`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>PERMISSIONS:</span>
                    <span style={{ color: '#10b981', fontWeight: '700' }}>
                      {selectedUserDossier.role === 'super_admin' ? 'Full Authority (Triage, Dispatch, Governance, NOC)' : 'Scoped Sector Dispatch & Verification'}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>REGISTERED AT:</span>
                <span className="mono-text" style={{ fontSize: '11px' }}>{new Date(selectedUserDossier.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedUserDossier(null)}
              className="tactical-btn secondary"
              style={{ marginTop: '20px', width: '100%', justifyContent: 'center', padding: '10px' }}
            >
              CLOSE DOSSIER
            </button>
          </div>
        </div>
      )}

      {/* MODAL: QUICK DEPLOY FIRST RESPONDER */}
      {showCreateResponderModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={(e) => e.target === e.currentTarget && setShowCreateResponderModal(false)}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '24px', background: 'rgba(9, 13, 26, 0.98)', border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 0 30px rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '900', fontSize: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🚑</span>
                <span>DEPLOY EMERGENCY FIRST RESPONDER UNIT</span>
              </div>
              <button onClick={() => setShowCreateResponderModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {responderMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '12px', fontWeight: '700',
                background: responderMsg.startsWith('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                color: responderMsg.startsWith('✅') ? '#10b981' : '#f43f5e',
                border: `1px solid ${responderMsg.startsWith('✅') ? '#10b981' : '#f43f5e'}`
              }}>
                {responderMsg}
              </div>
            )}

            <form onSubmit={handleCreateResponder} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">FIRST NAME</label>
                  <input
                    required
                    className="tactical-input"
                    placeholder="e.g. Juan"
                    value={responderForm.first_name}
                    onChange={(e) => setResponderForm(f => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">LAST NAME</label>
                  <input
                    required
                    className="tactical-input"
                    placeholder="e.g. Dela Cruz"
                    value={responderForm.last_name}
                    onChange={(e) => setResponderForm(f => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">DEPARTMENT / SERVICE</label>
                  <select
                    className="tactical-input"
                    value={responderForm.department}
                    onChange={(e) => setResponderForm(f => ({ ...f, department: e.target.value }))}
                  >
                    <option value="Medical">🚑 Medical (EMS/Ambulance)</option>
                    <option value="Police">🚔 Police (PNP)</option>
                    <option value="Fire">🚒 Fire (BFP)</option>
                    <option value="Rescue">⛑️ Rescue / MDRRMO</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">MUNICIPAL HUB</label>
                  <select
                    className="tactical-input"
                    value={responderForm.municipality}
                    disabled={isJurisdictionLocked}
                    onChange={(e) => setResponderForm(f => ({ ...f, municipality: e.target.value }))}
                  >
                    <option value="Porac">Porac, Pampanga</option>
                    <option value="Santa Rita">Santa Rita, Pampanga</option>
                    <option value="Guagua">Guagua, Pampanga</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">UNIT CALL-SIGN</label>
                  <input
                    className="tactical-input"
                    placeholder="e.g. Medic Unit-02"
                    value={responderForm.unit_name}
                    onChange={(e) => setResponderForm(f => ({ ...f, unit_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">BADGE NUMBER</label>
                  <input
                    className="tactical-input"
                    placeholder="e.g. MED-STR-02"
                    value={responderForm.badge_number}
                    onChange={(e) => setResponderForm(f => ({ ...f, badge_number: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">OFFICIAL EMAIL</label>
                <input
                  required
                  type="email"
                  className="tactical-input"
                  placeholder="e.g. medic2.santarita@resqlink.gov.ph"
                  value={responderForm.email}
                  onChange={(e) => setResponderForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">ASSIGNED PASSWORD</label>
                  <input
                    required
                    type="password"
                    className="tactical-input"
                    placeholder="Min 6 characters"
                    value={responderForm.password}
                    onChange={(e) => setResponderForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">PHONE NUMBER</label>
                  <input
                    className="tactical-input"
                    placeholder="e.g. 0917-123-4567"
                    value={responderForm.phone_number}
                    onChange={(e) => setResponderForm(f => ({ ...f, phone_number: e.target.value }))}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingResponder}
                className="tactical-btn"
                style={{
                  marginTop: '10px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  fontWeight: '900',
                  fontSize: '13px'
                }}
              >
                {creatingResponder ? 'DEPLOYING RESPONDER UNIT...' : '⚡ CONFIRM & DEPLOY FIRST RESPONDER'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Notification */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          background: 'rgba(13, 18, 36, 0.95)', border: '1px solid #f43f5e',
          padding: '12px 18px', borderRadius: '8px', color: '#f8fafc',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontSize: '12.5px', fontWeight: '700'
        }}>
          {notification.msg}
        </div>
      )}

    </div>
  );
}
