import React, { useState, useMemo } from 'react';

/**
 * BODY REGIONS CATALOG
 * Standardized anatomical injury mapping definition
 */
export const BODY_REGIONS = [
  // HEAD & NECK
  { id: 'head', label: 'Head & Face', category: 'Head & Neck', view: 'front' },
  { id: 'head_back', label: 'Back of Head (Occiput)', category: 'Head & Neck', view: 'back' },
  { id: 'neck', label: 'Neck (Front / Throat)', category: 'Head & Neck', view: 'front' },
  { id: 'neck_back', label: 'Neck (Back / Cervical)', category: 'Head & Neck', view: 'back' },

  // TORSO / TRUNK
  { id: 'chest', label: 'Chest (Thorax)', category: 'Torso', view: 'front' },
  { id: 'abdomen', label: 'Abdomen / Stomach', category: 'Torso', view: 'front' },
  { id: 'pelvis', label: 'Pelvis / Groin', category: 'Torso', view: 'front' },
  { id: 'back_upper', label: 'Upper Back (Thoracic / Scapular)', category: 'Torso', view: 'back' },
  { id: 'back_lower', label: 'Lower Back (Lumbar)', category: 'Torso', view: 'back' },
  { id: 'buttocks', label: 'Glutes / Buttocks', category: 'Torso', view: 'back' },

  // UPPER EXTREMITIES (Patient Right & Left)
  { id: 'shoulder_right', label: 'Right Shoulder', category: 'Upper Extremities', view: 'both' },
  { id: 'shoulder_left', label: 'Left Shoulder', category: 'Upper Extremities', view: 'both' },
  { id: 'upper_arm_right', label: 'Right Upper Arm (Bicep/Tricep)', category: 'Upper Extremities', view: 'both' },
  { id: 'upper_arm_left', label: 'Left Upper Arm (Bicep/Tricep)', category: 'Upper Extremities', view: 'both' },
  { id: 'elbow_right', label: 'Right Elbow', category: 'Upper Extremities', view: 'both' },
  { id: 'elbow_left', label: 'Left Elbow', category: 'Upper Extremities', view: 'both' },
  { id: 'forearm_right', label: 'Right Forearm', category: 'Upper Extremities', view: 'both' },
  { id: 'forearm_left', label: 'Left Forearm', category: 'Upper Extremities', view: 'both' },
  { id: 'wrist_right', label: 'Right Wrist', category: 'Upper Extremities', view: 'both' },
  { id: 'wrist_left', label: 'Left Wrist', category: 'Upper Extremities', view: 'both' },
  { id: 'hand_right', label: 'Right Hand & Fingers', category: 'Upper Extremities', view: 'both' },
  { id: 'hand_left', label: 'Left Hand & Fingers', category: 'Upper Extremities', view: 'both' },

  // LOWER EXTREMITIES (Patient Right & Left)
  { id: 'thigh_right', label: 'Right Thigh (Femur / Quad)', category: 'Lower Extremities', view: 'both' },
  { id: 'thigh_left', label: 'Left Thigh (Femur / Quad)', category: 'Lower Extremities', view: 'both' },
  { id: 'knee_right', label: 'Right Knee (Patella)', category: 'Lower Extremities', view: 'both' },
  { id: 'knee_left', label: 'Left Knee (Patella)', category: 'Lower Extremities', view: 'both' },
  { id: 'lower_leg_right', label: 'Right Lower Leg (Shin / Calf)', category: 'Lower Extremities', view: 'both' },
  { id: 'lower_leg_left', label: 'Left Lower Leg (Shin / Calf)', category: 'Lower Extremities', view: 'both' },
  { id: 'ankle_right', label: 'Right Ankle', category: 'Lower Extremities', view: 'both' },
  { id: 'ankle_left', label: 'Left Ankle', category: 'Lower Extremities', view: 'both' },
  { id: 'foot_right', label: 'Right Foot & Toes', category: 'Lower Extremities', view: 'both' },
  { id: 'foot_left', label: 'Left Foot & Toes', category: 'Lower Extremities', view: 'both' },
];

export const BODY_REGIONS_MAP = BODY_REGIONS.reduce((acc, r) => {
  acc[r.id] = r;
  return acc;
}, {});

/**
 * BodyInjuryMap Component
 * Interactive anatomical human body mapping with Front & Back views
 */
export default function BodyInjuryMap({
  selectedInjuries = [],
  onChange,
  injuryDescription = '',
  onDescriptionChange,
  editable = true,
  showNotes = true,
  compact = false,
  showTitle = true,
}) {
  const [activeView, setActiveView] = useState('front'); // 'front' | 'back'
  const [hoveredRegion, setHoveredRegion] = useState(null);

  // Normalize selected injuries list to Map for instant lookup
  const selectedMap = useMemo(() => {
    const map = new Map();
    (selectedInjuries || []).forEach((inj) => {
      if (inj && inj.body_part && (inj.is_active !== false)) {
        map.set(inj.body_part, inj);
      }
    });
    return map;
  }, [selectedInjuries]);

  // Handle region click or keyboard select
  const toggleRegion = (regionId, viewHint = activeView) => {
    if (!editable || !onChange) return;

    const regionMeta = BODY_REGIONS_MAP[regionId];
    const isCurrentlySelected = selectedMap.has(regionId);

    let nextList;
    if (isCurrentlySelected) {
      // Remove or mark inactive
      nextList = selectedInjuries.filter((i) => i.body_part !== regionId);
    } else {
      // Add region
      const newItem = {
        body_part: regionId,
        body_part_label: regionMeta ? regionMeta.label : regionId,
        view_orientation: viewHint,
        reported_by: 'citizen',
        is_active: true,
        notes: '',
      };
      nextList = [...(selectedInjuries || []), newItem];
    }

    onChange(nextList);
  };

  const removeRegion = (regionId) => {
    if (!editable || !onChange) return;
    const nextList = (selectedInjuries || []).filter((i) => i.body_part !== regionId);
    onChange(nextList);
  };

  const clearAll = () => {
    if (!editable || !onChange) return;
    onChange([]);
  };

  // Color helper based on injury reporter (Citizen vs Admin)
  const getRegionFill = (regionId) => {
    const isSelected = selectedMap.has(regionId);
    const isHovered = hoveredRegion === regionId;

    if (isSelected) {
      const item = selectedMap.get(regionId);
      if (item?.reported_by === 'admin' || item?.reported_by === 'subadmin') {
        // Admin adjusted highlight (Amber Gold)
        return isHovered ? '#fbbf24' : '#f59e0b';
      }
      // Citizen reported highlight (Emergency Crimson / Vibrant Coral)
      return isHovered ? '#fb7185' : '#f43f5e';
    }

    if (isHovered && editable) {
      return '#38bdf8'; // Cyan hover feedback
    }

    // Default neutral human silhouette fill
    return '#1e293b'; // Slate dark-neutral
  };

  const getRegionStroke = (regionId) => {
    const isSelected = selectedMap.has(regionId);
    const isHovered = hoveredRegion === regionId;

    if (isSelected) {
      const item = selectedMap.get(regionId);
      return item?.reported_by === 'admin' ? '#fde047' : '#ffffff';
    }
    if (isHovered && editable) {
      return '#bae6fd';
    }
    return '#475569'; // Clean anatomical outline
  };

  const getRegionStrokeWidth = (regionId) => {
    const isSelected = selectedMap.has(regionId);
    const isHovered = hoveredRegion === regionId;
    if (isSelected || isHovered) return 2.2;
    return 1.4;
  };

  const selectedCount = selectedMap.size;

  return (
    <div
      className="body-injury-mapping-container"
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: compact ? '12px' : '18px',
        color: '#f8fafc',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Header & Title */}
      {showTitle && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }}></span>
              <span style={{ fontSize: compact ? '13px' : '14.5px', fontWeight: '900', letterSpacing: '0.6px', color: '#f8fafc' }}>
                HUMAN BODY INJURY MAPPING
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: selectedCount > 0 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                  color: selectedCount > 0 ? '#f43f5e' : '#94a3b8',
                  border: `1px solid ${selectedCount > 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(148, 163, 184, 0.25)'}`,
                }}
              >
                {selectedCount} {selectedCount === 1 ? 'REGION' : 'REGIONS'} SELECTED
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
              {editable
                ? 'Tap or click the specific body parts where the person is experiencing pain or has sustained an injury.'
                : 'Visual anatomical mapping of reported injury locations for rapid triage and medical dispatch.'}
            </div>
          </div>

          {/* Orientation View Switcher Buttons */}
          <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={() => setActiveView('front')}
              style={{
                background: activeView === 'front' ? '#0284c7' : 'transparent',
                color: activeView === 'front' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>FRONT VIEW</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('back')}
              style={{
                background: activeView === 'back' ? '#0284c7' : 'transparent',
                color: activeView === 'back' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>BACK VIEW</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Body Model on Left, Selected Injuries & Notes on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'minmax(260px, 310px) 1fr',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Interactive Vector SVG Model */}
        <div
          style={{
            background: 'rgba(2, 6, 23, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {/* Anatomical Side Orientation Indicator */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 12px',
              fontSize: '9.5px',
              fontWeight: '800',
              color: '#38bdf8',
              letterSpacing: '0.8px',
              marginBottom: '6px',
            }}
          >
            <span>{activeView === 'front' ? "◀ PATIENT'S RIGHT" : "◀ PATIENT'S LEFT"}</span>
            <span style={{ color: '#94a3b8', fontWeight: '700' }}>{activeView.toUpperCase()}</span>
            <span>{activeView === 'front' ? "PATIENT'S LEFT ▶" : "PATIENT'S RIGHT ▶"}</span>
          </div>

          {/* SVG Silhouette */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '280px', height: '480px' }}>
            <svg
              viewBox="0 0 300 600"
              style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label={`Interactive human body model, ${activeView} view`}
            >
              {/* Joint & Anatomical Boundary Markers (Subtle background guidelines) */}
              <g stroke="#334155" strokeDasharray="2,2" strokeWidth="0.8" opacity="0.6">
                <line x1="120" y1="75" x2="180" y2="75" />  {/* Neck line */}
                <line x1="95" y1="120" x2="205" y2="120" /> {/* Shoulder line */}
                <line x1="110" y1="170" x2="190" y2="170" /> {/* Chest/Diaphragm */}
                <line x1="115" y1="230" x2="185" y2="230" /> {/* Waist/Belt */}
                <line x1="110" y1="285" x2="190" y2="285" /> {/* Hip line */}
                <line x1="110" y1="395" x2="190" y2="395" /> {/* Knee line */}
                <line x1="115" y1="520" x2="185" y2="520" /> {/* Ankle line */}
              </g>

              {/* =======================================================
                  FRONT VIEW REGIONS
                 ======================================================= */}
              {activeView === 'front' && (
                <g id="front_body_group">
                  {/* Head & Face */}
                  <path
                    id="region_head"
                    d="M 150 18 C 128 18 122 34 122 50 C 122 66 132 80 150 80 C 168 80 178 66 178 50 C 178 34 172 18 150 18 Z"
                    fill={getRegionFill('head')}
                    stroke={getRegionStroke('head')}
                    strokeWidth={getRegionStrokeWidth('head')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('head', 'front')}
                    onMouseEnter={() => setHoveredRegion('head')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Head and face"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('head', 'front')}
                  />
                  {/* Subtle Face Feature Outline */}
                  <ellipse cx="150" cy="50" rx="20" ry="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                  {/* Neck */}
                  <path
                    id="region_neck"
                    d="M 140 80 L 160 80 L 165 104 L 135 104 Z"
                    fill={getRegionFill('neck')}
                    stroke={getRegionStroke('neck')}
                    strokeWidth={getRegionStrokeWidth('neck')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('neck', 'front')}
                    onMouseEnter={() => setHoveredRegion('neck')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Neck"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('neck', 'front')}
                  />

                  {/* Right Shoulder (Viewer Left) */}
                  <path
                    id="region_shoulder_right"
                    d="M 135 104 L 105 108 C 88 112 80 122 78 134 L 100 138 L 115 120 Z"
                    fill={getRegionFill('shoulder_right')}
                    stroke={getRegionStroke('shoulder_right')}
                    strokeWidth={getRegionStrokeWidth('shoulder_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('shoulder_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('shoulder_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Shoulder"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('shoulder_right', 'front')}
                  />

                  {/* Left Shoulder (Viewer Right) */}
                  <path
                    id="region_shoulder_left"
                    d="M 165 104 L 195 108 C 212 112 220 122 222 134 L 200 138 L 185 120 Z"
                    fill={getRegionFill('shoulder_left')}
                    stroke={getRegionStroke('shoulder_left')}
                    strokeWidth={getRegionStrokeWidth('shoulder_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('shoulder_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('shoulder_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Shoulder"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('shoulder_left', 'front')}
                  />

                  {/* Chest */}
                  <path
                    id="region_chest"
                    d="M 115 110 L 185 110 L 188 168 L 112 168 Z"
                    fill={getRegionFill('chest')}
                    stroke={getRegionStroke('chest')}
                    strokeWidth={getRegionStrokeWidth('chest')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('chest', 'front')}
                    onMouseEnter={() => setHoveredRegion('chest')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Chest"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('chest', 'front')}
                  />

                  {/* Abdomen / Stomach */}
                  <path
                    id="region_abdomen"
                    d="M 112 168 L 188 168 L 182 232 L 118 232 Z"
                    fill={getRegionFill('abdomen')}
                    stroke={getRegionStroke('abdomen')}
                    strokeWidth={getRegionStrokeWidth('abdomen')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('abdomen', 'front')}
                    onMouseEnter={() => setHoveredRegion('abdomen')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Abdomen"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('abdomen', 'front')}
                  />

                  {/* Pelvis & Hips */}
                  <path
                    id="region_pelvis"
                    d="M 118 232 L 182 232 L 192 282 L 150 286 L 108 282 Z"
                    fill={getRegionFill('pelvis')}
                    stroke={getRegionStroke('pelvis')}
                    strokeWidth={getRegionStrokeWidth('pelvis')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('pelvis', 'front')}
                    onMouseEnter={() => setHoveredRegion('pelvis')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Pelvis and Hips"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('pelvis', 'front')}
                  />

                  {/* Right Upper Arm (Viewer Left) */}
                  <path
                    id="region_upper_arm_right"
                    d="M 78 134 L 100 138 L 94 196 L 70 192 Z"
                    fill={getRegionFill('upper_arm_right')}
                    stroke={getRegionStroke('upper_arm_right')}
                    strokeWidth={getRegionStrokeWidth('upper_arm_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('upper_arm_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('upper_arm_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Upper Arm"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('upper_arm_right', 'front')}
                  />

                  {/* Left Upper Arm (Viewer Right) */}
                  <path
                    id="region_upper_arm_left"
                    d="M 222 134 L 200 138 L 206 196 L 230 192 Z"
                    fill={getRegionFill('upper_arm_left')}
                    stroke={getRegionStroke('upper_arm_left')}
                    strokeWidth={getRegionStrokeWidth('upper_arm_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('upper_arm_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('upper_arm_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Upper Arm"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('upper_arm_left', 'front')}
                  />

                  {/* Right Elbow (Viewer Left) */}
                  <path
                    id="region_elbow_right"
                    d="M 70 192 L 94 196 L 90 220 L 66 216 Z"
                    fill={getRegionFill('elbow_right')}
                    stroke={getRegionStroke('elbow_right')}
                    strokeWidth={getRegionStrokeWidth('elbow_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('elbow_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('elbow_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Elbow"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('elbow_right', 'front')}
                  />

                  {/* Left Elbow (Viewer Right) */}
                  <path
                    id="region_elbow_left"
                    d="M 230 192 L 206 196 L 210 220 L 234 216 Z"
                    fill={getRegionFill('elbow_left')}
                    stroke={getRegionStroke('elbow_left')}
                    strokeWidth={getRegionStrokeWidth('elbow_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('elbow_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('elbow_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Elbow"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('elbow_left', 'front')}
                  />

                  {/* Right Forearm (Viewer Left) */}
                  <path
                    id="region_forearm_right"
                    d="M 66 216 L 90 220 L 82 280 L 58 276 Z"
                    fill={getRegionFill('forearm_right')}
                    stroke={getRegionStroke('forearm_right')}
                    strokeWidth={getRegionStrokeWidth('forearm_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('forearm_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('forearm_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Forearm"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('forearm_right', 'front')}
                  />

                  {/* Left Forearm (Viewer Right) */}
                  <path
                    id="region_forearm_left"
                    d="M 234 216 L 210 220 L 218 280 L 242 276 Z"
                    fill={getRegionFill('forearm_left')}
                    stroke={getRegionStroke('forearm_left')}
                    strokeWidth={getRegionStrokeWidth('forearm_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('forearm_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('forearm_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Forearm"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('forearm_left', 'front')}
                  />

                  {/* Right Wrist (Viewer Left) */}
                  <path
                    id="region_wrist_right"
                    d="M 58 276 L 82 280 L 78 300 L 54 296 Z"
                    fill={getRegionFill('wrist_right')}
                    stroke={getRegionStroke('wrist_right')}
                    strokeWidth={getRegionStrokeWidth('wrist_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('wrist_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('wrist_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Wrist"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('wrist_right', 'front')}
                  />

                  {/* Left Wrist (Viewer Right) */}
                  <path
                    id="region_wrist_left"
                    d="M 242 276 L 218 280 L 222 300 L 246 296 Z"
                    fill={getRegionFill('wrist_left')}
                    stroke={getRegionStroke('wrist_left')}
                    strokeWidth={getRegionStrokeWidth('wrist_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('wrist_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('wrist_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Wrist"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('wrist_left', 'front')}
                  />

                  {/* Right Hand & Fingers (Viewer Left) */}
                  <path
                    id="region_hand_right"
                    d="M 54 296 L 78 300 C 78 325 72 342 64 346 C 56 342 50 325 54 296 Z"
                    fill={getRegionFill('hand_right')}
                    stroke={getRegionStroke('hand_right')}
                    strokeWidth={getRegionStrokeWidth('hand_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('hand_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('hand_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Hand"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('hand_right', 'front')}
                  />

                  {/* Left Hand & Fingers (Viewer Right) */}
                  <path
                    id="region_hand_left"
                    d="M 246 296 L 222 300 C 222 325 228 342 236 346 C 244 342 250 325 246 296 Z"
                    fill={getRegionFill('hand_left')}
                    stroke={getRegionStroke('hand_left')}
                    strokeWidth={getRegionStrokeWidth('hand_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('hand_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('hand_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Hand"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('hand_left', 'front')}
                  />

                  {/* Right Thigh (Viewer Left) */}
                  <path
                    id="region_thigh_right"
                    d="M 108 282 L 148 286 L 144 394 L 110 394 Z"
                    fill={getRegionFill('thigh_right')}
                    stroke={getRegionStroke('thigh_right')}
                    strokeWidth={getRegionStrokeWidth('thigh_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('thigh_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('thigh_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Thigh"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('thigh_right', 'front')}
                  />

                  {/* Left Thigh (Viewer Right) */}
                  <path
                    id="region_thigh_left"
                    d="M 152 286 L 192 282 L 190 394 L 156 394 Z"
                    fill={getRegionFill('thigh_left')}
                    stroke={getRegionStroke('thigh_left')}
                    strokeWidth={getRegionStrokeWidth('thigh_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('thigh_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('thigh_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Thigh"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('thigh_left', 'front')}
                  />

                  {/* Right Knee (Viewer Left) */}
                  <path
                    id="region_knee_right"
                    d="M 110 394 L 144 394 L 142 430 L 112 430 Z"
                    fill={getRegionFill('knee_right')}
                    stroke={getRegionStroke('knee_right')}
                    strokeWidth={getRegionStrokeWidth('knee_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('knee_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('knee_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Knee"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('knee_right', 'front')}
                  />

                  {/* Left Knee (Viewer Right) */}
                  <path
                    id="region_knee_left"
                    d="M 156 394 L 190 394 L 188 430 L 158 430 Z"
                    fill={getRegionFill('knee_left')}
                    stroke={getRegionStroke('knee_left')}
                    strokeWidth={getRegionStrokeWidth('knee_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('knee_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('knee_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Knee"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('knee_left', 'front')}
                  />

                  {/* Right Lower Leg / Shin (Viewer Left) */}
                  <path
                    id="region_lower_leg_right"
                    d="M 112 430 L 142 430 L 138 525 L 118 525 Z"
                    fill={getRegionFill('lower_leg_right')}
                    stroke={getRegionStroke('lower_leg_right')}
                    strokeWidth={getRegionStrokeWidth('lower_leg_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('lower_leg_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('lower_leg_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Lower Leg"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('lower_leg_right', 'front')}
                  />

                  {/* Left Lower Leg / Shin (Viewer Right) */}
                  <path
                    id="region_lower_leg_left"
                    d="M 158 430 L 188 430 L 182 525 L 162 525 Z"
                    fill={getRegionFill('lower_leg_left')}
                    stroke={getRegionStroke('lower_leg_left')}
                    strokeWidth={getRegionStrokeWidth('lower_leg_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('lower_leg_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('lower_leg_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Lower Leg"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('lower_leg_left', 'front')}
                  />

                  {/* Right Ankle (Viewer Left) */}
                  <path
                    id="region_ankle_right"
                    d="M 118 525 L 138 525 L 136 550 L 120 550 Z"
                    fill={getRegionFill('ankle_right')}
                    stroke={getRegionStroke('ankle_right')}
                    strokeWidth={getRegionStrokeWidth('ankle_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('ankle_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('ankle_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Ankle"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('ankle_right', 'front')}
                  />

                  {/* Left Ankle (Viewer Right) */}
                  <path
                    id="region_ankle_left"
                    d="M 162 525 L 182 525 L 180 550 L 164 550 Z"
                    fill={getRegionFill('ankle_left')}
                    stroke={getRegionStroke('ankle_left')}
                    strokeWidth={getRegionStrokeWidth('ankle_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('ankle_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('ankle_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Ankle"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('ankle_left', 'front')}
                  />

                  {/* Right Foot & Toes (Viewer Left) */}
                  <path
                    id="region_foot_right"
                    d="M 120 550 L 136 550 L 140 584 C 140 592 114 592 112 584 Z"
                    fill={getRegionFill('foot_right')}
                    stroke={getRegionStroke('foot_right')}
                    strokeWidth={getRegionStrokeWidth('foot_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('foot_right', 'front')}
                    onMouseEnter={() => setHoveredRegion('foot_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Foot"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('foot_right', 'front')}
                  />

                  {/* Left Foot & Toes (Viewer Right) */}
                  <path
                    id="region_foot_left"
                    d="M 164 550 L 180 550 L 188 584 C 188 592 160 592 160 584 Z"
                    fill={getRegionFill('foot_left')}
                    stroke={getRegionStroke('foot_left')}
                    strokeWidth={getRegionStrokeWidth('foot_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('foot_left', 'front')}
                    onMouseEnter={() => setHoveredRegion('foot_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Foot"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('foot_left', 'front')}
                  />
                </g>
              )}

              {/* =======================================================
                  BACK VIEW REGIONS
                 ======================================================= */}
              {activeView === 'back' && (
                <g id="back_body_group">
                  {/* Back of Head (Occiput) */}
                  <path
                    id="region_head_back"
                    d="M 150 18 C 128 18 122 34 122 50 C 122 66 132 80 150 80 C 168 80 178 66 178 50 C 178 34 172 18 150 18 Z"
                    fill={getRegionFill('head_back')}
                    stroke={getRegionStroke('head_back')}
                    strokeWidth={getRegionStrokeWidth('head_back')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('head_back', 'back')}
                    onMouseEnter={() => setHoveredRegion('head_back')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Back of head"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('head_back', 'back')}
                  />
                  {/* Subtle Hairline Curve */}
                  <path d="M 130 55 Q 150 72 170 55" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />

                  {/* Back of Neck */}
                  <path
                    id="region_neck_back"
                    d="M 140 80 L 160 80 L 165 104 L 135 104 Z"
                    fill={getRegionFill('neck_back')}
                    stroke={getRegionStroke('neck_back')}
                    strokeWidth={getRegionStrokeWidth('neck_back')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('neck_back', 'back')}
                    onMouseEnter={() => setHoveredRegion('neck_back')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Back of Neck"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('neck_back', 'back')}
                  />

                  {/* Left Shoulder in Back View (Viewer Left = Patient Left) */}
                  <path
                    id="region_shoulder_left_back"
                    d="M 135 104 L 105 108 C 88 112 80 122 78 134 L 100 138 L 115 120 Z"
                    fill={getRegionFill('shoulder_left')}
                    stroke={getRegionStroke('shoulder_left')}
                    strokeWidth={getRegionStrokeWidth('shoulder_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('shoulder_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('shoulder_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Shoulder (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('shoulder_left', 'back')}
                  />

                  {/* Right Shoulder in Back View (Viewer Right = Patient Right) */}
                  <path
                    id="region_shoulder_right_back"
                    d="M 165 104 L 195 108 C 212 112 220 122 222 134 L 200 138 L 185 120 Z"
                    fill={getRegionFill('shoulder_right')}
                    stroke={getRegionStroke('shoulder_right')}
                    strokeWidth={getRegionStrokeWidth('shoulder_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('shoulder_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('shoulder_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Shoulder (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('shoulder_right', 'back')}
                  />

                  {/* Upper Back (Thoracic / Scapular) */}
                  <path
                    id="region_back_upper"
                    d="M 115 110 L 185 110 L 188 168 L 112 168 Z"
                    fill={getRegionFill('back_upper')}
                    stroke={getRegionStroke('back_upper')}
                    strokeWidth={getRegionStrokeWidth('back_upper')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('back_upper', 'back')}
                    onMouseEnter={() => setHoveredRegion('back_upper')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Upper Back"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('back_upper', 'back')}
                  />
                  {/* Subtle Spine & Scapula Guides */}
                  <line x1="150" y1="110" x2="150" y2="168" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />

                  {/* Lower Back (Lumbar) */}
                  <path
                    id="region_back_lower"
                    d="M 112 168 L 188 168 L 182 232 L 118 232 Z"
                    fill={getRegionFill('back_lower')}
                    stroke={getRegionStroke('back_lower')}
                    strokeWidth={getRegionStrokeWidth('back_lower')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('back_lower', 'back')}
                    onMouseEnter={() => setHoveredRegion('back_lower')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Lower Back"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('back_lower', 'back')}
                  />
                  <line x1="150" y1="168" x2="150" y2="232" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />

                  {/* Glutes / Buttocks */}
                  <path
                    id="region_buttocks"
                    d="M 118 232 L 182 232 L 192 282 L 150 286 L 108 282 Z"
                    fill={getRegionFill('buttocks')}
                    stroke={getRegionStroke('buttocks')}
                    strokeWidth={getRegionStrokeWidth('buttocks')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('buttocks', 'back')}
                    onMouseEnter={() => setHoveredRegion('buttocks')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Glutes and Buttocks"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('buttocks', 'back')}
                  />
                  {/* Gluteal cleft crease */}
                  <line x1="150" y1="240" x2="150" y2="284" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />

                  {/* Left Upper Arm in Back View (Viewer Left = Patient Left) */}
                  <path
                    id="region_upper_arm_left_back"
                    d="M 78 134 L 100 138 L 94 196 L 70 192 Z"
                    fill={getRegionFill('upper_arm_left')}
                    stroke={getRegionStroke('upper_arm_left')}
                    strokeWidth={getRegionStrokeWidth('upper_arm_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('upper_arm_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('upper_arm_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Upper Arm (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('upper_arm_left', 'back')}
                  />

                  {/* Right Upper Arm in Back View (Viewer Right = Patient Right) */}
                  <path
                    id="region_upper_arm_right_back"
                    d="M 222 134 L 200 138 L 206 196 L 230 192 Z"
                    fill={getRegionFill('upper_arm_right')}
                    stroke={getRegionStroke('upper_arm_right')}
                    strokeWidth={getRegionStrokeWidth('upper_arm_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('upper_arm_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('upper_arm_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Upper Arm (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('upper_arm_right', 'back')}
                  />

                  {/* Left Elbow in Back View (Viewer Left) */}
                  <path
                    id="region_elbow_left_back"
                    d="M 70 192 L 94 196 L 90 220 L 66 216 Z"
                    fill={getRegionFill('elbow_left')}
                    stroke={getRegionStroke('elbow_left')}
                    strokeWidth={getRegionStrokeWidth('elbow_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('elbow_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('elbow_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Elbow (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('elbow_left', 'back')}
                  />

                  {/* Right Elbow in Back View (Viewer Right) */}
                  <path
                    id="region_elbow_right_back"
                    d="M 230 192 L 206 196 L 210 220 L 234 216 Z"
                    fill={getRegionFill('elbow_right')}
                    stroke={getRegionStroke('elbow_right')}
                    strokeWidth={getRegionStrokeWidth('elbow_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('elbow_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('elbow_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Elbow (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('elbow_right', 'back')}
                  />

                  {/* Left Forearm in Back View (Viewer Left) */}
                  <path
                    id="region_forearm_left_back"
                    d="M 66 216 L 90 220 L 82 280 L 58 276 Z"
                    fill={getRegionFill('forearm_left')}
                    stroke={getRegionStroke('forearm_left')}
                    strokeWidth={getRegionStrokeWidth('forearm_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('forearm_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('forearm_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Forearm (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('forearm_left', 'back')}
                  />

                  {/* Right Forearm in Back View (Viewer Right) */}
                  <path
                    id="region_forearm_right_back"
                    d="M 234 216 L 210 220 L 218 280 L 242 276 Z"
                    fill={getRegionFill('forearm_right')}
                    stroke={getRegionStroke('forearm_right')}
                    strokeWidth={getRegionStrokeWidth('forearm_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('forearm_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('forearm_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Forearm (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('forearm_right', 'back')}
                  />

                  {/* Left Wrist in Back View (Viewer Left) */}
                  <path
                    id="region_wrist_left_back"
                    d="M 58 276 L 82 280 L 78 300 L 54 296 Z"
                    fill={getRegionFill('wrist_left')}
                    stroke={getRegionStroke('wrist_left')}
                    strokeWidth={getRegionStrokeWidth('wrist_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('wrist_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('wrist_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Wrist (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('wrist_left', 'back')}
                  />

                  {/* Right Wrist in Back View (Viewer Right) */}
                  <path
                    id="region_wrist_right_back"
                    d="M 242 276 L 218 280 L 222 300 L 246 296 Z"
                    fill={getRegionFill('wrist_right')}
                    stroke={getRegionStroke('wrist_right')}
                    strokeWidth={getRegionStrokeWidth('wrist_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('wrist_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('wrist_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Wrist (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('wrist_right', 'back')}
                  />

                  {/* Left Hand in Back View (Viewer Left) */}
                  <path
                    id="region_hand_left_back"
                    d="M 54 296 L 78 300 C 78 325 72 342 64 346 C 56 342 50 325 54 296 Z"
                    fill={getRegionFill('hand_left')}
                    stroke={getRegionStroke('hand_left')}
                    strokeWidth={getRegionStrokeWidth('hand_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('hand_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('hand_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Hand (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('hand_left', 'back')}
                  />

                  {/* Right Hand in Back View (Viewer Right) */}
                  <path
                    id="region_hand_right_back"
                    d="M 246 296 L 222 300 C 222 325 228 342 236 346 C 244 342 250 325 246 296 Z"
                    fill={getRegionFill('hand_right')}
                    stroke={getRegionStroke('hand_right')}
                    strokeWidth={getRegionStrokeWidth('hand_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('hand_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('hand_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Hand (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('hand_right', 'back')}
                  />

                  {/* Left Thigh in Back View (Viewer Left = Patient Left) */}
                  <path
                    id="region_thigh_left_back"
                    d="M 108 282 L 148 286 L 144 394 L 110 394 Z"
                    fill={getRegionFill('thigh_left')}
                    stroke={getRegionStroke('thigh_left')}
                    strokeWidth={getRegionStrokeWidth('thigh_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('thigh_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('thigh_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Thigh (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('thigh_left', 'back')}
                  />

                  {/* Right Thigh in Back View (Viewer Right = Patient Right) */}
                  <path
                    id="region_thigh_right_back"
                    d="M 152 286 L 192 282 L 190 394 L 156 394 Z"
                    fill={getRegionFill('thigh_right')}
                    stroke={getRegionStroke('thigh_right')}
                    strokeWidth={getRegionStrokeWidth('thigh_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('thigh_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('thigh_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Thigh (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('thigh_right', 'back')}
                  />

                  {/* Left Knee / Popliteal Fossa in Back View (Viewer Left) */}
                  <path
                    id="region_knee_left_back"
                    d="M 110 394 L 144 394 L 142 430 L 112 430 Z"
                    fill={getRegionFill('knee_left')}
                    stroke={getRegionStroke('knee_left')}
                    strokeWidth={getRegionStrokeWidth('knee_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('knee_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('knee_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Knee (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('knee_left', 'back')}
                  />

                  {/* Right Knee / Popliteal Fossa in Back View (Viewer Right) */}
                  <path
                    id="region_knee_right_back"
                    d="M 156 394 L 190 394 L 188 430 L 158 430 Z"
                    fill={getRegionFill('knee_right')}
                    stroke={getRegionStroke('knee_right')}
                    strokeWidth={getRegionStrokeWidth('knee_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('knee_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('knee_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Knee (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('knee_right', 'back')}
                  />

                  {/* Left Calf / Lower Leg in Back View (Viewer Left) */}
                  <path
                    id="region_lower_leg_left_back"
                    d="M 112 430 L 142 430 L 138 525 L 118 525 Z"
                    fill={getRegionFill('lower_leg_left')}
                    stroke={getRegionStroke('lower_leg_left')}
                    strokeWidth={getRegionStrokeWidth('lower_leg_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('lower_leg_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('lower_leg_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Lower Leg (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('lower_leg_left', 'back')}
                  />

                  {/* Right Calf / Lower Leg in Back View (Viewer Right) */}
                  <path
                    id="region_lower_leg_right_back"
                    d="M 158 430 L 188 430 L 182 525 L 162 525 Z"
                    fill={getRegionFill('lower_leg_right')}
                    stroke={getRegionStroke('lower_leg_right')}
                    strokeWidth={getRegionStrokeWidth('lower_leg_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('lower_leg_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('lower_leg_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Lower Leg (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('lower_leg_right', 'back')}
                  />

                  {/* Left Ankle / Achilles in Back View (Viewer Left) */}
                  <path
                    id="region_ankle_left_back"
                    d="M 118 525 L 138 525 L 136 550 L 120 550 Z"
                    fill={getRegionFill('ankle_left')}
                    stroke={getRegionStroke('ankle_left')}
                    strokeWidth={getRegionStrokeWidth('ankle_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('ankle_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('ankle_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Ankle (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('ankle_left', 'back')}
                  />

                  {/* Right Ankle / Achilles in Back View (Viewer Right) */}
                  <path
                    id="region_ankle_right_back"
                    d="M 162 525 L 182 525 L 180 550 L 164 550 Z"
                    fill={getRegionFill('ankle_right')}
                    stroke={getRegionStroke('ankle_right')}
                    strokeWidth={getRegionStrokeWidth('ankle_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('ankle_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('ankle_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Ankle (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('ankle_right', 'back')}
                  />

                  {/* Left Heel / Foot in Back View (Viewer Left) */}
                  <path
                    id="region_foot_left_back"
                    d="M 120 550 L 136 550 L 138 584 C 138 592 118 592 116 584 Z"
                    fill={getRegionFill('foot_left')}
                    stroke={getRegionStroke('foot_left')}
                    strokeWidth={getRegionStrokeWidth('foot_left')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('foot_left', 'back')}
                    onMouseEnter={() => setHoveredRegion('foot_left')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Left Foot (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('foot_left', 'back')}
                  />

                  {/* Right Heel / Foot in Back View (Viewer Right) */}
                  <path
                    id="region_foot_right_back"
                    d="M 164 550 L 180 550 L 184 584 C 184 592 164 592 162 584 Z"
                    fill={getRegionFill('foot_right')}
                    stroke={getRegionStroke('foot_right')}
                    strokeWidth={getRegionStrokeWidth('foot_right')}
                    cursor={editable ? 'pointer' : 'default'}
                    onClick={() => toggleRegion('foot_right', 'back')}
                    onMouseEnter={() => setHoveredRegion('foot_right')}
                    onMouseLeave={() => setHoveredRegion(null)}
                    tabIndex={editable ? 0 : -1}
                    role="button"
                    aria-label="Right Foot (Back)"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleRegion('foot_right', 'back')}
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Real-time Hovered / Active Region Feedback Badge */}
          <div
            style={{
              marginTop: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: hoveredRegion ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 0, 0, 0.3)',
              border: `1px solid ${hoveredRegion ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`,
              minHeight: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {hoveredRegion ? (
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>
                {BODY_REGIONS_MAP[hoveredRegion]?.label || hoveredRegion}
                {editable && (
                  <span style={{ fontSize: '9.5px', color: '#94a3b8', marginLeft: '6px', fontWeight: '400' }}>
                    {selectedMap.has(hoveredRegion) ? '(Click to deselect)' : '(Click to mark injury)'}
                  </span>
                )}
              </span>
            ) : (
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                {editable ? 'Hover or tap a body region to inspect or select' : 'Highlighted regions indicate reported injury'}
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Selected Injuries List & Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Selected Regions Card */}
          <div
            style={{
              background: 'rgba(2, 6, 23, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#38bdf8', letterSpacing: '0.8px' }}>
                SELECTED INJURY REGIONS ({selectedCount})
              </span>
              {editable && selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f43f5e',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* List of Badges */}
            {selectedCount === 0 ? (
              <div
                style={{
                  padding: '24px 14px',
                  borderRadius: '8px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#94a3b8' }}>No Body Parts Selected</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                  {editable
                    ? 'Click on the body silhouette on the left to mark pain or trauma areas. (Optional)'
                    : 'Citizen did not specify localized injury coordinates.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {Array.from(selectedMap.values()).map((inj) => {
                  const meta = BODY_REGIONS_MAP[inj.body_part];
                  const label = inj.body_part_label || meta?.label || inj.body_part;
                  const isAdminReported = inj.reported_by === 'admin' || inj.reported_by === 'subadmin';

                  return (
                    <div
                      key={inj.body_part}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: isAdminReported ? 'rgba(245, 158, 11, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                        border: `1px solid ${isAdminReported ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isAdminReported ? '#f59e0b' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#f8fafc' }}>
                            {label}
                          </div>
                          <div style={{ fontSize: '9.5px', color: isAdminReported ? '#f59e0b' : '#38bdf8', marginTop: '1px' }}>
                            {meta?.category || 'Body Region'} • View: {inj.view_orientation ? inj.view_orientation.toUpperCase() : 'FRONT'}
                            {isAdminReported && ' • [ADMIN ADJUSTED]'}
                          </div>
                        </div>
                      </div>

                      {editable && (
                        <button
                          type="button"
                          onClick={() => removeRegion(inj.body_part)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: 'none',
                            color: '#cbd5e1',
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '800',
                          }}
                          title="Remove this body part"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Supplementary Injury Description */}
          {showNotes && (
            <div
              style={{
                background: 'rgba(2, 6, 23, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <label style={{ fontSize: '11px', fontWeight: '900', color: '#38bdf8', letterSpacing: '0.8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>SUPPLEMENTARY INJURY DETAILS (OPTIONAL)</span>
                {editable && <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '500' }}>Self-reported symptoms</span>}
              </label>

              {editable ? (
                <textarea
                  value={injuryDescription || ''}
                  onChange={(e) => onDescriptionChange && onDescriptionChange(e.target.value)}
                  placeholder="e.g. Severe pain in left leg after motorcycle fall. Unable to put weight on right foot..."
                  rows={compact ? 2 : 3}
                  className="tactical-input"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    color: '#f8fafc',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '12px',
                    color: injuryDescription ? '#f8fafc' : '#64748b',
                    fontStyle: injuryDescription ? 'normal' : 'italic',
                  }}
                >
                  {injuryDescription || 'No additional injury notes reported.'}
                </div>
              )}
            </div>
          )}

          {/* Triage / Emergency Guidance Notice */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(14, 165, 233, 0.08)',
              border: '1px solid rgba(14, 165, 233, 0.25)',
              fontSize: '10.5px',
              color: '#cbd5e1',
              lineHeight: '1.5',
            }}
          >
            <b style={{ color: '#38bdf8' }}>ℹ️ Responder Notice:</b> Visual body mapping conveys caller-reported trauma and pain zones for pre-arrival resource preparation. Professional on-scene assessment will be conducted by MDRRMO/BFP medical responders upon arrival.
          </div>
        </div>
      </div>
    </div>
  );
}
