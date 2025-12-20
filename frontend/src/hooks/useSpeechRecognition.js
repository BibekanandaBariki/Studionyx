import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Robust Speech Recognition Hook
 * 
 * Features:
 * - Proper initialization check
 * - Minimum runtime validation (anti-thrashing)
 * - Exponential backoff for restarts
 * - Fatal error detection
 * - Clear user feedback states
 */
export function useSpeechRecognition({ onFinalTranscript } = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micStatus, setMicStatus] = useState('idle'); // 'idle' | 'initializing' | 'active' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [previewTranscript, setPreviewTranscript] = useState('');
  const [confidence, setConfidence] = useState(null);

  const recognitionRef = useRef(null);
  const desiredStateRef = useRef(false); // User wants mic active
  const startTimeRef = useRef(0);
  const restartCountRef = useRef(0);
  const restartTimeoutRef = useRef(null);

  // Initialize SpeechRecognition instance
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setErrorMessage('Speech recognition not supported in this browser.');
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognitionRef.current = recognition;

    // EVENT HANDLERS
    recognition.onstart = () => {
      console.log('Mic: Started');
      setIsListening(true);
      setMicStatus('active');
      setErrorMessage(null);
      startTimeRef.current = Date.now();
      restartCountRef.current = 0; // Reset restart count on successful start
    };

    recognition.onend = () => {
      console.log('Mic: Ended');
      setIsListening(false);
      
      // If we don't want to listen, just go idle
      if (!desiredStateRef.current) {
        setMicStatus('idle');
        return;
      }

      // AUTO-RESTART LOGIC
      const runTime = Date.now() - startTimeRef.current;
      
      // 1. Minimum Runtime Check: If it died instantly (<1s), it's a thrash loop
      if (runTime < 1000) {
        console.warn(`Mic ended too quickly (${runTime}ms).`);
        restartCountRef.current += 1;
      } else {
        // It ran for a while, so this is likely a normal timeout or silence
        // We don't increment failure count here, but we do restart
      }

      // 2. Max Retry Check
      if (restartCountRef.current > 5) {
        console.error('Mic: Max retries exceeded. Stopping.');
        setMicStatus('error');
        setErrorMessage('Microphone keeps stopping. Please check your connection.');
        desiredStateRef.current = false;
        return;
      }

      // 3. Exponential Backoff
      const backoffDelay = restartCountRef.current > 0 
        ? Math.min(1000 * Math.pow(2, restartCountRef.current), 10000)
        : 100; // Fast restart if it was a normal run

      console.log(`Mic: Restarting in ${backoffDelay}ms...`);
      setMicStatus('initializing');
      
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => {
        if (desiredStateRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.warn('Mic: Restart failed', e);
          }
        }
      }, backoffDelay);
    };

    recognition.onresult = (event) => {
      const results = event.results[event.results.length - 1];
      if (!results || !results[0]) return;

      const transcript = results[0].transcript;
      const conf = results[0].confidence;

      setPreviewTranscript(transcript);
      setConfidence(conf);

      if (results.isFinal && conf > 0.5) {
        const cleaned = transcript.trim();
        if (cleaned) {
          onFinalTranscript?.(cleaned);
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('Mic: Error', event.error);
      
      // FATAL ERRORS - Stop immediately
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
        desiredStateRef.current = false;
        setMicStatus('error');
        setIsListening(false);
        setErrorMessage(
          event.error === 'not-allowed' ? 'Microphone permission denied.' :
          event.error === 'service-not-allowed' ? 'Browser blocked microphone access.' :
          'No microphone detected.'
        );
        clearTimeout(restartTimeoutRef.current);
        return;
      }

      // RECOVERABLE ERRORS - Let onend handle the restart
      if (event.error === 'no-speech') {
        // Silence is fine, just restart
        return; 
      }
      
      if (event.error === 'network') {
        setErrorMessage('Network error. Retrying...');
      }
    };

    return () => {
      desiredStateRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      clearTimeout(restartTimeoutRef.current);
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    if (desiredStateRef.current) return;

    desiredStateRef.current = true;
    setMicStatus('initializing');
    setErrorMessage(null);
    restartCountRef.current = 0; // Reset retries on manual start

    try {
      recognitionRef.current.start();
    } catch (e) {
      // Ignore already started
    }
  }, []);

  const stop = useCallback(() => {
    desiredStateRef.current = false;
    setMicStatus('idle');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    clearTimeout(restartTimeoutRef.current);
  }, []);

  const reset = useCallback(() => {
    setPreviewTranscript('');
    setConfidence(null);
    setErrorMessage(null);
    setMicStatus('idle');
  }, []);

  return {
    isSupported,
    isListening,
    micStatus,
    errorMessage,
    previewTranscript,
    confidence,
    start,
    stop,
    reset,
  };
}
