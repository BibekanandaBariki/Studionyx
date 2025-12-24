import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, Play, PauseCircle } from 'lucide-react';
import AnimatedBorder from './AnimatedBorder.jsx';
import GlassCard from './GlassCard.jsx';
import LoadingState from './LoadingState.jsx';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis.js';
import { fetchSummary } from '../utils/api.js';

const slidesFromSummary = (summary) => [
  {
    id: 0,
    title: 'Overview',
    type: 'overview',
    content: summary.overview,
  },
  {
    id: 1,
    title: 'Key Concepts',
    type: 'concepts',
    content: summary.concepts,
  },
  {
    id: 2,
    title: 'Exam Tips',
    type: 'tips',
    content: summary.examTips,
  },
];

const VideoSummary = ({ onError }) => {
  const [summary, setSummary] = useState(null);
  const [slides, setSlides] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoNarrating, setAutoNarrating] = useState(false);
  const advanceTimeoutRef = useRef(null);
  const sessionRef = useRef(0);
  const speechEndRef = useRef(null);

  const { isSupported: ttsSupported, isSpeaking, speak, stop, prime } = useSpeechSynthesis({
    onEnd: () => {
      if (autoNarrating && speechEndRef.current === current) {
        const next = current + 1;
        if (next < slides.length) {
          setCurrent(next);
          const currentSession = sessionRef.current;
          clearTimeout(advanceTimeoutRef.current);
          advanceTimeoutRef.current = setTimeout(() => {
            if (autoNarrating && sessionRef.current === currentSession) {
              playSlide(next);
            }
          }, 800);
        } else {
          setAutoNarrating(false);
        }
      }
      speechEndRef.current = null;
    },
  });

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const ensureSummary = async () => {
    if (summary) return;
    setLoading(true);
    try {
      const res = await fetchSummary();
      setSummary(res.summary);
      setSlides(slidesFromSummary(res.summary));
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSlideText = (slide) => {
    if (!slide) return '';
    if (slide.type === 'overview') {
      return slide.content;
    }
    // Handle both string and object formats in arrays
    if (Array.isArray(slide.content)) {
      return slide.content
        .map(item => typeof item === 'string' ? item : (item.explanation || item.title || ''))
        .join('. ');
    }
    return slide.content;
  };

  const playSlide = (idx) => {
    if (!ttsSupported || !slides[idx]) return;
    const text = getSlideText(slides[idx]);
    speechEndRef.current = idx;
    speak(text);
  };

  const goTo = (idx) => {
    if (!slides.length) return;
    const next = (idx + slides.length) % slides.length;
    setCurrent(next);
    setAutoNarrating(false);
    stop();
    clearTimeout(advanceTimeoutRef.current);
    sessionRef.current += 1;
    speechEndRef.current = null;

  };

  const handleToggleNarration = async () => {
    if (!ttsSupported) return;

    prime?.();

    if (!summary) {
      await ensureSummary();
    }
    if (!summary || !slides.length) return;

    if (autoNarrating) {
      setAutoNarrating(false);
      stop();
      clearTimeout(advanceTimeoutRef.current);
      sessionRef.current += 1;
      speechEndRef.current = null;
    } else {
      stop();
      clearTimeout(advanceTimeoutRef.current);
      sessionRef.current += 1;
      setAutoNarrating(true);
      // Start from current slide
      const target = current;
      playSlide(target);
    }
  };

  const handleDownload = async () => {
    if (!summary) {
      await ensureSummary();
    }
    if (!summary) return;

    // Helper to extract text from string or object
    const getText = (item) => typeof item === 'string' ? item : (item.explanation || item.title || '');

    const content = `Overview\n--------\n${summary.overview}\n\nKey Concepts\n------------\n${summary.concepts
      .map((c, i) => `${i + 1}. ${getText(c)}`)
      .join('\n')}\n\nExam Tips\n---------\n${summary.examTips
        .map((t, i) => `${i + 1}. ${getText(t)}`)
        .join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'economics-summary.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSlide = slides[current];

  return (
    <AnimatedBorder className="h-full">
      <div className="flex h-full flex-col p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-coolwhite">Video-style Summary</h2>
            <p className="text-[10px] md:text-xs text-slate-300/70">
              Three focused slides: overview, key concepts, and exam tips – all grounded in your
              material.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300/80">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 rounded-full border border-slate-600/60 px-3 py-1 hover:border-emerald-400/70 hover:text-emerald-300 transition-colors"
            >
              <Download size={13} />
              Download notes
            </button>
          </div>
        </div>

        <GlassCard className="flex-1 min-h-0 bg-slate-900/40">
          {!summary && !loading && (
            <div className="flex h-full items-center justify-center">
              <button
                type="button"
                onClick={ensureSummary}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10 transition-colors"
              >
                Generate summary from material
              </button>
            </div>
          )}

          {loading && (
            <div className="flex h-full items-center justify-center">
              <LoadingState lines={5} />
            </div>
          )}

          {summary && currentSlide && (
            <div className="flex h-full flex-col">
              <div className="flex-shrink-0 mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/90 text-slate-900 text-sm font-semibold shadow-lg">
                    {current + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-coolwhite">
                      {currentSlide.title}
                    </h3>
                    <p className="text-[11px] text-slate-300/70">
                      Slide {current + 1} of {slides.length}
                    </p>
                  </div>
                </div>
                {ttsSupported && (
                  <button
                    type="button"
                    onClick={handleToggleNarration}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-400/70 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 transition-colors"
                  >
                    {autoNarrating || isSpeaking ? (
                      <>
                        <PauseCircle size={14} />
                        Pause narration
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        Auto-play
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-slate-900/70 p-4 text-sm text-slate-100 scrollbar-thin scrollbar-thumb-emerald-500/50 scrollbar-track-slate-800/50 hover:scrollbar-thumb-emerald-500/70">
                {currentSlide.type === 'overview' && (
                  <p className="leading-8 text-base text-slate-200">{summary.overview}</p>
                )}
                {currentSlide.type === 'concepts' && (
                  <ol className="list-decimal space-y-4 pl-5 marker:text-emerald-400 marker:font-medium">
                    {summary.concepts.map((c, i) => {
                      // Handle both string and object formats
                      const conceptText = typeof c === 'string' ? c : (c.explanation || c.title || JSON.stringify(c));
                      return (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={i} className="leading-7 text-slate-200">{conceptText}</li>
                      );
                    })}
                  </ol>
                )}
                {currentSlide.type === 'tips' && (
                  <ul className="space-y-4">
                    {summary.examTips.map((t, i) => {
                      // Handle both string and object formats
                      const tipText = typeof t === 'string' ? t : (t.explanation || t.title || JSON.stringify(t));
                      return (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-[6px] h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                          <span className="leading-relaxed text-slate-200 tracking-wide">{tipText}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex-shrink-0 mt-4 flex items-center justify-between text-[11px] text-slate-300/80">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goTo(current - 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 hover:border-emerald-400/70 hover:text-emerald-300 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(current + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 hover:border-emerald-400/70 hover:text-emerald-300 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {slides.map((s) => (
                    <span
                      key={s.id}
                      className={`h-1.5 rounded-full transition-all duration-200 ${s.id === current ? 'w-5 bg-emerald-400' : 'w-2 bg-slate-500'
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </AnimatedBorder>
  );
};

export default VideoSummary;

