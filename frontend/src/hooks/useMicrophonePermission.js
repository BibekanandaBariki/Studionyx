import { useState, useCallback } from 'react';

export function useMicrophonePermission() {
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [error, setError] = useState(null);

  const requestPermission = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Browser API not supported');
      setPermissionState('denied');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just wanted to check permission
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      setError(null);
      return true;
    } catch (err) {
      console.error('Mic permission denied:', err);
      setPermissionState('denied');
      setError(err.name === 'NotAllowedError' 
        ? 'Microphone access denied. Please enable it in browser settings.' 
        : 'Could not access microphone.');
      return false;
    }
  }, []);

  return { permissionState, error, requestPermission };
}
