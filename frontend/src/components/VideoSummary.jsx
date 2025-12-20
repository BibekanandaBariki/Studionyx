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
    return slide.type === 'overview'
      ? slide.content
      : Array.isArray(slide.content) ? slide.content.join('. ') : slide.content;
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
      const target = current >= slides.length - 1 ? 0 : current;
      setCurrent(target);
      playSlide(target);
    }
  };

  const handleDownload = async () => {
    if (!summary) {
      await ensureSummary();
    }
    if (!summary) return;
    const content = `Overview\n--------\n${summary.overview}\n\nKey Concepts\n------------\n${summary.concepts
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n')}\n\nExam Tips\n---------\n${summary.examTips
        .map((t, i) => `${i + 1}. ${t}`)
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
            <h2 className="text-lg font-semibold text-coolwhite">Video-style Summary</h2>
            <p className="text-xs text-slate-300/70">
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

        <GlassCard className="flex-1 bg-slate-900/40">
          {!summary && !loading && (
            <button
              type="button"
              onClick={ensureSummary}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10 transition-colors"
            >
              Generate summary from material
            </button>
          )}

          {loading && <LoadingState lines={5} />}

          {summary && currentSlide && (
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center justify-between gap-3">
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

              <div className="flex-1 rounded-2xl bg-slate-900/70 p-4 text-sm text-slate-100">
                {currentSlide.type === 'overview' && (
                  <p className="leading-relaxed">{summary.overview}</p>
                )}
                {currentSlide.type === 'concepts' && (
                  <ol className="list-decimal space-y-2 pl-5">
                    {summary.concepts.map((c, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                )}
                {currentSlide.type === 'tips' && (
                  <ul className="space-y-2">
                    {summary.examTips.map((t, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-[3px] h-2 w-2 rounded-full bg-emerald-400" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-300/80">
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

