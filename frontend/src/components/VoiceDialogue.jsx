import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mic, MicOff, Volume2, AlertTriangle, RefreshCw, Send } from 'lucide-react';
import GlassCard from './GlassCard.jsx';
import AnimatedBorder from './AnimatedBorder.jsx';
import WaveformVisualizer from './WaveformVisualizer.jsx';
import LoadingState from './LoadingState.jsx';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.js';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis.js';
import { useMicrophonePermission } from '../hooks/useMicrophonePermission.js';
import { dialogueTurn } from '../utils/api.js';

const VoiceDialogue = ({ onError }) => {
  const [history, setHistory] = useState([]);
  const [pendingMessage, setPendingMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false); // User intent

  const { permissionState, error: permError, requestPermission } = useMicrophonePermission();

  const {
    isSupported: micSupported,
    isListening,
    micStatus,
    errorMessage,
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

  const { isSupported: ttsSupported, isSpeaking, speak, stop: stopSpeak } =
    useSpeechSynthesis();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      stopSpeak();
    };
  }, [stop, stopSpeak]);

  // Handle permission requests
  const handleToggleMic = async () => {
    if (!micSupported) return;

    // If turning on, check permission first
    if (!micEnabled) {
      if (permissionState === 'prompt') {
        const granted = await requestPermission();
        if (!granted) return; // Don't enable if denied
      } else if (permissionState === 'denied') {
        onError?.(permError || 'Microphone access denied');
        return;
      }
    }

    setMicEnabled(prev => !prev);
    if (micEnabled) {
      // Turning off
      stop();
      reset();
    }
  };

  // Coordinate Mic state based on lifecycle
  useEffect(() => {
    // If user explicitly disabled mic, ensure it stops
    if (!micEnabled) {
      if (micStatus === 'active' || micStatus === 'initializing') {
        stop();
      }
      return;
    }

    // If user wants mic enabled:
    // 1. If speaking (TTS), stop mic.
    // 2. If processing (API), stop mic.
    // 3. Otherwise, ensure mic is started.

    if (isSpeaking || isProcessing) {
      if (micStatus === 'active') stop();
    } else {
      // Only try to start if we are not already active/initializing and not in error state
      if (micStatus === 'idle') {
        start();
      }
    }
    // Remove start/stop from dependencies to avoid loop
    // Rely on micEnabled/isSpeaking/isProcessing/micStatus changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled, isSpeaking, isProcessing, micStatus]);

  // Show errors from hook
  useEffect(() => {
    if (errorMessage) {
      // If fatal error, disable mic intent
      if (micStatus === 'error') {
        setMicEnabled(false);
      }
      // Only report if it's a new error string to avoid loops with unstable onError prop
      onError?.(errorMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorMessage, micStatus]); // Exclude onError to prevent infinite updates if parent doesn't memoize it


  const handleSend = async () => {
    const message = pendingMessage || previewTranscript;
    if (!message || isProcessing) return;

    setIsProcessing(true);
    setLoading(true);
    // Note: Effect will auto-stop mic here

    try {
      const res = await dialogueTurn(message);
      setHistory((prev) => [...prev, res]);
      setPendingMessage('');
      reset();

      // Speak response
      if (ttsSupported) {
        // Small delay to let UI settle
        setTimeout(() => {
          speak(res.teacherResponse);
          // After speech ends, effect will auto-start mic
        }, 100);
      }
    } catch (err) {
      onError?.(err.message);
      // If error, we should probably let mic restart if enabled
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  return (
    <AnimatedBorder className="h-full">
      <div className="flex h-full flex-col p-2 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-coolwhite">Voice Dialogue</h2>
            <p className="text-[10px] md:text-xs text-slate-300/70">
              Hold a conversation with an AI tutor grounded in your exact materials.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-300/80">
            {isSpeaking && (
              <button
                type="button"
                onClick={stopSpeak}
                className="inline-flex items-center gap-1 rounded-full border border-red-400/60 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition-colors animate-pulse-soft"
              >
                <Volume2 size={14} className="animate-pulse" />
                Stop Speaking
              </button>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${micStatus === 'error'
              ? 'border-amber-400/50 bg-amber-500/10 text-amber-300'
              : micStatus === 'active'
                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300'
                : micSupported
                  ? 'border-emerald-400/50 px-2 py-0.5'
                  : 'border-slate-400/50 bg-slate-500/10 text-slate-300'
              }`}>
              {micStatus === 'error' ? (
                <>
                  <AlertTriangle size={12} />
                  Mic error
                </>
              ) : micStatus === 'active' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                  Listening
                </>
              ) : micSupported ? (
                'Listening ready'
              ) : (
                'Mic not supported'
              )}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/50 px-2 py-0.5">
              <Volume2 size={12} />
              {ttsSupported ? 'Voice output' : 'No voice output'}
            </span>
          </div>
        </div>

        <GlassCard className="flex-shrink-0 mb-1 md:mb-4 !p-1.5 md:!p-6 overflow-hidden shadow-inner">
          {/* Main Layout: Single Row on Mobile, Side-by-Side on Desktop */}
          <div className="flex flex-row items-center gap-1.5 md:items-start md:gap-4">

            {/* Input Area */}
            <div className="flex flex-1 flex-col gap-1.5 md:gap-2">
              <div className="hidden md:flex items-center justify-between text-[11px] text-slate-300/80">
                <span>Transcript preview</span>
                {confidence != null && (
                  <span className={`rounded-full px-2 py-0.5 ${confidence > 0.7 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    Confidence: {(confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <textarea
                value={pendingMessage || previewTranscript}
                onChange={(e) => setPendingMessage(e.target.value)}
                placeholder={micSupported ? "Speak or type..." : "Type question..."}
                rows={1}
                className="w-full resize-none rounded-xl border border-slate-600/60 bg-slate-900/70 px-3 py-1.5 md:py-3 text-sm text-coolwhite shadow-inner outline-none ring-emerald-500/40 focus:border-emerald-500/70 focus:ring min-h-[36px] md:min-h-[80px] max-h-24 leading-relaxed"
              />
            </div>

            {/* Controls: Compact Row on Mobile, Vertical Stack on Desktop */}
            <div className="flex flex-row items-center gap-1 md:flex-col md:w-40 md:justify-center md:gap-3">
              <button
                type="button"
                onClick={handleToggleMic}
                disabled={!micSupported || micStatus === 'error'}
                className={`relative inline-flex h-8 w-8 md:h-16 md:w-16 items-center justify-center rounded-full border-2 bg-slate-900/80 text-emerald-300 transition-all duration-200 ${micEnabled ? 'border-emerald-400/70 scale-105 shadow-emerald-500/40' : 'border-emerald-400/70 hover:scale-105'}`}
              >
                <div className={`absolute -inset-2 md:-inset-3 rounded-full border ${micStatus === 'active' ? 'border-emerald-400/40 animate-pulse-soft' : 'opacity-0'}`} />
                {micStatus === 'error' ? (
                  <AlertTriangle size={14} className="text-amber-400 md:size-6" />
                ) : micEnabled ? (
                  <Mic size={14} className="md:size-6" />
                ) : (
                  <MicOff size={14} className="md:size-6" />
                )}
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={loading || isProcessing}
                className="flex items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors h-8 w-8 md:h-auto md:w-auto md:px-4 md:py-2"
              >
                <Send size={14} className="md:mr-2" />
                <span className="hidden md:inline text-xs font-medium">{isProcessing ? 'Processing...' : 'Send to tutor'}</span>
              </button>
            </div>
          </div>

          {/* Waveform at Bottom */}
          <div className="mt-0 md:mt-4">
            <WaveformVisualizer isActive={isListening || isSpeaking} />
          </div>
        </GlassCard>

        <GlassCard className="flex-1 overflow-y-auto bg-slate-900/40">
          {history.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center max-w-sm">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <Volume2 className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-emerald-100 mb-1">Start the conversation</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Try asking: &quot;Can you walk me through supply and demand?&quot;
                </p>
              </div>
            </div>
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
                  <div className="max-w-[85%] rounded-2xl bg-slate-800/80 px-4 py-3 text-sm text-slate-50 group relative leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ node, ...props }) => <h2 className="text-emerald-300 font-bold text-sm mt-2 mb-1 first:mt-0" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-emerald-200 font-semibold text-xs mt-1 mb-0.5" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-1 space-y-0.5" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5" {...props} />,
                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-emerald-100" {...props} />,
                      }}
                    >
                      {turn.teacherResponse}
                    </ReactMarkdown>
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
