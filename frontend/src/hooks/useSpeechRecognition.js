import { useEffect, useRef, useState } from 'react';

export function useSpeechRecognition({ onFinalTranscript } = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [previewTranscript, setPreviewTranscript] = useState('');
  const [confidence, setConfidence] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const results = event.results[event.results.length - 1];
      if (!results || !results[0]) return;

      const transcript = results[0].transcript;
      const conf = results[0].confidence;

      setPreviewTranscript(transcript);
      setConfidence(conf);

      if (results.isFinal && conf > 0.7) {
        const cleaned = transcript.replace(/\b(um+|uh+)\b/gi, '').trim();
        onFinalTranscript?.(cleaned);
      }
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      recognition.stop();
    };
  }, [onFinalTranscript]);

  const start = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // ignored – calling start twice can throw
    }
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  const reset = () => {
    setPreviewTranscript('');
    setConfidence(null);
  };

  return {
    isSupported,
    isListening,
    previewTranscript,
    confidence,
    start,
    stop,
    reset,
  };
}

export default useSpeechRecognition;


