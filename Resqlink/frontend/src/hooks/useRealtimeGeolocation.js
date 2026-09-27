import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import api from '../api';

let socketInstance = null;

const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io();
  }
  return socketInstance;
};

export default function useRealtimeGeolocation({ interviewId, active = false, onLocationUpdate }) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef(null);

  useEffect(() => {
    // Privacy Condition Guard: Only track when active is true
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

      if (interviewId) {
        // 1. Broadcast via Socket.IO real-time channel to active room
        socket.emit('update_live_location', {
          interview_id: interviewId,
          latitude,
          longitude,
          timestamp: position.timestamp,
        });

        // 2. Persist to API database
        try {
          await api.patch(`/interviews/${interviewId}/location`, {
            latitude,
            longitude,
          });
        } catch (err) {
          // Fallback to POST if server prefers POST route
          try {
            await api.post(`/interviews/${interviewId}/location`, {
              latitude,
              longitude,
            });
          } catch (postErr) {
            console.error('[LOCATION PERSIST ERROR]', postErr);
          }
        }
      }
    };

    const handleError = (err) => {
      console.warn('[GEOLOCATION ERROR]', err.message);
      setError(err.message);
    };

    // Continuous high-accuracy GPS tracking logic
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    // Immediately attempt to get current location
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);

    // Watch position continuously for live real-time updates as user moves
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
  }, [interviewId, active]);

  return { location, error, isTracking };
}
