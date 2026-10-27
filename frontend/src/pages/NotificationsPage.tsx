import React, { useEffect, useState } from 'react';
import {
  CheckCheck,
  Check,
  Clock,
  Smartphone,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationJob } from '../types';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await api.getNotifications();
    setNotifications(data);
  }

  const handleDispatch = async () => {
    setIsDispatching(true);
    await api.dispatchNotifications();
    setTimeout(async () => {
      await loadData();
      setIsDispatching(false);
    }, 800);
  };

  const filtered = notifications.filter((n) => {
    if (statusFilter !== 'ALL' && n.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (n.facultyName && n.facultyName.toLowerCase().includes(q)) ||
        (n.groupName && n.groupName.toLowerCase().includes(q)) ||
        n.message.toLowerCase().includes(q) ||
        (n.facultyPhone && n.facultyPhone.includes(q));
      if (!match) return false;
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'READ':
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'DELIVERED':
        return <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />;
      case 'SENT':
        return <Check className="w-3.5 h-3.5 text-muted" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">WhatsApp Notification Outbox</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Cloud API Active
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Personalized WhatsApp notification log dispatched to faculty members and student class representatives.
          </p>
        </div>

        <button
          onClick={handleDispatch}
          disabled={isDispatching}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isDispatching ? 'animate-spin' : ''}`} />
          {isDispatching ? 'Dispatching Queue...' : 'Trigger Outbox Dispatch'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {['ALL', 'READ', 'DELIVERED', 'SENT', 'PENDING'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                statusFilter === s
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-canvas text-ink hover:bg-border border border-border'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search recipient or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-canvas border border-border rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Outbox Cards List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-surface p-12 text-center rounded-xl border border-border text-muted text-xs">
            No notifications found matching filter criteria.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-surface p-5 rounded-xl border border-border shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-ink flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    Recipient: {item.facultyName ? `Prof. ${item.facultyName}` : `Group: ${item.groupName}`}
                  </span>
                  {item.facultyPhone && (
                    <span className="font-mono text-muted text-[11px] bg-canvas px-1.5 py-0.5 rounded border border-border">
                      {item.facultyPhone}
                    </span>
                  )}
                  <span className="text-[10px] text-muted font-mono bg-canvas px-1.5 py-0.5 rounded">
                    Dedupe: {item.dedupeKey}
                  </span>
                </div>

                {/* WhatsApp Message Preview Bubble */}
                <div className="p-3.5 rounded-xl bg-[#DCF8C6]/50 border border-[#b2e297] text-xs text-ink font-sans leading-relaxed whitespace-pre-wrap max-w-2xl shadow-2xs">
                  {item.message}
                </div>
              </div>

              {/* Status Column */}
              <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-2 text-right">
                <div className="flex items-center gap-1 text-xs font-bold text-ink">
                  {getStatusIcon(item.status)}
                  <span
                    className={
                      item.status === 'READ'
                        ? 'text-blue-600'
                        : item.status === 'DELIVERED'
                        ? 'text-emerald-700'
                        : 'text-muted'
                    }
                  >
                    {item.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted">
                  {item.sentAt ? `Dispatched: ${new Date(item.sentAt).toLocaleTimeString()}` : 'Queued'}
                </div>
                <span className="text-[10px] text-muted">Attempts: {item.attempts}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
