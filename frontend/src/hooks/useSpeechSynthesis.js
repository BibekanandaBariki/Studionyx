import { useEffect, useState, useRef } from 'react';

export function useSpeechSynthesis() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);

  // CRITICAL: Must hold ref to utterance to prevent Garbage Collection (Chrome Bug)
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setIsSupported(true);

      const loadVoices = () => {
        const vs = window.speechSynthesis.getVoices();
        console.log('TTS: Voices loaded', vs.length);
        setVoices(vs);
      };

      // Load immediately and listen for changes
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = (text) => {
    if (!isSupported) {
      console.warn('TTS: Not supported');
      return;
    }
    if (!text || text.trim() === "") {
      console.warn("TTS: No text to speak");
      return;
    }

    const synth = window.speechSynthesis;

    // 1. Stop any previous speech (Critical Best Practice)
    synth.cancel();

    // 2. Create Utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // KEEP REF TO PREVENT GC
    utteranceRef.current = utterance;

    // 3. Configure Props
    // Try to find a good English voice
    const preferredVoice =
      voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Explicitly set language
    utterance.lang = preferredVoice ? preferredVoice.lang : "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    // 4. Attach Events
    utterance.onstart = () => {
      console.log("TTS: Speech started");
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log("TTS: Speech ended");
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (e) => {
      console.error("TTS: Speech error:", e);
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    // 5. Speak
    console.log(`TTS: Speaking "${text.slice(0, 30)}..."`);
    synth.speak(utterance);

    // 6. Safety Resume (for Chrome Auto-play block)
    if (synth.paused) {
      console.log("TTS: Resuming paused synth");
      synth.resume();
    }
  };

  const stop = () => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  };

  const prime = () => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
  };

  return {
    isSupported,
    isSpeaking,
    speak,
    stop,
    prime,
    voices // Exporting voices for debugging if needed
  };
}

export default useSpeechSynthesis;
