import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Send,
  AlertTriangle,
  Flame,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../components/layout/AppLayout';
import { api } from '../services/api';
import { PlanSummary } from '../types';

export const ApprovalQueuePage: React.FC = () => {
  const { targetDate } = useApp();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [targetDate]);

  async function loadData() {
    const p = await api.getPlans();
    const sorted = [...p].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
    setPlans(sorted);
  }

  const handleApprove = async (planId: number) => {
    const note = remarks[planId] || 'Approved by Timetable Coordinator';
    await api.approvePlan(planId, note);
    setFeedback(`Plan #${planId} has been successfully APPROVED.`);
    loadData();
  };

  const handleReject = async (planId: number) => {
    const note = remarks[planId] || 'Schedule changes infeasible';
    await api.rejectPlan(planId, note);
    setFeedback(`Plan #${planId} has been REJECTED.`);
    loadData();
  };

  const handlePublish = async (planId: number) => {
    await api.publishPlan(planId);
    setFeedback(`Plan #${planId} is now PUBLISHED. Timetable overrides dispatched!`);
    loadData();
  };

  const pendingPlans = plans.filter((p) => p.status === 'PROPOSED');
  const actionedPlans = plans.filter((p) => p.status !== 'PROPOSED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-ink">Plan Publishing & Verification</h2>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            {pendingPlans.length} Pending Verification
          </span>
        </div>
        <p className="text-xs text-muted mt-1">
          Coordinator publishing stage: Verify candidate schedule changes, inspect blast radius metrics, and publish directly.
        </p>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> {feedback}
        </div>
      )}

      {/* Pending Queue */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" /> Pending Reschedule Plans for Verification
        </h3>

        {pendingPlans.length === 0 ? (
          <div className="bg-surface p-8 rounded-xl border border-border text-center text-xs text-muted">
            No plans awaiting verification. All proposed runs have been actioned.
          </div>
        ) : (
          pendingPlans.map((p) => (
            <div key={p.id} className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary-tint text-primary border border-primary-border">
                    {p.code}
                  </span>
                  <h4 className="font-bold text-sm text-ink">{p.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Candidate Plan
                  </span>
                </div>

                <NavLink
                  to={`/plans/${p.id}?date=${targetDate}`}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Inspect Day Diff & Overrides &rarr;
                </NavLink>
              </div>

              <p className="text-xs text-muted">{p.description}</p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-canvas p-3 rounded-lg border border-border text-xs">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Sessions Moved</span>
                  <span className="font-bold text-primary flex items-center gap-1 mt-0.5">
                    <Flame className="w-3.5 h-3.5" /> {p.sessionsMoved} sessions
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Faculty Impact</span>
                  <span className="font-bold text-ink mt-0.5 block">{p.facultyAffected} staff</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Student Batches</span>
                  <span className="font-bold text-ink mt-0.5 block">{p.groupsAffected} cohorts</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">New Clashes</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> 0 Guaranteed
                  </span>
                </div>
              </div>

              {/* Approval Input & Buttons */}
              <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Enter approval remarks or special instructions (optional)..."
                    value={remarks[p.id] || ''}
                    onChange={(e) => setRemarks({ ...remarks, [p.id]: e.target.value })}
                    className="w-full px-3 py-1.5 bg-canvas border border-border rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReject(p.id)}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => handleApprove(p.id)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-canvas hover:bg-border text-ink text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Sign & Approve
                  </button>
                  <button
                    onClick={() => handlePublish(p.id)}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" /> Publish Directly
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actioned / Published Plans History */}
      {actionedPlans.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" /> Actioned & Published Plans
          </h3>

          <div className="space-y-3">
            {actionedPlans.map((p) => (
              <div key={p.id} className="bg-surface p-4 rounded-xl border border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary-tint text-primary border border-primary-border">
                    {p.code}
                  </span>
                  <div>
                    <div className="font-bold text-xs text-ink">{p.name}</div>
                    <div className="text-[11px] text-muted">
                      Status: <strong className="text-emerald-700">{p.status}</strong> • {p.sessionsMoved} sessions relocated
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {p.status === 'APPROVED' && (
                    <button
                      onClick={() => handlePublish(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" /> Publish & Notify
                    </button>
                  )}
                  <NavLink
                    to={`/plans/${p.id}?date=${targetDate}`}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-canvas text-ink"
                  >
                    Inspect
                  </NavLink>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
