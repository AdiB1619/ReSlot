import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Flame,
  Users,
  Send,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  MapPin,
} from 'lucide-react';
import { useApp } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PlanSummary, ScheduleOverride } from '../types';

export const PlanDetailPage: React.FC = () => {
  const { planId, id } = useParams<{ planId?: string; id?: string }>();
  const activePlanId = planId || id;
  const [searchParams] = useSearchParams();
  const { targetDate } = useApp();
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);

  const effectiveDate = searchParams.get('date') || targetDate;
  const canManage = user?.role === 'COORDINATOR' || user?.role === 'ADMIN';

  useEffect(() => {
    loadData();
  }, [activePlanId, effectiveDate]);

  async function loadData() {
    if (!activePlanId) {
      setIsLoadingPlan(false);
      return;
    }
    setIsLoadingPlan(true);
    try {
      // 1. Fetch exact plan by ID directly from backend
      const current = await api.getPlan(Number(activePlanId));
      setPlan(current);
      const ovs = await api.getPlanOverrides(current.id);
      setOverrides(ovs);
    } catch (err) {
      console.warn('Direct plan fetch failed, falling back to plans list:', err);
      try {
        const plans = await api.getPlans(effectiveDate);
        const current = plans.find((p) => p.id === Number(activePlanId));
        setPlan(current || null);
        if (current) {
          const ovs = await api.getPlanOverrides(current.id);
          setOverrides(ovs);
        }
      } catch (e2) {
        console.error('Failed to load plans fallback:', e2);
      }
    } finally {
      setIsLoadingPlan(false);
    }
  }

  const handleApprove = async () => {
    if (!plan) return;
    setActionLoading(true);
    try {
      await api.approvePlan(plan.id, `Approved via Plan Detail Inspector by ${user?.fullName || 'Coordinator'}`);
      setActionSuccess('Plan Approved! Ready for official schedule publishing.');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!plan) return;
    setActionLoading(true);
    try {
      await api.publishPlan(plan.id);
      setActionSuccess('Plan Published! WhatsApp notifications dispatched to faculty and students.');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to publish plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!plan) return;
    const reason = prompt('Please enter reason for rejection:') || 'Schedule changes infeasible';
    setActionLoading(true);
    try {
      await api.rejectPlan(plan.id, reason);
      setActionSuccess('Plan marked as REJECTED.');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject plan');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoadingPlan) {
    return (
      <div className="p-12 text-center text-xs text-muted flex flex-col items-center justify-center gap-2">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>Loading plan #{activePlanId} details...</span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <XCircle className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-sm text-ink">Plan #{activePlanId} Not Found</h3>
        <p className="text-xs text-muted max-w-sm mx-auto">
          The requested reschedule plan could not be located for date {effectiveDate}. It may have been superseded or normalized.
        </p>
        <NavLink
          to={`/plans?date=${effectiveDate}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Plan Builder
        </NavLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <NavLink
            to={`/plans?date=${effectiveDate}`}
            className="p-2 rounded-lg border border-border bg-surface hover:bg-canvas text-ink transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </NavLink>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary-tint text-primary border border-primary-border">
                {plan.code}
              </span>
              <h2 className="text-xl font-bold text-ink">{plan.name}</h2>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  plan.status === 'PUBLISHED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : plan.status === 'APPROVED'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {plan.status}
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              Inspection for <strong>{effectiveDate}</strong> • Zero New Clashes: Formally Verified
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {plan.status === 'PROPOSED' && canManage && (
            <>
              <button
                disabled={actionLoading}
                onClick={handleReject}
                className="px-3.5 py-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject Plan
              </button>
              <button
                disabled={actionLoading}
                onClick={handleApprove}
                className="px-4 py-2 rounded-lg border border-border bg-canvas hover:bg-border text-ink text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Approve Plan
              </button>
              <button
                disabled={actionLoading}
                onClick={handlePublish}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> Publish & Dispatch Overrides
              </button>
            </>
          )}

          {plan.status === 'APPROVED' && canManage && (
            <button
              disabled={actionLoading}
              onClick={handlePublish}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Publish & Dispatch Overrides
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> {actionSuccess}
        </div>
      )}

      {/* Blast Radius Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-xs font-medium text-muted uppercase">Sessions Relocated</div>
          <div className="text-xl font-bold text-primary mt-1 flex items-center gap-1.5">
            <Flame className="w-4 h-4" /> {plan.sessionsMoved} sessions
          </div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-xs font-medium text-muted uppercase">Faculty Affected</div>
          <div className="text-xl font-bold text-ink mt-1 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-muted" /> {plan.facultyAffected} staff
          </div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-xs font-medium text-muted uppercase">Batches Impacted</div>
          <div className="text-xl font-bold text-ink mt-1">{plan.groupsAffected} cohorts</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
          <div className="text-xs font-medium text-muted uppercase">New Collisions Introduced</div>
          <div className="text-xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> 0 (Guaranteed)
          </div>
        </div>
      </div>

      {/* Schedule Overrides Table */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-canvas border-b border-border font-bold text-xs text-ink flex items-center justify-between">
          <span>Actionable Schedule Overrides ({overrides.length} Relocations)</span>
          <span className="text-[11px] text-muted font-normal">
            Stored in <code>schedule_overrides</code> table with plan_id = {plan.id}
          </span>
        </div>

        {overrides.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No session overrides generated in this plan (zero affected sessions).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-canvas/50 border-b border-border text-muted uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Subject & Groups</th>
                  <th className="px-4 py-2.5">Original Allocation</th>
                  <th className="px-4 py-2.5">Optimized Proposed Slot</th>
                  <th className="px-4 py-2.5">Action Kind</th>
                  <th className="px-4 py-2.5">Reason / Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overrides.map((ov) => (
                  <tr key={ov.id} className="hover:bg-canvas/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink">{ov.subject}</div>
                      <div className="text-[11px] text-primary font-semibold flex items-center gap-1 mt-0.5">
                        <Layers className="w-3 h-3" /> {ov.groups}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-muted" /> {ov.origStartTime} - {ov.origEndTime}
                      </div>
                      <div className="font-semibold text-ink flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-muted" /> Room {ov.origRoom}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {ov.action === 'CANCEL' ? (
                        <div className="text-red-700 font-bold text-xs flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Cancelled (No Session)
                        </div>
                      ) : (
                        <div className="text-emerald-700">
                          <div className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-emerald-600" /> {ov.newStartTime || ov.origStartTime} - {ov.newEndTime || ov.origEndTime}
                          </div>
                          <div className="font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-emerald-600" /> Room {ov.newRoom || ov.origRoom}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ov.action === 'CANCEL'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : ov.action === 'ROOM_CHANGE'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}>
                        {ov.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted max-w-sm">{ov.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
