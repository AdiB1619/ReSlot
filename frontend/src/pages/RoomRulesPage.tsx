import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sliders,
  CheckCircle,
  AlertCircle,
  Plus,
  ShieldAlert,
  Calculator,
  Trash2,
} from 'lucide-react';
import { useApp } from '../components/layout/AppLayout';
import { api } from '../services/api';
import { RoomRule, RoomItem, StudentGroupItem } from '../types';

export const RoomRulesPage: React.FC = () => {
  const { targetDate } = useApp();
  const [searchParams] = useSearchParams();
  const effectiveDate = searchParams.get('date') || targetDate;

  const [rules, setRules] = useState<RoomRule[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [groups, setGroups] = useState<StudentGroupItem[]>([]);

  // Pre-check Calculator State
  const [calcRoomId, setCalcRoomId] = useState<number>(1); // A-216
  const [calcGroupId, setCalcGroupId] = useState<number>(1); // SE-A
  const [calcResult, setCalcResult] = useState<any>(null);

  // New Rule State
  const [level, setLevel] = useState<string>('ALL');
  const [layout, setLayout] = useState<'ONE_ROOM_PER_BATCH' | 'MERGE_BATCHES'>('ONE_ROOM_PER_BATCH');
  const [confirmedBy, setConfirmedBy] = useState<string>('');
  const [reason, setReason] = useState<string>('Lab Hours Adjustment: Theory session in classroom due to lab unavailability');

  useEffect(() => {
    loadData();
  }, [effectiveDate]);

  async function loadData() {
    const [rls, rms, grps] = await Promise.all([
      api.getRoomRules(effectiveDate),
      api.getRooms(),
      api.getStudentGroups(),
    ]);
    setRules(rls);
    setRooms(rms);
    setGroups(grps);
  }

  const handlePrecheck = async () => {
    const res = await api.checkCapacity(calcRoomId, calcGroupId);
    setCalcResult(res);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (layout === 'MERGE_BATCHES' && !confirmedBy.trim()) {
      alert('Merging batches strictly requires named confirmation by Timetable Coordinator / Administrator!');
      return;
    }

    await api.createRoomRule({
      onDate: effectiveDate,
      level: level === 'ALL' ? undefined : level,
      layout,
      confirmedBy: layout === 'MERGE_BATCHES' ? confirmedBy : undefined,
      allowRoomTypes: 'CLASSROOM',
      sessionType: 'LAB',
      reason,
    });

    loadData();
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await api.deleteRoomRule(id);
      loadData();
    } catch (err: any) {
      alert('Failed to delete rule: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-ink">Room Rules & Classroom Capacity Pre-Check</h2>
        <p className="text-xs text-muted mt-1">
          Configure date-specific relaxation rules (e.g. allowing practicals in classrooms via Lab Hours Adjustment Rule) and verify seating capacity before running solver.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configured Rules */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" /> Active Room Policy Overrides ({effectiveDate})
            </h3>
          </div>

          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary-tint text-primary border border-primary-border">
                      {rule.level ? `Year Level: ${rule.level}` : `Group: ${rule.groupName || 'Department'}`}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Labs &rarr; {rule.allowRoomTypes}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted">{rule.layout}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 rounded hover:bg-rose-50 text-muted hover:text-rose-600 transition cursor-pointer"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-ink/90 font-medium">
                  "{rule.reason}"
                </div>

                {rule.layout === 'MERGE_BATCHES' && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center gap-1.5 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                    Batch Merging Authorized By: <u>{rule.confirmedBy || 'Timetable Coordinator'}</u>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Form to Add Rule */}
          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" /> Add Date-Specific Room Rule
            </h4>

            <form onSubmit={handleCreateRule} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-muted mb-1">Target Scope / Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold"
                >
                  <option value="ALL">All Cohorts (Department-Wide)</option>
                  <option value="SY">Second Year (SY)</option>
                  <option value="TY">Third Year (TY)</option>
                  <option value="BE">Final Year (BE)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-muted mb-1">Batch Layout Strategy</label>
                <select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as any)}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold"
                >
                  <option value="ONE_ROOM_PER_BATCH">One Room Per Batch (Separate Classrooms)</option>
                  <option value="MERGE_BATCHES">Merge Batches (Requires Named Approver)</option>
                </select>
              </div>

              {layout === 'MERGE_BATCHES' && (
                <div className="sm:col-span-2">
                  <label className="block font-medium text-amber-800 mb-1">
                    Confirmed Approver (Timetable Coordinator / Admin)*
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Timetable Coordinator / Administrator"
                    value={confirmedBy}
                    onChange={(e) => setConfirmedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 font-semibold"
                    required
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block font-medium text-muted mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Labs reserved for mock accreditation inspection..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink"
                  required
                />
              </div>

              <div className="sm:col-span-2 flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition shadow-xs"
                >
                  Apply Rule
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Capacity Pre-Check Calculator */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" /> Live Seating Capacity Pre-Check
          </h3>

          <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
            <p className="text-xs text-muted leading-relaxed">
              Verify if an alternative classroom can seat an entire division or merged batches before committing the solver.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-muted mb-1">Select Classroom</label>
                <select
                  value={calcRoomId}
                  onChange={(e) => setCalcRoomId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold"
                >
                  {rooms
                    .filter((r) => r.roomType === 'CLASSROOM')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} ({r.capacity} seats) - {r.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-muted mb-1">Select Student Division / Cohort</label>
                <select
                  value={calcGroupId}
                  onChange={(e) => setCalcGroupId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold"
                >
                  {groups
                    .filter((g) => g.kind === 'DIVISION')
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.strength} students) - {g.level}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handlePrecheck}
                className="w-full py-2.5 rounded-lg bg-canvas hover:bg-border font-bold text-xs text-ink transition border border-border flex items-center justify-center gap-1.5"
              >
                Evaluate Fit &rarr;
              </button>
            </div>

            {/* Results Box */}
            {calcResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 animate-fade-in ${
                  calcResult.fits
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {calcResult.fits ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    Verdict: {calcResult.verdict}
                  </span>
                  <span>{calcResult.fits ? 'SAFE TO ALLOCATE' : 'REJECT ALLOCATION'}</span>
                </div>

                <p className="text-[11px] leading-relaxed opacity-90">{calcResult.message}</p>

                <div className="pt-2 border-t border-black/10 flex justify-between text-[11px] font-semibold">
                  <span>Room Capacity: {calcResult.roomCapacity}</span>
                  <span>Cohort Size: {calcResult.groupStrength}</span>
                  <span>Spare: {calcResult.spareSeats}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
