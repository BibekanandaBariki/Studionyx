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
    const preferred =
      voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
      voices[0];

    if (preferred) {
      utterance.voice = preferred;
    }

    utterance.rate = 0.9;
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
    synth.resume();
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
