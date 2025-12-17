import { useState } from 'react';
import { ClipboardCopy, CornerDownLeft, RefreshCw, Trash2 } from 'lucide-react';
import GlassCard from './GlassCard.jsx';
import AnimatedBorder from './AnimatedBorder.jsx';
import LoadingState from './LoadingState.jsx';
import { askQuestion } from '../utils/api.js';

const QAChat = ({ onError, suggestedQuestions = [], onSuggestionClick, onRequestMoreSuggestions }) => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState([]);

  const activeSuggestions = suggestedQuestions.filter(q => !usedQuestions.includes(q));

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
      <div className="flex h-full flex-col p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-coolwhite">Grounded Q&amp;A</h2>
            <p className="text-xs text-slate-300/70">
              Answers are strictly limited to the ingested textbook chapter and videos.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-300">
            <span className="inline-flex items-center rounded-full border border-emerald-400/40 px-2 py-0.5 bg-emerald-600/10">
              100% grounded
            </span>
          </div>
        </div>

        <GlassCard className="flex-1 min-h-[220px] overflow-y-auto bg-slate-900/40">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-slate-300/80 mb-6">
              Ask anything about the uploaded economics chapter or the two lecture videos. The AI
              will only answer using that material.
            </p>
          )}

          <div className="space-y-4">
            {messages.map((m, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="flex flex-col gap-1">
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user'
                    ? 'ml-auto bg-emerald-500/90 text-slate-900'
                    : 'mr-auto bg-slate-800/80 text-slate-50'
                    }`}
                >
                  {m.content}
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

            {/* Suggested Questions - Always visible if there are active ones */}
            {activeSuggestions.length > 0 && !loading && (
              <div className="pt-4 space-y-2">
                <p className="text-xs font-medium text-emerald-300/80 uppercase tracking-wider">
                  {messages.length === 0 ? 'Suggested Questions' : 'Related Questions'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSuggestions.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSuggestionClick(q)}
                      className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft" />
            <span>
              If the concept is not in the material, you&apos;ll see:
              &nbsp;
              <span className="italic">
                &quot;I don&apos;t have information about this topic in the provided study
                material.&quot;
              </span>
            </span>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a grounded economics question…"
              className="flex-1 resize-none rounded-2xl border border-slate-600/60 bg-slate-900/70 px-3 py-2 text-sm text-coolwhite outline-none ring-emerald-500/40 focus:border-emerald-500/70 focus:ring"
              rows={2}
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={loading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-slate-900 shadow-lg hover:bg-emerald-400 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-70 transition-transform hover:-translate-y-0.5"
            >
              <CornerDownLeft size={18} />
            </button>
          </div>
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
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-full border border-slate-600/60 px-2 py-1 hover:border-red-400/70 hover:text-red-300 transition-colors"
            >
              <Trash2 size={12} />
              Clear chat
            </button>
          </div>
        </div>
      </div>
    </AnimatedBorder>
  );
};

export default QAChat;



