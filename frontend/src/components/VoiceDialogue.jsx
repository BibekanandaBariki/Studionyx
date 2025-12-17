import { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import GlassCard from './GlassCard.jsx';
import AnimatedBorder from './AnimatedBorder.jsx';
import WaveformVisualizer from './WaveformVisualizer.jsx';
import LoadingState from './LoadingState.jsx';
import useSpeechRecognition from '../hooks/useSpeechRecognition.js';
import useSpeechSynthesis from '../hooks/useSpeechSynthesis.js';
import { dialogueTurn } from '../utils/api.js';

const VoiceDialogue = ({ onError }) => {
  const [history, setHistory] = useState([]);
  const [pendingMessage, setPendingMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    isSupported: micSupported,
    isListening,
    previewTranscript,
    confidence,
    start,
    stop,
    reset,
  } = useSpeechRecognition({
    onFinalTranscript: (text) => {
      setPendingMessage(text);
    },
  });

  const { isSupported: ttsSupported, isSpeaking, speak, stop: stopSpeak, prime } =
    useSpeechSynthesis();

  useEffect(() => {
    return () => {
      stop();
      stopSpeak();
    };
  }, [stop, stopSpeak]);

  const handleToggleMic = () => {
    if (!micSupported) return;
    prime?.(); // Active audio context on click
    if (isListening) {
      stop();
    } else {
      reset();
      setPendingMessage('');
      start();
    }
  };

  const handleSend = async () => {
    const message = pendingMessage || previewTranscript;
    if (!message) return;

    prime?.(); // Active audio context on click (Crucial for autoplay)

    setLoading(true);
    try {
      const res = await dialogueTurn(message);
      setHistory((prev) => [...prev, res]);
      setPendingMessage('');
      reset();
      if (ttsSupported) {
        speak(res.teacherResponse);
      }
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedBorder className="h-full">
      <div className="flex h-full flex-col p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-coolwhite">Voice Dialogue</h2>
            <p className="text-xs text-slate-300/70">
              Hold a conversation with an AI tutor grounded in your exact materials.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-300/80">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
              {micSupported ? 'Listening ready' : 'Mic not supported'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/50 px-2 py-0.5">
              <Volume2 size={12} />
              {ttsSupported ? 'Voice output' : 'No voice output'}
            </span>
          </div>
        </div>

        <GlassCard className="mb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-slate-300/80">
                <span>Transcript preview</span>
                {confidence != null && (
                  <span
                    className={`rounded-full px-2 py-0.5 ${confidence > 0.7 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                      }`}
                  >
                    Confidence: {(confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <textarea
                value={pendingMessage || previewTranscript}
                onChange={(e) => setPendingMessage(e.target.value)}
                placeholder={
                  micSupported
                    ? 'Speak or type your question, then send to the tutor…'
                    : 'Type your question, then send to the tutor…'
                }
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-600/60 bg-slate-900/70 px-3 py-2 text-sm text-coolwhite outline-none ring-emerald-500/40 focus:border-emerald-500/70 focus:ring"
              />
            </div>

            <div className="flex flex-col items-center justify-center gap-3 md:w-48">
              <button
                type="button"
                onClick={handleToggleMic}
                disabled={!micSupported}
                className={`relative inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/70 bg-slate-900/80 text-emerald-300 shadow-xl transition-all duration-200 ${isListening ? 'scale-105 shadow-emerald-500/60' : 'hover:scale-105'
                  } ${!micSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div
                  className={`absolute -inset-3 rounded-full border border-emerald-400/40 ${isListening ? 'animate-pulse-soft' : 'opacity-0'
                    }`}
                />
                {isListening ? <Mic size={26} /> : <MicOff size={26} />}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={loading}
                className="text-xs rounded-full border border-emerald-400/60 px-3 py-1 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60 transition-colors"
              >
                Send to tutor
              </button>
            </div>
          </div>
          <div className="mt-4">
            <WaveformVisualizer isActive={isListening || isSpeaking} />
          </div>
        </GlassCard>

        <GlassCard className="flex-1 overflow-y-auto bg-slate-900/40">
          {history.length === 0 && !loading && (
            <p className="text-sm text-slate-300/80">
              Start with a broad question like &quot;Can you walk me through supply and demand?&quot;
              The tutor will build on each turn to keep the dialogue coherent.
            </p>
          )}
          <div className="space-y-4">
            {history.map((turn, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={idx} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-emerald-500/90 px-3 py-2 text-sm text-slate-900">
                    {turn.studentMessage}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-slate-800/80 px-3 py-2 text-sm text-slate-50 group relative">
                    {turn.teacherResponse}
                    <button
                      type="button"
                      onClick={() => speak(turn.teacherResponse)}
                      className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-emerald-300"
                      title="Replay audio"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {loading && <LoadingState lines={3} />}
          </div>
        </GlassCard>
      </div>
    </AnimatedBorder>
  );
};

export default VoiceDialogue;



