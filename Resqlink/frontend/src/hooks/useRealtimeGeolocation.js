import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import api from '../api';
import { getSocketUrl } from '../utils/urlHelper';

let socketInstance = null;

const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), { transports: ['websocket', 'polling'] });
  }
  return socketInstance;
};

export default function useRealtimeGeolocation({
  requestId,
  interviewId,
  role = 'citizen',
  active = false,
  onLocationUpdate,
}) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef(null);
  const activeId = requestId || interviewId;

  useEffect(() => {
    // Guard: Only track when active is true
    if (!active) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation API is not supported by your browser or device.');
      return;
    }

    const socket = getSocket();

    const handleSuccess = async (position) => {
      const { latitude, longitude, heading, speed } = position.coords;
      const coordsObj = {
        lat: latitude,
        lng: longitude,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: position.timestamp,
      };

      setLocation(coordsObj);
      setError(null);
      setIsTracking(true);

      if (onLocationUpdate) {
        onLocationUpdate(coordsObj);
      }

      if (activeId) {
        // 1. Broadcast real-time telemetry over Socket.IO
        const telemetryPayload = {
          request_id: activeId,
          role,
          latitude,
          longitude,
          speed: speed || 0,
          heading: heading || 0,
          timestamp: position.timestamp,
        };

        socket.emit('telemetry_ping', telemetryPayload);

        if (role === 'responder') {
          socket.emit('update_responder_location', {
            request_id: activeId,
            responder_lat: latitude,
            responder_lng: longitude,
            speed: speed || 0,
            heading: heading || 0,
          });

          // Persist to ResQLink API
          try {
            await api.post(`/resq/update-location/${activeId}`, {
              latitude,
              longitude,
              speed: speed || 0,
              heading: heading || 0,
            });
          } catch (postErr) {
            console.warn('[LOCATION PERSIST WARNING]', postErr.message);
          }
        } else {
          socket.emit('update_citizen_location', {
            request_id: activeId,
            latitude,
            longitude,
          });
        }
      }
    };

    const handleError = (err) => {
      console.warn('[GEOLOCATION ERROR]', err.message);
      setError(err.message);
    };

    // Continuous high-accuracy GPS tracking options
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
    };

    // Immediate fix
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);

    // Watch position continuously for live real-time stream
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );

    setIsTracking(true);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
    };
  }, [activeId, role, active]);

  return { location, error, isTracking };
}
