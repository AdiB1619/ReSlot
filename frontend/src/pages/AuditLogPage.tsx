import React, { useEffect, useState } from 'react';
import { FileText, Search, ShieldCheck, Filter } from 'lucide-react';
import { api } from '../services/api';
import { AuditLogItem } from '../types';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await api.getAuditLogs();
    setLogs(data);
  }

  const filtered = logs.filter((l) => {
    if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        l.actor.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.detail && l.detail.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('APPROVED')) return 'bg-emerald-100 text-emerald-800';
    if (action.includes('PUBLISHED')) return 'bg-blue-100 text-blue-800';
    if (action.includes('REJECTED')) return 'bg-rose-100 text-rose-800';
    if (action.includes('SOLVER')) return 'bg-purple-100 text-purple-800';
    if (action.includes('DISRUPTION')) return 'bg-amber-100 text-amber-800';
    return 'bg-canvas text-ink';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-ink">Immutable Audit Trail</h2>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Append-Only
          </span>
        </div>
        <p className="text-xs text-muted mt-1">
          Cryptographically auditable record of all master uploads, disruptions, solver runs, approvals, and publish events.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted">Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-canvas border border-border rounded-lg text-ink font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Actions</option>
            <option value="SOLVER_RUN">SOLVER_RUN</option>
            <option value="PLAN_APPROVED">PLAN_APPROVED</option>
            <option value="PLAN_PUBLISHED">PLAN_PUBLISHED</option>
            <option value="PLAN_REJECTED">PLAN_REJECTED</option>
            <option value="DISRUPTION_CREATED">DISRUPTION_CREATED</option>
            <option value="ROOM_RULE_CREATED">ROOM_RULE_CREATED</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search actor, entity, note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-canvas border border-border rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-canvas border-b border-border text-muted uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Target</th>
                <th className="px-4 py-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-canvas/30 transition">
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">{item.at}</td>
                  <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">{item.actor}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getActionBadge(item.action)}`}>
                      {item.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted">{item.entity}</td>
                  <td className="px-4 py-3 text-ink/90 max-w-md">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
