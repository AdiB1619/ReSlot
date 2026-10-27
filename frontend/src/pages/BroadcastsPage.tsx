import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Copy,
  Check,
  Send,
  ExternalLink,
  Search,
  Filter,
  Users,
  UserCheck,
  Building,
  RefreshCw,
  Sparkles,
  Share2,
  Trash2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useApp } from '../components/layout/AppLayout';
import { api } from '../services/api';
import { BroadcastDraft } from '../types';

export const BroadcastsPage: React.FC = () => {
  const { targetDate } = useApp();
  const [searchParams] = useSearchParams();
  const effectiveDate = searchParams.get('date') || targetDate;

  const [drafts, setDrafts] = useState<BroadcastDraft[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DEPARTMENT_MASTER' | 'FACULTY' | 'STUDENT_GROUP'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, [effectiveDate]);

  async function loadDrafts() {
    setLoading(true);
    try {
      const data = await api.getBroadcastDrafts(effectiveDate);
      setDrafts(data);
    } catch (err) {
      console.error('Failed to load broadcast drafts', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleCopyAll = async () => {
    const fullText = filteredDrafts
      .map((d) => `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 ${getTitle(d)}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${getMessage(d)}\n`)
      .join('\n\n');
    await navigator.clipboard.writeText(fullText);
    setCopiedId('ALL');
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleClearAllBroadcasts = async () => {
    setIsClearing(true);
    try {
      await api.resetDay(effectiveDate);
      setFeedbackMsg(`Schedule Normalized! All venue reallocations and broadcast notices for ${effectiveDate} have been cleared. Running active Master Timetable.`);
      await loadDrafts();
    } catch (err: any) {
      alert('Failed to clear broadcasts: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsClearing(false);
    }
  };

  const handleOpenWhatsApp = (phone: string | undefined, message: string) => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const getCategory = (d: any) => d.category || d.type || 'FACULTY';
  const getTitle = (d: any) => d.recipientTitle || d.title || 'Notice';
  const getSubtitle = (d: any) => d.recipientSubtitle || d.subtitle || '';
  const getMessage = (d: any) => d.messageText || d.message || '';

  const filteredDrafts = useMemo(() => {
    return drafts.filter((d: any) => {
      const cat = getCategory(d);
      if (activeTab !== 'ALL' && cat !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          getTitle(d).toLowerCase().includes(q) ||
          getSubtitle(d).toLowerCase().includes(q) ||
          getMessage(d).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [drafts, activeTab, searchQuery]);

  const facultyCount = drafts.filter((d: any) => getCategory(d) === 'FACULTY').length;
  const groupCount = drafts.filter((d: any) => getCategory(d) === 'STUDENT_GROUP').length;
  const masterCount = drafts.filter((d: any) => getCategory(d) === 'DEPARTMENT_MASTER').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">WhatsApp Broadcast Drafts</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Target: {effectiveDate}
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Pre-formatted messages drafted for affected faculties, student classes/divisions, and the department master circular. Copy with one click or open directly in WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDrafts}
            className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-ink bg-surface hover:bg-canvas flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {drafts.length > 0 && (
            <>
              <button
                onClick={handleClearAllBroadcasts}
                disabled={isClearing}
                className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Clear all broadcast messages and reset day schedule to normal"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isClearing ? 'Clearing...' : 'Clear All Broadcasts'}
              </button>

              <button
                onClick={handleCopyAll}
                className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover flex items-center gap-2 shadow-xs transition-colors"
              >
                {copiedId === 'ALL' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    All Messages Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy All ({filteredDrafts.length})
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Tab Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-primary text-white shadow-xs font-semibold'
                  : 'bg-canvas text-ink hover:bg-surface border border-border'
              }`}
            >
              All Notices ({drafts.length})
            </button>

            <button
              onClick={() => setActiveTab('DEPARTMENT_MASTER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'DEPARTMENT_MASTER'
                  ? 'bg-primary text-white shadow-xs font-semibold'
                  : 'bg-canvas text-ink hover:bg-surface border border-border'
              }`}
            >
              Master Bulletin ({masterCount})
            </button>

            <button
              onClick={() => setActiveTab('FACULTY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'FACULTY'
                  ? 'bg-primary text-white shadow-xs font-semibold'
                  : 'bg-canvas text-ink hover:bg-surface border border-border'
              }`}
            >
              Faculty Notices ({facultyCount})
            </button>

            <button
              onClick={() => setActiveTab('STUDENT_GROUP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'STUDENT_GROUP'
                  ? 'bg-primary text-white shadow-xs font-semibold'
                  : 'bg-canvas text-ink hover:bg-surface border border-border'
              }`}
            >
              Class & Batch Notices ({groupCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search faculty, class, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-primary w-56"
            />
          </div>
        </div>
      </div>

      {/* Draft Messages List */}
      {loading ? (
        <div className="p-12 text-center text-sm text-muted">Loading WhatsApp broadcast drafts...</div>
      ) : filteredDrafts.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-ink">Master Timetable Fully Normalized for {effectiveDate}</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            Zero active disruptions or venue reallocations. All lectures, labs, and faculty are running on the standard active master schedule with zero broadcast notices needed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDrafts.map((draft: any) => {
            const isCopied = copiedId === draft.id;
            const category = getCategory(draft);
            const title = getTitle(draft);
            const subtitle = getSubtitle(draft);
            const message = getMessage(draft);

            const isFaculty = category === 'FACULTY';
            const isMaster = category === 'DEPARTMENT_MASTER';

            return (
              <div
                key={draft.id}
                className={`bg-surface border rounded-xl overflow-hidden shadow-xs flex flex-col justify-between transition-all hover:shadow-sm ${
                  isMaster
                    ? 'border-primary/40 ring-1 ring-primary/20 lg:col-span-2'
                    : isFaculty
                    ? 'border-indigo-200'
                    : 'border-emerald-200'
                }`}
              >
                {/* Card Header */}
                <div
                  className={`p-4 border-b flex items-start justify-between ${
                    isMaster
                      ? 'bg-primary-tint/40 border-primary/20'
                      : isFaculty
                      ? 'bg-indigo-50/40 border-indigo-100'
                      : 'bg-emerald-50/40 border-emerald-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isMaster
                          ? 'bg-primary text-white font-bold'
                          : isFaculty
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isMaster ? (
                        <Building className="w-4 h-4" />
                      ) : isFaculty ? (
                        <UserCheck className="w-4 h-4" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{title}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isMaster
                              ? 'bg-primary/10 text-primary'
                              : isFaculty
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isMaster ? 'Master Bulletin' : isFaculty ? 'Faculty' : 'Class Cohort'}
                        </span>
                      </div>
                      <div className="text-xs text-muted mt-0.5">{subtitle}</div>
                    </div>
                  </div>

                  {draft.phone && (
                    <span className="text-[11px] font-mono text-muted bg-white/80 px-2 py-0.5 rounded border border-border">
                      {draft.phone}
                    </span>
                  )}
                </div>

                {/* Card Body - WhatsApp Message Preview */}
                <div className="p-4 flex-1">
                  <div className="bg-[#ECE5DD]/40 border border-border/80 rounded-lg p-3.5 font-mono text-xs text-ink whitespace-pre-wrap leading-relaxed select-all">
                    {message}
                  </div>
                </div>

                {/* Card Footer - Action Buttons */}
                <div className="p-3 bg-canvas/40 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <Share2 className="w-3 h-3 text-muted" />
                    Ready for WhatsApp / Telegram
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyMessage(draft.id, message)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-surface text-ink hover:bg-canvas border border-border'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Message
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenWhatsApp(draft.phone, message)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
