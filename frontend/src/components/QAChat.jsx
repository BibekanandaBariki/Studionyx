import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClipboardCopy, CornerDownLeft, RefreshCw, Trash2, ChevronDown, ChevronUp, FileText, FolderPlus } from 'lucide-react';
import GlassCard from './GlassCard.jsx';
import AnimatedBorder from './AnimatedBorder.jsx';
import LoadingState from './LoadingState.jsx';
import { askQuestion } from '../utils/api.js';

const CollapsibleQuestions = ({ title, questions, onQuestionClick }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden transition-all duration-300">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <p className="text-xs font-semibold text-emerald-300/90 uppercase tracking-wider flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
          {title}
        </p>
        <button
          className="text-slate-400 hover:text-emerald-300 transition-colors"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3 pt-1 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onQuestionClick(q);
                  setCollapsed(true); // Auto-collapse on click
                }}
                className="group w-full text-left rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 text-xs text-slate-300 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-all flex items-start gap-2"
              >
                <span className="mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity">→</span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const QAChat = ({ onError, suggestedQuestions = [], loadingSuggestions = false, onSuggestionClick, onRequestMoreSuggestions }) => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState([]);

  const activeSuggestions = suggestedQuestions.filter(q => !usedQuestions.includes(q));

  // Debug logging
  useEffect(() => {
    console.log('[QAChat] Suggested questions updated:', suggestedQuestions);
    console.log('[QAChat] Active suggestions:', activeSuggestions);
    console.log('[QAChat] Loading suggestions:', loadingSuggestions);
  }, [suggestedQuestions, loadingSuggestions]);

  const handleAsk = async (questionOverride) => {
    const textToAsk = typeof questionOverride === 'string' ? questionOverride : question;
    const trimmed = textToAsk.trim();
    if (!trimmed) return;

    setLoading(true);
    setQuestion('');

    let isSuggestion = false;
    // Mark as used if it matches a suggestion
    if (suggestedQuestions.includes(trimmed)) {
      isSuggestion = true;
      setUsedQuestions(prev => {
        const next = [...prev, trimmed];
        // Check if we exhausted all suggestions
        const remaining = suggestedQuestions.filter(q => !next.includes(q));
        if (remaining.length === 0) {
          // Trigger fetch for more suggestions
          onRequestMoreSuggestions?.();
        }
        return next;
      });
    }

    try {
      const userMessage = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMessage]);

      const res = await askQuestion(trimmed);
      const aiMessage = {
        role: 'assistant',
        content: res.answer,
        meta: {
          isGrounded: res.isGrounded,
          sources: res.sources,
        },
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (q) => {
    handleAsk(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleCopyLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;
    await navigator.clipboard.writeText(last.content);
  };

  const handleRegenerate = async () => {
    const lastQuestion = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastQuestion) return;
    setQuestion(lastQuestion.content);
    await handleAsk();
  };

  const handleClear = () => {
    setMessages([]);
    setUsedQuestions([]);
  };

  return (
    <AnimatedBorder className="h-full">
      <div className="flex h-full flex-col p-2 md:p-6">
        <div className="mb-1 md:mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-coolwhite">Grounded Q&amp;A</h2>
            <p className="hidden md:block text-xs text-slate-300/70">
              Answers are strictly limited to the ingested textbook chapter and videos.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-300">
            <span className="hidden md:inline-flex items-center rounded-full border border-emerald-400/40 px-2 py-0.5 bg-emerald-600/10">
              100% grounded
            </span>
            {/* Context Indicator */}
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              <span className="hidden sm:inline">Active</span>
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-full border border-slate-600/60 px-2 py-1 text-slate-400 hover:border-red-400/70 hover:text-red-300 transition-colors"
              title="Clear chat"
            >
              <Trash2 size={12} />
              <span className="hidden md:inline">Clear</span>
            </button>
          </div>
        </div>

        <GlassCard className="flex-1 min-h-0 bg-slate-900/40">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto space-y-4">
              {messages.length === 0 && !loading && (
                <div className="empty-state flex flex-col items-center justify-center py-4 md:py-12 opacity-80 text-center px-4 animate-fade-up">
                  <div className="mb-4 rounded-full bg-slate-800/50 p-4 ring-1 ring-white/5">
                    <FileText className="h-8 w-8 text-emerald-400/80" />
                  </div>
                  <h3 className="mb-2 text-sm font-medium text-coolwhite">No study material added</h3>
                  <p className="mb-6 max-w-[240px] text-xs text-slate-400">
                    Add PDFs, text, or YouTube links to enable grounded answers.
                  </p>
                  <button
                    type="button"
                    onClick={() => document.querySelector('button[title="Ingest Material"]')?.click() ?? document.querySelector('button > svg.lucide-file-text')?.parentElement?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-900 transition-transform active:scale-95"
                  >
                    <FolderPlus size={16} />
                    Add Material
                  </button>
                </div>
              )}

              {messages.map((m, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={index} className="flex flex-col gap-1 animate-fade-up">
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user'
                      ? 'ml-auto bg-emerald-500/90 text-slate-900'
                      : 'mr-auto bg-slate-800/80 text-slate-50'
                      }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ node, ...props }) => <h2 className="text-emerald-300 font-bold text-base mt-3 mb-2 first:mt-0" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-emerald-200 font-semibold text-sm mt-2 mb-1" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                        blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-emerald-500/50 pl-3 italic my-2 text-slate-300" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-emerald-100" {...props} />,
                        a: ({ node, ...props }) => <a className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer" {...props} />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                  {m.role === 'assistant' && m.meta && (
                    <div className="ml-1 flex items-center gap-2 text-[10px] text-slate-300/70">
                      <span
                        className={`rounded-full border px-2 py-0.5 ${m.meta.isGrounded
                          ? 'border-emerald-400/60 text-emerald-300'
                          : 'border-amber-400/60 text-amber-300'
                          }`}
                      >
                        {m.meta.isGrounded ? 'Grounded in material' : 'Not clearly grounded'}
                      </span>
                      {m.meta.sources && (
                        <span className="truncate">
                          Sources: {m.meta.sources.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {loading && <LoadingState lines={4} />}

              <div className="pt-2">
                {loadingSuggestions && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 px-1">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                    <span>Loading suggested questions...</span>
                  </div>
                )}
                {!loadingSuggestions && activeSuggestions.length > 0 && !loading && (
                  <CollapsibleQuestions
                    title={messages.length === 0 ? 'Suggested Questions' : 'Related Questions'}
                    questions={activeSuggestions}
                    onQuestionClick={handleSuggestionClick}
                  />
                )}
              </div>
            </div>

          </div>
        </GlassCard>

        <div className="sticky bottom-0 z-10 -mx-3 -mb-3 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pb-3 pt-6 px-3 md:static md:mx-0 md:mb-0 md:bg-none md:pb-0 md:pt-4 md:px-0">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2 px-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
            <span className="opacity-70">
              Grounded mode active
            </span>
          </div>
          <div className="flex items-end gap-2 rounded-2xl bg-slate-900/80 p-1.5 ring-1 ring-white/10 backdrop-blur-xl md:bg-transparent md:ring-0 md:backdrop-filter-none md:p-0">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-coolwhite placeholder-slate-500 outline-none md:rounded-2xl md:border md:border-slate-600/60 md:bg-slate-900/70 md:focus:border-emerald-500/70 md:focus:ring-1 md:focus:ring-emerald-500/40"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-900 shadow-lg transition-all hover:bg-emerald-400 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100 disabled:bg-slate-700 disabled:text-slate-500"
            >
              <CornerDownLeft size={18} />
            </button>
          </div>
        </div>
        {messages.length > 0 && (
          <div className="flex items-center justify-end gap-2 text-[11px] text-slate-300/80">
            <button
              type="button"
              onClick={handleCopyLast}
              className="inline-flex items-center gap-1 rounded-full border border-slate-600/60 px-2 py-1 hover:border-emerald-400/70 hover:text-emerald-300 transition-colors"
            >
              <ClipboardCopy size={12} />
              Copy answer
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1 rounded-full border border-slate-600/60 px-2 py-1 hover:border-emerald-400/70 hover:text-emerald-300 transition-colors"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </AnimatedBorder>
  );
};

export default QAChat;
