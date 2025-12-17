import { useEffect, useState } from 'react';
import { Brain, FileText, MessageCircleMore, Waves, FolderPlus } from 'lucide-react';
import Hero from './Hero.jsx';
import QAChat from './QAChat.jsx';
import VoiceDialogue from './VoiceDialogue.jsx';
import VideoSummary from './VideoSummary.jsx';
import GlassCard from './GlassCard.jsx';
import AnimatedBorder from './AnimatedBorder.jsx';
import SourceUpload from './SourceUpload.jsx';
import { ingestMaterials, fetchStats, fetchSuggestedQuestions } from '../utils/api.js';
import useToast from '../hooks/useToast.jsx';

const Dashboard = () => {
  const [mode, setMode] = useState('qa');
  const [ingesting, setIngesting] = useState(false);
  const [materialLoaded, setMaterialLoaded] = useState(false);
  const [showHero, setShowHero] = useState(true);
  const [showSourceUpload, setShowSourceUpload] = useState(false);
  const [sourceCount, setSourceCount] = useState(0);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const { showToast, ToastContainer } = useToast();

  const handleError = (message) => {
    showToast(message, 'error');
  };

  const loadStats = async () => {
    try {
      const stats = await fetchStats();
      setMaterialLoaded(stats.materialLoaded);
      setSourceCount(stats.sourceCount || 0);
    } catch (err) {
      // silent; shown only when ingesting fails
      // eslint-disable-next-line no-console
      console.warn('Stats error', err);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const fetchMoreSuggestions = async () => {
    try {
      const sugg = await fetchSuggestedQuestions();
      if (sugg.questions) {
        setSuggestedQuestions(prev => [...prev, ...sugg.questions]);
      }
    } catch (e) {
      console.warn('Failed to fetch more suggestions', e);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const res = await ingestMaterials();
      setMaterialLoaded(true);
      showToast(`Study material ingested (${(res.stats.totalLength / 1000).toFixed(1)}k chars).`);

      try {
        const sugg = await fetchSuggestedQuestions();
        if (sugg.questions) {
          setSuggestedQuestions(sugg.questions);
        }
      } catch (e) {
        console.warn('Failed to fetch suggestions', e);
      }

    } catch (err) {
      handleError(err.message);
    } finally {
      setIngesting(false);
    }
  };

  const renderMode = () => {
    if (mode === 'qa') return <QAChat onError={handleError} suggestedQuestions={suggestedQuestions} onRequestMoreSuggestions={fetchMoreSuggestions} />;
    if (mode === 'voice') return <VoiceDialogue onError={handleError} />;
    return <VideoSummary onError={handleError} />;
  };

  if (showHero) {
    return (
      <>
        <Hero
          onGetStarted={() => {
            setShowHero(false);
          }}
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slatebg text-coolwhite">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Interactive Study Tool
              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                NotebookLM Reimagined
              </span>
            </h1>
            <p className="text-sm text-slate-300/80">
              Grounded economics tutoring across Q&amp;A, voice dialogue, and video-style
              summaries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSourceUpload(true)}
              className="inline-flex items-center gap-2 rounded-full border border-blue-400/70 bg-blue-500/15 px-4 py-2 text-sm text-blue-200 hover:bg-blue-500/25 transition-colors"
            >
              <FolderPlus size={16} />
              Manage Sources
              {sourceCount > 0 && (
                <span className="rounded-full bg-blue-400/30 px-2 py-0.5 text-xs font-medium">
                  {sourceCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleIngest}
              disabled={ingesting}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/70 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60 transition-colors"
            >
              <FileText size={16} />
              {ingesting ? 'Ingesting study material…' : 'Ingest study material'}
            </button>
            <span className="flex items-center gap-1 text-xs text-slate-300/80">
              <span
                className={`h-2 w-2 rounded-full ${materialLoaded ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
              />
              {materialLoaded ? 'Material loaded' : 'Material not yet ingested'}
            </span>
          </div>
        </header>

        <main className="grid gap-5 md:grid-cols-[1.15fr,0.95fr]">
          <section className="space-y-4">
            {renderMode()}
          </section>

          <aside className="space-y-4">
            <AnimatedBorder>
              <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                  <Brain className="h-6 w-6 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-coolwhite">
                      Modes
                    </h3>
                    <p className="text-xs text-slate-300/80">
                      Switch between grounded chat, voice, and summary flows.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMode('qa')}
                    className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-all ${mode === 'qa'
                      ? 'border-emerald-400/70 bg-emerald-500/15'
                      : 'border-slate-600/60 bg-slate-900/60 hover:border-emerald-400/60'
                      }`}
                  >
                    <MessageCircleMore size={16} className="text-emerald-300" />
                    <span>Q&amp;A</span>
                    <span className="text-[10px] text-slate-300/80">Text-first</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('voice')}
                    className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-all ${mode === 'voice'
                      ? 'border-emerald-400/70 bg-emerald-500/15'
                      : 'border-slate-600/60 bg-slate-900/60 hover:border-emerald-400/60'
                      }`}
                  >
                    <Waves size={16} className="text-emerald-300" />
                    <span>Voice</span>
                    <span className="text-[10px] text-slate-300/80">Conversation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('summary')}
                    className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-all ${mode === 'summary'
                      ? 'border-emerald-400/70 bg-emerald-500/15'
                      : 'border-slate-600/60 bg-slate-900/60 hover:border-emerald-400/60'
                      }`}
                  >
                    <FileText size={16} className="text-emerald-300" />
                    <span>Slides</span>
                    <span className="text-[10px] text-slate-300/80">Exam view</span>
                  </button>
                </div>
              </div>
            </AnimatedBorder>

            <GlassCard hover={false} className="bg-slate-900/50 text-xs leading-relaxed">
              <h3 className="mb-2 text-sm font-semibold text-emerald-300">
                Grounding contract
              </h3>
              <p className="mb-1 text-slate-200/90">
                Every AI response is constrained to the ingested textbook chapter and two videos.
              </p>
              <p className="mb-1 text-slate-300/80">
                If a concept is not covered there, the tutor explicitly says:
              </p>
              <p className="mb-2 italic text-emerald-200">
                &quot;I don&apos;t have information about this topic in the provided study
                material.&quot;
              </p>
              <p className="text-slate-300/80">
                This keeps the tool accurate and exam-relevant, rather than hallucinating general
                knowledge.
              </p>
            </GlassCard>
          </aside>
        </main>
      </div>
      <ToastContainer />

      {showSourceUpload && (
        <SourceUpload
          onClose={() => setShowSourceUpload(false)}
          onSourcesUpdated={loadStats}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default Dashboard;


