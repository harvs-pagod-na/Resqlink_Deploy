import React from 'react';

export const EMERGENCY_CONFIG = {
  Medical: { label: 'MEDICAL', icon: '🚑', color: '#f43f5e', bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.35)' },
  Fire: { label: 'FIRE', icon: '🔥', color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)' },
  'Flood/Disaster': { label: 'FLOOD / DISASTER', icon: '🌊', color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)', border: 'rgba(14,165,233,0.35)' },
  'Crime/Police': { label: 'POLICE / CRIME', icon: '🚔', color: '#818cf8', bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.35)' },
  Accident: { label: 'ACCIDENT', icon: '🚗', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' },
  Evacuation: { label: 'EVACUATION', icon: '🏃', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)' },
  Other: { label: 'OTHER', icon: '⚠️', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.35)' },
};

export const RESCUE_DEPARTMENTS = [
  { id: 'Medical', label: '🚑 MEDICAL (MDRRMO)', agency: 'MDRRMO', color: '#0ea5e9', role: 'Medical / EMS Rescue' },
  { id: 'Police', label: '🚔 POLICE (PNP)', agency: 'PNP', color: '#818cf8', role: 'Law Enforcement & Security' },
  { id: 'Fire', label: '🔥 FIRE (BFP)', agency: 'BFP', color: '#f97316', role: 'Fire Suppression & Rescue' },
  { id: 'Rescue', label: '🛡️ RESCUE SERVICES', agency: 'MDRRMO', color: '#f43f5e', role: 'Disaster & Specialized Search/Rescue' },
];

/**
 * Automatically maps citizen-selected emergency categories to required departments/rescue services
 */
export function mapEmergencyCategoriesToDepartments(categories = []) {
  const depts = new Set();
  categories.forEach((cat) => {
    const c = String(cat).toLowerCase();
    if (c.includes('fire')) depts.add('Fire');
    if (c.includes('medical') || c.includes('medic')) depts.add('Medical');
    if (c.includes('police') || c.includes('crime') || c.includes('security')) depts.add('Police');
    if (c.includes('flood') || c.includes('disaster') || c.includes('evac')) depts.add('Rescue');
    if (c.includes('accident')) {
      depts.add('Medical');
      depts.add('Police');
    }
  });
  if (depts.size === 0) depts.add('Medical');
  return Array.from(depts);
}

/**
 * Extracts all emergency types for an incident, checking explicit arrays and description tags
 */
export function getIncidentEmergencies(item) {
  if (!item) return ['Medical'];
  if (Array.isArray(item.emergency_types) && item.emergency_types.length > 0) {
    return item.emergency_types;
  }
  if (typeof item.description === 'string' && item.description.includes('[EMERGENCY CATEGORIES:')) {
    const match = item.description.match(/\[EMERGENCY CATEGORIES:\s*([^\]]+)\]/i);
    if (match && match[1]) {
      const parsed = match[1].split(',').map((s) => s.trim()).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  }
  return item.emergency_type ? [item.emergency_type] : ['Medical'];
}

/**
 * Renders multiple emergency badges with icons and distinct colors
 */
export function EmergencyBadges({ incident, size = 'medium' }) {
  const types = getIncidentEmergencies(incident);
  const isSmall = size === 'small';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
      {types.map((type) => {
        const conf = EMERGENCY_CONFIG[type] || EMERGENCY_CONFIG.Other;
        return (
          <span
            key={type}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: isSmall ? '1px 6px' : '3px 8px',
              borderRadius: '5px',
              background: conf.bg,
              color: conf.color,
              border: `1px solid ${conf.border}`,
              fontSize: isSmall ? '10px' : '12px',
              fontWeight: '800',
              letterSpacing: '0.3px',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{conf.icon}</span>
            <span>{conf.label || type.toUpperCase()}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Renders the standardized CRITICAL severity badge
 */
export function CriticalBadge({ size = 'medium' }) {
  const isSmall = size === 'small';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: isSmall ? '1px 6px' : '2px 7px',
        borderRadius: '4px',
        background: 'rgba(244,63,94,0.18)',
        color: '#f43f5e',
        border: '1px solid #f43f5e',
        fontSize: isSmall ? '9.5px' : '10.5px',
        fontWeight: '900',
        letterSpacing: '0.4px',
        boxShadow: '0 0 8px rgba(244,63,94,0.3)',
      }}
    >
      <span>🚨</span>
      <span>CRITICAL</span>
    </span>
  );
}

/**
 * Renders the prominent warning/critical left logo for emergency cards and HUDs
 */
export function CriticalWarningLogo({ size = 46, style = {} }) {
  const iconSize = Math.round(size * 0.48);
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size >= 40 ? '10px' : '8px',
        background: 'linear-gradient(135deg, rgba(244,63,94,0.22), rgba(225,29,72,0.12))',
        border: '1.5px solid rgba(244,63,94,0.5)',
        boxShadow: '0 0 14px rgba(244,63,94,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${iconSize}px`,
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
        ...style,
      }}
      title="Critical Emergency Warning"
    >
      <span style={{ filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.8))' }}>🚨</span>
    </div>
  );
}

export const EMERGENCY_STATUS_STEPS = [
  { key: 'Pending', label: 'Pending', icon: '⏳', desc: 'SOS Received' },
  { key: 'Accepted', label: 'Accepted', icon: '🔰', desc: 'Dispatcher Accepted' },
  { key: 'Responder Dispatched', label: 'Responder Dispatched', icon: '🚀', desc: 'Unit Dispatched' },
  { key: 'En Route', label: 'En Route', icon: '🚗', desc: 'Traveling to Scene' },
  { key: 'Arrived', label: 'Arrived', icon: '📍', desc: 'At Emergency Scene' },
  { key: 'Completed', label: 'Completed', icon: '✅', desc: 'Response Finished' },
];

export function getStatusStepIndex(status) {
  if (!status) return 0;
  const s = String(status).toLowerCase();
  if (s === 'pending') return 0;
  if (s === 'assigned' || s === 'accepted' || s === 'validated') return 1;
  if (s === 'responder dispatched' || s === 'dispatched') return 2;
  if (s === 'en route') return 3;
  if (s === 'arrived' || s === 'on scene') return 4;
  if (s === 'completed' || s === 'resolved' || s === 'closed') return 5;
  return 0;
}

export function getStepTimestamp(incident, stepKey) {
  if (!incident) return null;
  switch (stepKey) {
    case 'Pending':
      return incident.reported_at || incident.createdAt;
    case 'Accepted':
      return incident.subadmin_confirmed_at || incident.validated_at;
    case 'Responder Dispatched':
      return incident.dispatched_at;
    case 'En Route':
      return incident.en_route_at;
    case 'Arrived':
      return incident.arrived_at || incident.on_scene_at;
    case 'Completed':
      return incident.completed_at || incident.resolved_at;
    default:
      return null;
  }
}

/**
 * Visual Status Tracker for Emergency Responses
 * Order: Pending -> Accepted -> Responder Dispatched -> En Route -> Arrived -> Completed
 */
export function EmergencyStatusTracker({ incident, currentStatus, compact = false, style = {} }) {
  const status = currentStatus || incident?.status || 'Pending';
  const currentIndex = getStatusStepIndex(status);

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', ...style }}>
        {EMERGENCY_STATUS_STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const ts = incident ? getStepTimestamp(incident, step.key) : null;

          return (
            <React.Fragment key={step.key}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '10px',
                  fontWeight: '800',
                  letterSpacing: '0.3px',
                  background: isCurrent
                    ? 'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(2,132,199,0.15))'
                    : isDone
                    ? 'rgba(16,185,129,0.12)'
                    : 'rgba(255,255,255,0.03)',
                  border: isCurrent
                    ? '1.5px solid #38bdf8'
                    : isDone
                    ? '1px solid rgba(16,185,129,0.35)'
                    : '1px solid rgba(255,255,255,0.06)',
                  color: isCurrent ? '#38bdf8' : isDone ? '#10b981' : '#64748b',
                  boxShadow: isCurrent ? '0 0 10px rgba(56,189,248,0.4)' : 'none',
                }}
                title={ts ? `${step.label} at ${new Date(ts).toLocaleTimeString()}` : step.label}
              >
                <span>{isDone ? '✓' : step.icon}</span>
                <span>{step.label}</span>
                {ts && (
                  <span className="mono-text" style={{ fontSize: '9px', opacity: 0.8, marginLeft: '2px' }}>
                    {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {idx < EMERGENCY_STATUS_STEPS.length - 1 && (
                <span style={{ fontSize: '10px', color: isDone ? '#10b981' : '#475569', fontWeight: 'bold' }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: '12px',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.75), rgba(9, 13, 26, 0.95))',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '900', color: '#f8fafc', letterSpacing: '0.5px' }}>
            EMERGENCY STATUS PIPELINE
          </span>
          <span style={{
            fontSize: '9.5px', fontWeight: '900', padding: '2px 7px', borderRadius: '4px',
            background: 'rgba(56,189,248,0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)',
          }}>
            STAGE {currentIndex + 1} OF 6
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          Current State: <b style={{ color: '#38bdf8' }}>{status.toUpperCase()}</b>
        </div>
      </div>

      {/* Step Grid with connecting indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', position: 'relative' }}>
        {EMERGENCY_STATUS_STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;
          const ts = incident ? getStepTimestamp(incident, step.key) : null;

          return (
            <div
              key={step.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Badge Circle */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: '900',
                  background: isCurrent
                    ? 'linear-gradient(135deg, #0284c7, #0ea5e9)'
                    : isDone
                    ? 'linear-gradient(135deg, #059669, #10b981)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isCurrent
                    ? '2px solid #38bdf8'
                    : isDone
                    ? '2px solid #10b981'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isCurrent || isDone ? '#ffffff' : '#64748b',
                  boxShadow: isCurrent
                    ? '0 0 18px rgba(14, 165, 233, 0.65)'
                    : isDone
                    ? '0 0 10px rgba(16, 185, 129, 0.3)'
                    : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {isDone ? '✓' : step.icon}
              </div>

              {/* Step Title */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: isCurrent ? '900' : '700',
                  color: isCurrent ? '#f8fafc' : isDone ? '#10b981' : '#64748b',
                  marginTop: '6px',
                  lineHeight: '1.2',
                }}
              >
                {step.label}
              </div>

              {/* Timestamp or Status Pill */}
              <div style={{ marginTop: '3px' }}>
                {ts ? (
                  <span className="mono-text" style={{ fontSize: '9.5px', color: isCurrent ? '#38bdf8' : isDone ? '#10b981' : '#64748b', fontWeight: '700' }}>
                    {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : isCurrent ? (
                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                    ● IN PROGRESS
                  </span>
                ) : (
                  <span style={{ fontSize: '9px', color: '#475569' }}>
                    {isDone ? 'Completed' : 'Pending'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
