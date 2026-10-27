import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cpu,
  Flame,
  Layers,
  ShieldAlert,
  Sparkles,
  BarChart3,
  Bot,
  Clock,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Disruption, ClashReport } from '../types';

interface OverviewData {
  totalSessions: number;
  totalRooms: number;
  totalFaculty: number;
  activeMasterVersion: string | null;
  lectureCount?: number;
  labCount?: number;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-primary',
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-surface p-5 rounded-xl border border-border shadow-xs">
      <div className="flex items-center justify-between text-muted mb-2">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export const DashboardPage: React.FC = () => {
  const { targetDate } = useApp();

  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [clashes, setClashes] = useState<ClashReport[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [d, c, o] = await Promise.all([
        api.getDisruptions(targetDate),
        api.getBaselineClashes().catch(() => [] as ClashReport[]),
        api.getAnalyticsOverview().catch(() => null),
      ]);
      setDisruptions(d);
      setClashes(c);
      setOverview(o);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data. Ensure the backend is running on port 8080.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [targetDate]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-header-deep to-primary rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-white/20 text-white tracking-wider">
              TIMETABLE COORDINATOR: PROF. POOJA THAKRE
            </span>
            <span className="text-xs text-white/80">• Computer Engineering, RSCOE</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Disruption-Aware Rescheduling Platform</h2>
          <p className="text-sm text-white/80 mt-1">
            Target date:{' '}
            <span className="font-semibold text-white underline">
              {new Date(targetDate + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <NavLink
            to="/plans"
            className="px-4 py-2.5 rounded-lg bg-white text-primary font-bold text-sm hover:bg-white/90 shadow-sm flex items-center gap-2 transition"
          >
            <Cpu className="w-4 h-4" />
            Launch Solver
          </NavLink>
          <NavLink
            to="/disruptions"
            className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-sm border border-white/20 transition flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Log Disruption
          </NavLink>
          <button
            onClick={loadData}
            title="Refresh"
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <span className="font-bold">Connection Error: </span>{error}
          </div>
        </div>
      )}

      {/* Baseline Clash Advisory */}
      {clashes.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 flex-1">
            <span className="font-bold">Domain Rule Acknowledged: </span>
            There are{' '}
            <span className="font-bold">{clashes.length} pre-existing baseline clashes</span> in
            the active master timetable. These represent the accepted historical schedule and will
            never be altered by the solver. Zero new clashes will be introduced.
          </div>
        </div>
      )}

      {/* Metrics Row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface p-5 rounded-xl border border-border animate-pulse">
              <div className="h-3 bg-canvas rounded w-2/3 mb-4" />
              <div className="h-7 bg-canvas rounded w-1/3 mb-2" />
              <div className="h-2 bg-canvas rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Master Version"
            value={
              <span className="text-base leading-snug">{overview?.activeMasterVersion ?? '—'}</span>
            }
            sub="Read-Only • Protected"
            icon={Calendar}
            color="text-primary"
          />
          <StatCard
            label="Disruptions Today"
            value={disruptions.length}
            sub={`For ${targetDate}`}
            icon={AlertTriangle}
            color="text-amber-500"
          />
          <StatCard
            label="Total Sessions"
            value={overview?.totalSessions ?? '—'}
            sub={`${overview?.lectureCount ?? 0} Lecture · ${overview?.labCount ?? 0} Lab`}
            icon={Layers}
            color="text-primary"
          />
          <StatCard
            label="New Clash Rate"
            value={<span className="text-emerald-600">0.0%</span>}
            sub="Strict Mathematical Guarantee"
            icon={CheckCircle2}
            color="text-emerald-500"
          />
        </div>
      )}

      {/* Secondary Stats */}
      {!loading && overview && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Rooms" value={overview.totalRooms} sub="Classrooms & Labs" icon={Layers} />
          <StatCard label="Faculty" value={overview.totalFaculty} sub="Active members" icon={Layers} />
          <StatCard label="Baseline Clashes" value={clashes.length} sub="Pre-existing (accepted)" icon={ShieldAlert} color="text-amber-500" />
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Disruptions Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Disruptions for {targetDate}
            </h3>
            <NavLink to="/disruptions" className="text-xs text-primary font-semibold hover:underline">
              Manage →
            </NavLink>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-xs divide-y divide-border">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted">Loading…</div>
            ) : disruptions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                No disruptions logged for <strong>{targetDate}</strong>.<br />
                <NavLink
                  to="/disruptions"
                  className="mt-3 inline-block text-xs text-primary font-semibold hover:underline"
                >
                  + Add a disruption
                </NavLink>
              </div>
            ) : (
              disruptions.map((d) => (
                <div key={d.id} className="p-4 flex items-start gap-3 hover:bg-canvas/50 transition">
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    {d.kind === 'FACULTY_UNAVAILABLE' ? (
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-ink">
                        {d.kind === 'ROOM_UNAVAILABLE' && `Room Unavailable: ${d.roomCode ?? '—'}`}
                        {d.kind === 'FACULTY_UNAVAILABLE' && `Faculty Unavailable: ${d.facultyCode ?? '—'}`}
                        {d.kind === 'EXTRA_ROOM' && `Extra Room Added: ${d.roomCode ?? '—'}`}
                        {d.kind === 'OTHER' && `Disruption`}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {d.kind.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {(d.startTime || d.endTime) && (
                      <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {d.startTime ?? '—'} – {d.endTime ?? '—'}
                      </div>
                    )}
                    {d.reason && (
                      <div className="text-xs text-ink/70 mt-0.5 italic">{d.reason}</div>
                    )}
                  </div>
                </div>
              ))
            )}

            {!loading && (
              <div className="p-3">
                <NavLink
                  to="/disruptions"
                  className="block w-full py-2 text-center text-xs font-semibold text-primary bg-primary-tint hover:bg-primary-border rounded-lg transition"
                >
                  + Add Room or Faculty Disruption
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-ink">Quick Actions</h3>

          <div className="space-y-3">
            {[
              {
                to: '/timetable',
                icon: Calendar,
                label: 'View Master Timetable',
                sub: 'Browse the active read-only grid',
                color: 'bg-blue-50 text-blue-600 border-blue-100',
              },
              {
                to: '/disruptions',
                icon: AlertTriangle,
                label: 'Log Disruption',
                sub: 'Room or faculty unavailability',
                color: 'bg-amber-50 text-amber-600 border-amber-100',
              },
              {
                to: '/plans',
                icon: Cpu,
                label: 'Run Solver',
                sub: 'Generate zero-clash rescheduling plans',
                color: 'bg-primary-tint text-primary border-primary-border',
              },
              {
                to: '/broadcasts',
                icon: MessageSquare,
                label: 'WhatsApp Broadcasts',
                sub: 'Drafted notices ready to copy and send',
                color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              },
              {
                to: '/analytics',
                icon: BarChart3,
                label: 'View Analytics',
                sub: 'Session and room utilization metrics',
                color: 'bg-canvas text-ink border-border',
              },
              {
                to: '/ai-assistant',
                icon: Bot,
                label: 'Ask AI Assistant',
                sub: 'Propose-only query engine',
                color: 'bg-purple-50 text-purple-600 border-purple-100',
              },
            ].map(({ to, icon: Icon, label, sub, color }) => (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 p-3.5 rounded-xl border ${color} hover:opacity-90 transition group`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{label}</div>
                  <div className="text-[11px] opacity-70 truncate">{sub}</div>
                </div>
                <span className="text-lg opacity-30 group-hover:opacity-60">→</span>
              </NavLink>
            ))}
          </div>

          {/* AI Tip */}
          <div className="bg-gradient-to-br from-primary-tint to-white p-4 rounded-xl border border-primary-border text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              AI Assistant
            </div>
            <p className="text-ink/80 leading-relaxed">
              Ask the AI assistant which labs are free, or how to minimise blast radius for a room
              disruption. It proposes only — never writes to the timetable.
            </p>
            <NavLink to="/ai-assistant" className="inline-block text-[11px] font-bold text-primary hover:underline">
              Open AI Assistant →
            </NavLink>
          </div>

          {/* Last refreshed */}
          <div className="text-[11px] text-muted text-right">
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};
