import { useEffect, useState, useRef } from 'react';
import { Brain, FileText, MessageCircleMore, Waves, FolderPlus, ChevronDown, Plus, Trash2, Edit2, LayoutGrid, PanelLeftClose, PanelRightClose } from 'lucide-react';
import Hero from './Hero.jsx';
import QAChat from './QAChat.jsx';
import VoiceDialogue from './VoiceDialogue.jsx';
import VideoSummary from './VideoSummary.jsx';
import GlassCard from './GlassCard.jsx';
import AnimatedBorder from './AnimatedBorder.jsx';
import SourceUpload from './SourceUpload.jsx';
import SourceList from './SourceList.jsx';
import { ingestMaterials, fetchStats, fetchSuggestedQuestions, fetchSources, listNotebooks, createNotebook, activateNotebook, renameNotebook, deleteNotebook, removeSource } from '../utils/api.js';
import useToast from '../hooks/useToast.jsx';

const Dashboard = () => {
  const [mode, setMode] = useState('qa');
  const [ingesting, setIngesting] = useState(false);
  const [materialLoaded, setMaterialLoaded] = useState(false);
  const [showHero, setShowHero] = useState(true);
  const [showSourceUpload, setShowSourceUpload] = useState(false);
  const [sourceCount, setSourceCount] = useState(0);
  const [sources, setSources] = useState([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const { showToast, ToastContainer } = useToast();
  const [notebooks, setNotebooks] = useState([]);
  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [notebookMenuOpen, setNotebookMenuOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const notebookDropdownRef = useRef(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat'); // 'sources', 'chat', 'studio'
  const suggestionsRequestIdRef = useRef(0); // Track request IDs to prevent race conditions

  const handleError = (message) => {
    showToast(message, 'error');
  };

  const loadStats = async () => {
    try {
      const stats = await fetchStats();
      setMaterialLoaded(stats.materialLoaded);
      setSourceCount(stats.sourceCount || 0);
      setActiveNotebookId(stats.activeNotebookId);
      return stats;
    } catch (err) {
      // silent; shown only when ingesting fails
      // eslint-disable-next-line no-console
      console.warn('Stats error', err);
      return null;
    }
  };

  const loadSources = async () => {
    try {
      const data = await fetchSources();
      setSources(data.sources || []);
    } catch (err) {
      console.warn('Sources error', err);
    }
  };

  const loadNotebooks = async () => {
    try {
      const data = await listNotebooks();
      setNotebooks(data.notebooks || []);
      setActiveNotebookId(data.activeNotebookId || null);
    } catch (err) {
      console.warn('Notebooks error', err);
    }
  };

  const loadSuggestedQuestions = async () => {
    // Increment request ID to track this specific request
    const currentRequestId = ++suggestionsRequestIdRef.current;
    console.log(`[Dashboard] Loading suggested questions... (Request ID: ${currentRequestId})`);

    setLoadingSuggestions(true);
    try {
      const sugg = await fetchSuggestedQuestions();
      console.log(`[Dashboard] Suggested questions response (Request ID: ${currentRequestId}):`, sugg);

      // Only update state if this is still the most recent request
      if (currentRequestId === suggestionsRequestIdRef.current) {
        if (sugg && sugg.questions && Array.isArray(sugg.questions)) {
          console.log(`[Dashboard] Setting suggested questions (Request ID: ${currentRequestId}):`, sugg.questions);
          setSuggestedQuestions(sugg.questions);
        } else {
          console.warn(`[Dashboard] Invalid suggested questions response (Request ID: ${currentRequestId}):`, sugg);
          setSuggestedQuestions([]);
        }
      } else {
        console.log(`[Dashboard] Ignoring stale response (Request ID: ${currentRequestId}, Current: ${suggestionsRequestIdRef.current})`);
      }
    } catch (e) {
      console.error(`[Dashboard] Failed to fetch suggestions (Request ID: ${currentRequestId}):`, e);
      // Only clear if this is still the most recent request
      if (currentRequestId === suggestionsRequestIdRef.current) {
        setSuggestedQuestions([]);
      }
    } finally {
      // Only update loading state if this is still the most recent request
      if (currentRequestId === suggestionsRequestIdRef.current) {
        setLoadingSuggestions(false);
        console.log(`[Dashboard] Finished loading suggested questions (Request ID: ${currentRequestId})`);
      }
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      await loadStats();
      await loadSources();
      await loadNotebooks();

      // Load suggested questions if material is already ingested
      const stats = await loadStats();
      if (stats?.materialLoaded) {
        loadSuggestedQuestions();
      }
    };
    initializeDashboard();
  }, []);

  // Close notebook dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notebookDropdownRef.current && !notebookDropdownRef.current.contains(event.target)) {
        setNotebookMenuOpen(false);
      }
    };

    if (notebookMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notebookMenuOpen]);

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
      if (res.stats && res.stats.totalLength) {
        showToast(`Study material ingested (${(res.stats.totalLength / 1000).toFixed(1)}k chars).`);
      } else {
        showToast('Study material ingested.');
      }

      // Load suggested questions after successful ingestion
      await loadSuggestedQuestions();

    } catch (err) {
      handleError(err.message);
    } finally {
      setIngesting(false);
      loadStats();
      loadSources();
    }
  };

  const handleCreateNotebook = async () => {
    try {
      const res = await createNotebook('New Notebook');
      setActiveNotebookId(res.activeNotebookId);
      showToast('Notebook created');
      await loadNotebooks();
      await loadSources();
      await loadStats();
    } catch (err) {
      handleError(err.message);
    }
  };

  const handleActivateNotebook = async (id) => {
    try {
      const res = await activateNotebook(id);
      setActiveNotebookId(res.activeNotebookId);
      setSuggestedQuestions([]);
      showToast('Notebook activated');
      await loadNotebooks();
      await loadSources();
      const stats = await loadStats();

      // Load suggested questions for the newly activated notebook if it has material
      if (stats?.materialLoaded) {
        await loadSuggestedQuestions();
      }
    } catch (err) {
      handleError(err.message);
    }
  };

  const handleRenameNotebook = async (id) => {
    const nb = notebooks.find(n => n.id === id);
    const name = window.prompt('Rename notebook', nb?.name || '');
    if (!name) return;
    try {
      await renameNotebook(id, name);
      await loadNotebooks();
      showToast('Notebook renamed');
    } catch (err) {
      handleError(err.message);
    }
  };

  const handleDeleteNotebook = async (id) => {
    try {
      await deleteNotebook(id);
      await loadNotebooks();
      await loadSources();
      await loadStats();
      showToast('Notebook deleted');
    } catch (err) {
      handleError(err.message);
    }
  };

  const renderMode = () => {
    if (mode === 'qa') return <QAChat onError={handleError} suggestedQuestions={suggestedQuestions} loadingSuggestions={loadingSuggestions} onRequestMoreSuggestions={fetchMoreSuggestions} />;
    if (mode === 'voice') return <VoiceDialogue onError={handleError} />;
    return <VideoSummary onError={handleError} />;
  };

  const MobileTabs = () => (
    <div className="grid grid-cols-3 border-t border-white/5 bg-slate-900/50 backdrop-blur-xl lg:hidden">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setMobileTab('sources'); }}
        className={`flex flex-col items-center justify-center py-3 text-sm font-medium transition-colors ${mobileTab === 'sources' ? 'border-b-2 border-emerald-400 text-emerald-300' : 'text-slate-400 border-b-2 border-transparent'}`}
      >
        Sources
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setMobileTab('chat');
          if (mode !== 'qa' && mode !== 'voice') setMode('qa');
        }}
        className={`flex flex-col items-center justify-center py-3 text-sm font-medium transition-colors ${mobileTab === 'chat' ? 'border-b-2 border-emerald-400 text-emerald-300' : 'text-slate-400 border-b-2 border-transparent'}`}
      >
        Chat
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setMobileTab('studio');
          setMode('summary');
        }}
        className={`flex flex-col items-center justify-center py-3 text-sm font-medium transition-colors ${mobileTab === 'studio' ? 'border-b-2 border-emerald-400 text-emerald-300' : 'text-slate-400 border-b-2 border-transparent'}`}
      >
        Studio
      </button>
    </div>
  );

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
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-coolwhite">
      <div className="grid h-full grid-rows-[auto_1fr]">
        <header className="glass-effect border-b border-emerald-500/20 px-6 py-4 shadow-lg relative z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg animate-glow">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold gradient-text">Interactive Study Tool</h1>
                  <p className="hidden lg:block text-[11px] text-slate-400">
                    Grounded economics tutoring • Q&amp;A • Voice • Video Summaries
                  </p>
                </div>
              </div>
              <span className="hidden md:inline-block rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-300 shadow-sm">
                NotebookLM Reimagined
              </span>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <button
                type="button"
                onClick={handleCreateNotebook}
                className="hidden lg:inline-flex group h-10 items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 text-xs font-medium text-slate-200 shadow-md transition-all hover:border-emerald-400/70 hover:bg-emerald-500/10 hover:shadow-emerald-500/20 hover:-translate-y-0.5"
              >
                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                New Notebook
              </button>
              <div className="relative" ref={notebookDropdownRef}>
                <button
                  type="button"
                  onClick={() => setNotebookMenuOpen((v) => !v)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-800/50 px-3 lg:px-4 text-xs font-medium text-slate-200 shadow-md transition-all hover:border-emerald-400/70 hover:bg-emerald-500/10 hover:shadow-emerald-500/20"
                >
                  <LayoutGrid size={16} />
                  <span className="hidden lg:inline">Notebooks</span>
                  <ChevronDown size={14} className={`transition-transform ${notebookMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {notebookMenuOpen && (
                  <div className="absolute right-0 top-full z-[60] mt-2 w-72 max-w-[90vw] rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
                    <div className="p-2 border-b border-white/5 lg:hidden">
                      <button
                        type="button"
                        onClick={() => { handleCreateNotebook(); setNotebookMenuOpen(false); }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <Plus size={14} />
                        Create New Notebook
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {notebooks.map(nb => (
                        <div key={nb.id} className={`group flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-all ${activeNotebookId === nb.id ? 'bg-emerald-500/15 border border-emerald-500/30' : 'hover:bg-slate-800/50'}`}>
                          <button
                            type="button"
                            onClick={() => { setNotebookMenuOpen(false); handleActivateNotebook(nb.id); }}
                            className="flex-1 truncate text-left text-sm text-coolwhite hover:text-emerald-300 transition-colors"
                            title={nb.name}
                          >
                            {activeNotebookId === nb.id && <span className="mr-2 text-emerald-400">●</span>}
                            {nb.name}
                          </button>
                          <div className="flex items-center gap-1">
                            {!nb.isDefault && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleRenameNotebook(nb.id); }}
                                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-coolwhite lg:p-1.5"
                                  title="Rename"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteNotebook(nb.id); }}
                                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-300 lg:p-1.5"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleIngest}
                disabled={ingesting}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-400/70 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 px-5 text-sm font-semibold text-emerald-200 shadow-lg transition-all hover:from-emerald-500/30 hover:to-emerald-600/30 hover:shadow-emerald-500/30 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {ingesting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                    Ingesting...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    <span className="hidden lg:inline">Ingest Material</span>
                    <span className="lg:hidden">Ingest</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <MobileTabs />
        </header>

        <main className={`flex-1 min-h-0 relative ${leftCollapsed && rightCollapsed ? 'lg:grid-cols-[56px_1fr_56px]' :
          leftCollapsed ? 'lg:grid-cols-[56px_1fr_280px]' :
            rightCollapsed ? 'lg:grid-cols-[280px_1fr_56px]' :
              'lg:grid-cols-[280px_1fr_280px]'
          } lg:grid gap-0 lg:gap-4 p-0 lg:p-4 overflow-hidden`}>
          {/* Sources Panel - Visible if tab is 'sources' OR on Desktop */}
          <section className={`h-full min-h-0 ${mobileTab === 'sources' ? 'block' : 'hidden'} lg:block`}>
            <AnimatedBorder className="h-full">
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FolderPlus className="h-5 w-5 text-emerald-400" />
                    {!leftCollapsed && <span className="text-sm font-semibold">Sources</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeftCollapsed(v => !v)}
                    className="rounded p-1 text-slate-400 hover:text-emerald-300"
                    title={leftCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {leftCollapsed ? <PanelLeftClose size={16} /> : <PanelLeftClose size={16} />}
                  </button>
                </div>
                {!leftCollapsed && (
                  <div className="flex flex-1 min-h-0 flex-col px-3 pb-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-slate-300/80">Active: {notebooks.find(n => n.id === activeNotebookId)?.name || '—'}</span>
                      <button
                        type="button"
                        onClick={() => setShowSourceUpload(true)}
                        className="rounded-[10px] border border-blue-400/70 bg-blue-500/15 px-[14px] py-1 text-xs text-blue-200 hover:bg-blue-500/25 transition-colors"
                      >
                        Manage Sources
                      </button>
                    </div>
                    <div className="sources-content flex-1 min-h-0 overflow-y-auto">
                      <SourceList sources={sources} onRemove={async (id) => { try { await removeSource(id); await loadSources(); await loadStats(); showToast('Source removed'); } catch (e) { handleError(e.message); } }} />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-300/70">
                      {sourceCount} sources
                    </div>
                  </div>
                )}
              </div>
            </AnimatedBorder>
          </section>
          {/* Main Content Area - Visible if tab is 'chat' or 'studio' OR on Desktop */}
          <section className={`h-full min-h-0 ${(mobileTab === 'chat' || mobileTab === 'studio') ? 'block' : 'hidden'} lg:block flex flex-col`}>
            {/* Mobile Studio Mode Switcher */}
            {mobileTab === 'studio' && (
              <div className="flex items-center justify-center gap-2 border-b border-white/5 bg-slate-900/50 p-2 lg:hidden">
                <button
                  onClick={() => setMode('summary')}
                  className={`flex items-center justify-center gap-2 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'summary' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <FileText size={14} />
                  Slides
                </button>
                <button
                  onClick={() => setMode('voice')}
                  className={`flex items-center justify-center gap-2 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'voice' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <Waves size={14} />
                  Voice
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 h-full">
              {renderMode()}
            </div>
          </section>
          {/* Modes Panel - HIDDEN on mobile, visible ONLY on Desktop */}
          <section className="hidden lg:block h-full min-h-0">
            <AnimatedBorder className="h-full">
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-emerald-400" />
                    {!rightCollapsed && <span className="text-sm font-semibold">Modes</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRightCollapsed(v => !v)}
                    className="rounded p-1 text-slate-400 hover:text-emerald-300"
                    title={rightCollapsed ? 'Expand' : 'Collapse'}
                  >
                    <PanelRightClose size={16} />
                  </button>
                </div>
                {rightCollapsed && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-1 py-2">
                    <button
                      type="button"
                      onClick={() => setMode('qa')}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${mode === 'qa' ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-600/60 bg-slate-900/60 hover:border-emerald-400/60'}`}
                      title="Q&A"
                    >
                      <MessageCircleMore size={16} className="text-emerald-300" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('voice')}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${mode === 'voice' ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-600/60 bg-slate-900/60 hover:border-emerald-400/60'}`}
                      title="Voice"
                    >
                      <Waves size={16} className="text-emerald-300" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('summary')}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${mode === 'summary' ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-600/60 bg-slate-900/60 hover:border-emerald-400/60'}`}
                      title="Slides"
                    >
                      <FileText size={16} className="text-emerald-300" />
                    </button>
                  </div>
                )}
                {!rightCollapsed && (
                  <div className="flex flex-1 flex-col gap-2 px-3 pb-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setMode('qa')}
                        className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-1.5 text-left transition-all ${mode === 'qa'
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
                        className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-1.5 text-left transition-all ${mode === 'voice'
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
                        className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-1.5 text-left transition-all ${mode === 'summary'
                          ? 'border-emerald-400/70 bg-emerald-500/15'
                          : 'border-slate-600/60 bg-slate-900/60 hover:border-emerald-400/60'
                          }`}
                      >
                        <FileText size={16} className="text-emerald-300" />
                        <span>Slides</span>
                        <span className="text-[10px] text-slate-300/80">Exam view</span>
                      </button>
                    </div>
                    <GlassCard hover={false} className="bg-slate-900/50 text-xs leading-relaxed">
                      <h3 className="mb-2 text-sm font-semibold text-emerald-300">
                        Grounding contract
                      </h3>
                      <p className="mb-1 text-slate-200/90">
                        Every AI response is constrained to the ingested study material.
                      </p>
                      <p className="mb-1 text-slate-300/80">
                        If a concept is not covered there, the tutor explicitly says:
                      </p>
                      <p className="mb-2 italic text-emerald-200">
                        &quot;I don&apos;t have information about this topic in the provided study
                        material.&quot;
                      </p>
                    </GlassCard>
                  </div>
                )}
              </div>
            </AnimatedBorder>
          </section>
        </main>
      </div>
      <ToastContainer />
      {showSourceUpload && (
        <SourceUpload
          onClose={() => setShowSourceUpload(false)}
          onSourcesUpdated={async () => { await loadSources(); await loadStats(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default Dashboard;
