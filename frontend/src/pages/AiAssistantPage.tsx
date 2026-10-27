import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Send,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../components/layout/AppLayout';

export const AiAssistantPage: React.FC = () => {
  const { aiMessages, setAiMessages, resetAiMessages } = useApp();
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const samplePrompts = [
    'Find a free lab for SE-B on Thursday 09:00 - 11:00',
    'Suggest a substitute faculty for Prof. SW on leave',
    'Can we use Classroom A-216 for a practical session?',
    'Explain why 2 baseline clashes are accepted in master timetable',
    'Which labs have open capacity for 30 students today?',
  ];

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim()) return;

    setAiMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setQuery('');
    setIsLoading(true);

    try {
      const res = await api.askAi(q);
      setAiMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer,
          recs: res.recommendations,
          actions: res.suggestedActions,
          mode: res.mode,
        },
      ]);
    } catch (e: any) {
      setAiMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Error contacting AI Service: ' + (e.response?.data?.message || e.message) + '. Please check that your Gemini API key is configured in the backend environment.',
          mode: 'ERROR',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">AI Rescheduling Assistant</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
              Propose-Only Engine
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Gemini AI Connected
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Intelligent timetable advisor trained on department constraints, syllabus groupings, and room capacities.
          </p>
        </div>

        {aiMessages.length > 1 && (
          <button
            type="button"
            onClick={resetAiMessages}
            title="Reset conversation back to welcome prompt"
            className="self-start sm:self-auto px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-canvas text-xs font-medium text-muted hover:text-ink flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        )}
      </div>

      {/* Propose-Only Safety Banner */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <div>
          <span className="font-bold">Strict Safety Rule:</span> The AI assistant operates in <strong>propose-only</strong> mode. It cannot modify, delete, or write timetable sessions directly. All changes must be executed through the solver and verified by the Coordinator.
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="bg-surface rounded-xl border border-border p-5 shadow-xs min-h-[420px] max-h-[550px] overflow-y-auto space-y-4">
        {aiMessages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 text-xs ${
              m.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.sender === 'ai' && (
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={`p-4 rounded-xl max-w-xl space-y-2 leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-primary text-white font-medium rounded-tr-none'
                  : 'bg-canvas border border-border text-ink rounded-tl-none'
              }`}
            >
              {m.sender === 'ai' && m.mode && (
                <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-border/50 text-[10px] font-semibold text-muted">
                  {m.mode.includes('GEMINI') ? (
                    <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                      ✨ Gemini AI Powered
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      💡 Propose-Only Assistant
                    </span>
                  )}
                </div>
              )}

              {m.sender === 'user' ? (
                <div className="whitespace-pre-wrap">{m.text}</div>
              ) : (
                <div className="text-xs text-ink space-y-2 leading-relaxed">
                  <ReactMarkdown
                    components={{
                      h1: ({ ...props }) => <h3 className="text-sm font-bold text-ink mt-2 mb-1 border-b border-border/50 pb-1" {...props} />,
                      h2: ({ ...props }) => <h4 className="text-xs font-bold text-ink mt-2 mb-1" {...props} />,
                      h3: ({ ...props }) => <h5 className="text-xs font-bold text-primary mt-2 mb-1 flex items-center gap-1.5" {...props} />,
                      h4: ({ ...props }) => <h6 className="text-[11px] font-bold text-ink mt-1.5 mb-0.5" {...props} />,
                      p: ({ ...props }) => <p className="mb-2 leading-relaxed text-xs text-ink/90 last:mb-0" {...props} />,
                      ul: ({ ...props }) => <ul className="list-disc pl-4 space-y-1 my-1.5 text-xs text-ink/90" {...props} />,
                      ol: ({ ...props }) => <ol className="list-decimal pl-4 space-y-1 my-1.5 text-xs text-ink/90" {...props} />,
                      li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                      strong: ({ ...props }) => <strong className="font-bold text-ink" {...props} />,
                      em: ({ ...props }) => <em className="italic text-muted" {...props} />,
                      code: ({ ...props }) => <code className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[11px] text-primary font-semibold" {...props} />,
                      blockquote: ({ ...props }) => <blockquote className="border-l-2 border-primary pl-2.5 my-1.5 text-muted italic text-[11px]" {...props} />,
                      hr: ({ ...props }) => <hr className="my-2 border-border/60" {...props} />,
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                </div>
              )}

              {m.recs && m.recs.length > 0 && (
                <div className="pt-2 border-t border-black/10 space-y-1">
                  <span className="font-bold text-[11px] uppercase tracking-wide opacity-80">
                    Recommendations:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {m.recs.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {m.actions && m.actions.length > 0 && (
                <div className="pt-2 border-t border-black/10 flex flex-wrap gap-2">
                  {m.actions.map((act, aIdx) => (
                    <NavLink
                      key={aIdx}
                      to={act.includes('Plan') ? '/plans' : act.includes('Room') ? '/rules' : act.includes('Disruption') ? '/disruptions' : '/timetable'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-primary border border-primary-border font-bold text-[11px] shadow-2xs hover:bg-primary-tint"
                    >
                      {act} <ArrowRight className="w-3 h-3" />
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted italic">
            <Sparkles className="w-4 h-4 animate-spin text-primary" />
            Analyzing schedule constraints and checking room availability...
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-muted">Quick Queries:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="px-2.5 py-1 rounded-full bg-surface border border-border hover:border-primary text-ink hover:text-primary text-[11px] font-medium transition"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Query Input Box */}
      <div className="relative">
        <input
          type="text"
          placeholder="Ask AI Assistant about timetable schedules, faculty swaps, or room availability..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="w-full pl-4 pr-12 py-3 bg-surface border border-border rounded-xl text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
        />
        <button
          onClick={() => handleSend()}
          disabled={!query.trim() || isLoading}
          className="absolute right-2 top-2 p-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-lg transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};


