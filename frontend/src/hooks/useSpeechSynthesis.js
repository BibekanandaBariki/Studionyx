import { useEffect, useState, useCallback } from 'react';

export function useSpeechSynthesis(opts = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!window.speechSynthesis) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const list = synth.getVoices();
      setVoices(list);
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }, []);

  const speak = useCallback((text) => {
    if (!isSupported || !text) return;

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Improved voice selection
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

    let preferred;
    if (isIOS) {
      // On iOS, try to find a high-quality English voice
      preferred =
        voices.find(v => v.lang.startsWith('en') && v.name.includes('Samantha')) ||
        voices.find(v => v.lang.startsWith('en') && v.name.includes('Siri')) ||
        voices.find(v => v.lang.startsWith('en') && v.name.includes('Enhanced')) ||
        voices.find(v => v.lang.startsWith('en'));
    } else {
      // Desktop preference
      preferred =
        voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];
    }

    if (preferred) {
      utterance.voice = preferred;
    }

    // iOS system voices are often slower than Google voices at the same rate
    utterance.rate = isIOS ? 1.0 : 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (typeof opts.onEnd === 'function') {
        opts.onEnd();
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    synth.speak(utterance);
  }, [isSupported, voices, opts]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const prime = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;

    // On iOS, we need to speak an empty utterance in response to a user gesture
    // to "unlock" the speech synthesis engine for later use (after async calls).
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0; // Silent
    synth.speak(utterance);

    if (synth.paused) {
      synth.resume();
    }
  }, [isSupported]);

  return {
    isSupported,
    voices,
    isSpeaking,
    speak,
    stop,
    prime,
  };
}

export default useSpeechSynthesis;
