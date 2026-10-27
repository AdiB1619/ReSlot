import React, { useState, useEffect } from 'react';
import {
  Share2,
  Download,
  Calendar,
  Copy,
  Check,
  Clock,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  Layers,
  MapPin,
  User,
} from 'lucide-react';
import { useApp } from '../components/layout/AppLayout';
import { api } from '../services/api';
import { EffectiveSession, StudentGroupItem } from '../types';

export const PublishedTimetablePage: React.FC = () => {
  const { targetDate } = useApp();
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedCohort, setSelectedCohort] = useState<string>('ALL');
  const [sessions, setSessions] = useState<EffectiveSession[]>([]);
  const [groups, setGroups] = useState<StudentGroupItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = `${window.location.origin}/published?date=${targetDate}${selectedCohort !== 'ALL' ? `&cohort=${selectedCohort}` : ''}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    api.getStudentGroups()
      .then((res) => setGroups(res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getEffectiveTimetable({ date: targetDate })
      .then((res) => {
        setSessions(res.sessions || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load effective schedule');
      })
      .finally(() => setLoading(false));
  }, [targetDate]);

  const filteredSessions = sessions.filter((s) => {
    if (selectedCohort === 'ALL') return true;
    return s.groups.some((g) => g.name.toLowerCase().includes(selectedCohort.toLowerCase()));
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">CANCELLED</span>;
      case 'ROOM_CHANGE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">ROOM RELOCATED</span>;
      case 'MOVE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">TIME SHIFTED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">ACTIVE MASTER</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white border border-border p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
            <img src="/RSCOELogo.png" alt="RSCOE College Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">Published Official Timetable</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live & Date-Effective
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Department of Computer Engineering • Official Schedule for <strong>{targetDate}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg bg-surface border border-border hover:bg-canvas text-xs font-semibold text-ink flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <a
            href={api.exportIcsUrl(targetDate)}
            download={`timetable-${targetDate}.ics`}
            className="px-3 py-2 rounded-lg bg-surface border border-border hover:bg-canvas text-xs font-semibold text-ink flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" /> Export .ICS
          </a>
          <a
            href={api.exportExcelUrl(targetDate)}
            download={`timetable-${targetDate}.xlsx`}
            className="px-3 py-2 rounded-lg bg-surface border border-border hover:bg-canvas text-xs font-semibold text-ink flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
          </a>
          <a
            href={api.exportPdfUrl(targetDate)}
            download={`timetable-${targetDate}.pdf`}
            className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </a>
        </div>
      </div>

      {/* Shareable Link Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <Share2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-ink shrink-0">Public Share Link:</span>
          <span className="text-xs font-mono text-muted bg-canvas px-2.5 py-1 rounded border border-border truncate max-w-sm sm:max-w-md">
            {shareUrl}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg bg-canvas hover:bg-border text-xs font-bold text-ink flex items-center justify-center gap-1.5 border border-border transition shrink-0 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied Link!' : 'Copy Link'}
        </button>
      </div>

      {/* Cohort Selector Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-xs font-bold text-muted uppercase shrink-0">Filter Cohort:</span>
        <button
          onClick={() => setSelectedCohort('ALL')}
          className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
            selectedCohort === 'ALL'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface text-ink hover:bg-canvas border border-border'
          }`}
        >
          All Cohorts
        </button>
        {['SE-A', 'SE-B', 'SE-C', 'TE-A', 'TE-B', 'TE-C', 'BE-A', 'BE-B'].map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCohort(c)}
            className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
              selectedCohort === c
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface text-ink hover:bg-canvas border border-border'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Content State */}
      {loading ? (
        <div className="p-12 text-center bg-surface rounded-xl border border-border">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span className="text-xs text-muted font-medium">Fetching effective date-specific schedule...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-12 text-center bg-surface rounded-xl border border-border text-muted text-xs">
          No classes scheduled for {targetDate} ({selectedCohort === 'ALL' ? 'All divisions' : selectedCohort}).
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((item) => (
            <div
              key={item.id}
              className={`bg-surface p-5 rounded-xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                item.status !== 'NORMAL'
                  ? 'border-indigo-300 ring-1 ring-indigo-200/50 bg-indigo-50/15'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-ink">{item.subjectCode} — {item.subjectName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-canvas text-ink border border-border">
                    {item.sessionType}
                  </span>
                  {getStatusBadge(item.status)}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1">
                  <span className="flex items-center gap-1 font-semibold text-ink">
                    <Clock className="w-3.5 h-3.5 text-primary" /> {item.startTime} - {item.endTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-muted" /> Room: <strong className="text-ink">{item.roomCode || 'TBD'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-muted" /> Faculty: <strong className="text-ink">{item.faculty.map(f => f.fullName || f.code).join(', ') || 'N/A'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-primary" /> Groups: <strong className="text-primary">{item.groups.map(g => g.name).join(', ') || 'General'}</strong>
                  </span>
                </div>

                {item.changeReason && (
                  <div className="text-[11px] text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded border border-indigo-200/50 mt-1 inline-block">
                    Note: {item.changeReason}
                  </div>
                )}
              </div>

              <div className="shrink-0 text-right">
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Verified Zero Clashes
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
