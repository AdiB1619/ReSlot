import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Clock,
  DoorOpen,
  UserX,
  FileCode,
  CheckCircle2,
  Check,
  X,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Cpu,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Disruption, RoomItem, FacultyItem } from '../types';

export const DisruptionsPage: React.FC = () => {
  const { targetDate } = useApp();
  const navigate = useNavigate();

  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [faculty, setFaculty] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Form State - ZERO DROPDOWNS
  const [kind, setKind] = useState<'ROOM_UNAVAILABLE' | 'FACULTY_UNAVAILABLE' | 'EXTRA_ROOM'>('ROOM_UNAVAILABLE');
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([13]); // Default A-212
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<number[]>([]);
  
  // Lab Hours Adjustment Rule state: null = Inactive (Normal mode), or 'ALL' | 'SE' | 'TE'
  const [selectedLabRule, setSelectedLabRule] = useState<'ALL' | 'SE' | 'TE' | null>(null);

  // Filtering in visual grids
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<'ALL' | 'CLASSROOM' | 'LAB'>('ALL');
  const [roomSearch, setRoomSearch] = useState<string>('');
  const [facultySearch, setFacultySearch] = useState<string>('');

  // Time preset selector (No dropdowns)
  const [timePreset, setTimePreset] = useState<string>('FULL_DAY');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');

  // Reason selector (No dropdowns)
  const [reason, setReason] = useState<string>('Routine Maintenance / Unavailability');

  // JSON Import Modal (Optional advanced power tool)
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [targetDate]);

  async function loadData() {
    setLoading(true);
    try {
      const [d, r, f] = await Promise.all([
        api.getDisruptions(targetDate),
        api.getRooms(),
        api.getFaculty(),
      ]);
      setDisruptions(d);
      setRooms(r);
      setFaculty(f);
    } catch (err) {
      console.error('Error loading disruptions', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle time presets
  const handleSelectTimePreset = (preset: string, start: string, end: string) => {
    setTimePreset(preset);
    setStartTime(start);
    setEndTime(end);
  };

  // Toggle room selection (1 or many)
  const toggleRoom = (id: number) => {
    setSelectedRoomIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  // Toggle faculty selection (1 or many)
  const toggleFaculty = (id: number) => {
    setSelectedFacultyIds((prev) =>
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    );
  };

  // Toggle or select Lab Hours Adjustment Rule
  const handleSelectLabRule = (rule: 'ALL' | 'SE' | 'TE') => {
    if (selectedLabRule === rule) {
      handleClearLabRule();
      return;
    }
    setSelectedLabRule(rule);
    setKind('ROOM_UNAVAILABLE');
    const labIds = rooms.filter((r) => r.roomType === 'LAB').map((r) => r.id);
    if (rule === 'ALL') {
      setSelectedRoomIds(labIds);
      setReason('Cancel all lab sessions - adjust to classroom theory lectures');
    } else if (rule === 'SE') {
      setSelectedRoomIds(labIds.slice(0, 3));
      setReason('Cancel lab sessions for SE - adjust to classroom theory lectures');
    } else if (rule === 'TE') {
      setSelectedRoomIds(labIds.slice(0, 3));
      setReason('Cancel lab sessions for TE - adjust to classroom theory lectures');
    }
  };

  const handleClearLabRule = () => {
    setSelectedLabRule(null);
    setSelectedRoomIds([13]); // Default A-211
    setReason('Routine Maintenance / Unavailability');
  };

  // Select / deselect all filtered rooms
  const handleToggleAllFilteredRooms = (filteredList: RoomItem[]) => {
    const filteredIds = filteredList.map((r) => r.id);
    const allSelected = filteredIds.every((id) => selectedRoomIds.includes(id));
    if (allSelected) {
      setSelectedRoomIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedRoomIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Select / deselect all filtered faculty
  const handleToggleAllFilteredFaculty = (filteredList: FacultyItem[]) => {
    const filteredIds = filteredList.map((f) => f.id);
    const allSelected = filteredIds.every((id) => selectedFacultyIds.includes(id));
    if (allSelected) {
      setSelectedFacultyIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedFacultyIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Submit bulk disruptions
  const handleBulkSubmit = async () => {
    const isRoomKind = kind !== 'FACULTY_UNAVAILABLE';
    const count = isRoomKind ? selectedRoomIds.length : selectedFacultyIds.length;
    if (count === 0) {
      alert(`Please click and select at least one ${isRoomKind ? 'room/lab' : 'faculty member'} from the options below.`);
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const payload = {
        kind,
        roomIds: isRoomKind ? selectedRoomIds : [],
        facultyIds: !isRoomKind ? selectedFacultyIds : [],
        onDate: targetDate,
        startTime,
        endTime,
        reason,
      };

      await api.createBulkDisruptions(payload);

      // If Lab Hours Adjustment Rule was chosen, create the corresponding room policy override
      if (selectedLabRule) {
        try {
          await api.createRoomRule({
            onDate: targetDate,
            level: selectedLabRule === 'ALL' ? undefined : (selectedLabRule === 'SE' ? 'SY' : 'TY'),
            layout: 'ONE_ROOM_PER_BATCH',
            allowRoomTypes: 'CLASSROOM',
            sessionType: 'LAB',
            reason: 'Lab Hours Adjustment Rule: Conduct practicals in classrooms as theory lectures',
          });
        } catch (ruleErr) {
          console.warn('Note: Room rule creation returned:', ruleErr);
        }
      }

      setFeedbackMsg(`Successfully logged ${count} disruption(s) for ${targetDate}!`);
      // Reset selections
      if (isRoomKind) setSelectedRoomIds([]);
      else setSelectedFacultyIds([]);
      setSelectedLabRule(null);
      setReason('Routine Maintenance / Unavailability');
      await loadData();
    } catch (err: any) {
      alert('Failed to log disruption: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isClearing, setIsClearing] = useState<boolean>(false);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteDisruption(id);
      setFeedbackMsg('Disruption removed. Schedule updated & normalized automatically.');
      await loadData();
    } catch (err: any) {
      alert('Failed to delete disruption: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await api.resetDay(targetDate);
      setFeedbackMsg(`Schedule Normalized! All disruptions & venue reassignments cleared for ${targetDate}. Running baseline Master Timetable.`);
      await loadData();
    } catch (err: any) {
      alert('Failed to reset day: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsClearing(false);
    }
  };

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (roomCategoryFilter === 'CLASSROOM' && r.roomType !== 'CLASSROOM') return false;
      if (roomCategoryFilter === 'LAB' && r.roomType !== 'LAB') return false;
      if (roomSearch.trim()) {
        const q = roomSearch.toLowerCase();
        return (
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          (r.labCode && r.labCode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [rooms, roomCategoryFilter, roomSearch]);

  // Filtered faculty
  const filteredFaculty = useMemo(() => {
    return faculty.filter((f) => {
      if (!facultySearch.trim()) return true;
      const q = facultySearch.toLowerCase();
      return f.code.toLowerCase().includes(q) || f.fullName.toLowerCase().includes(q);
    });
  }, [faculty, facultySearch]);

  const selectedCount = kind !== 'FACULTY_UNAVAILABLE' ? selectedRoomIds.length : selectedFacultyIds.length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Disruptions & Availability</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Target: {targetDate}
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Specify rooms or labs undergoing maintenance, faculty on leave, or temporary extra halls available for the day. All options are selectable cards with zero dropdowns.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setJsonText(`{\n  "date": "${targetDate}",\n  "unavailable": [\n    { "room": "A-212", "from": "09:00", "to": "11:00", "reason": "power maintenance" }\n  ]\n}`);
              setShowJsonModal(true);
            }}
            className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-ink bg-surface hover:bg-canvas flex items-center gap-1.5 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-muted" />
            Import JSON
          </button>

          {disruptions.length > 0 && (
            <button
              onClick={() => navigate('/plans')}
              className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover flex items-center gap-2 shadow-sm transition-all"
            >
              <Cpu className="w-4 h-4" />
              Solve & Plan ({disruptions.length} Disruptions)
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
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

      {/* SECTION 1: LOG NEW DISRUPTIONS (NO DROPDOWNS) */}
      <div className="bg-surface border border-border rounded-xl shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              1
            </div>
            <h2 className="text-base font-semibold text-ink">Choose Disruption Type (Click to select)</h2>
          </div>
          <span className="text-xs text-muted">Step 1 of 4</span>
        </div>

        {/* Kind Option Cards (Zero Dropdowns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Option A: Room/Lab Unavailable */}
          <button
            type="button"
            onClick={() => setKind('ROOM_UNAVAILABLE')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              kind === 'ROOM_UNAVAILABLE'
                ? 'border-primary bg-primary-tint/30 shadow-xs'
                : 'border-border bg-canvas/30 hover:bg-surface hover:border-muted/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <DoorOpen className="w-5 h-5" />
              </div>
              {kind === 'ROOM_UNAVAILABLE' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary text-white">
                  Active
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-ink">Room / Lab Unavailable</div>
              <p className="text-xs text-muted mt-1">
                Classroom or Lab under maintenance, power outage, or exam session.
              </p>
            </div>
          </button>

          {/* Option B: Faculty on Leave */}
          <button
            type="button"
            onClick={() => setKind('FACULTY_UNAVAILABLE')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              kind === 'FACULTY_UNAVAILABLE'
                ? 'border-primary bg-primary-tint/30 shadow-xs'
                : 'border-border bg-canvas/30 hover:bg-surface hover:border-muted/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                <UserX className="w-5 h-5" />
              </div>
              {kind === 'FACULTY_UNAVAILABLE' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary text-white">
                  Active
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-ink">Faculty on Leave / Absent</div>
              <p className="text-xs text-muted mt-1">
                Teacher on casual, medical, conference or external exam duty leave.
              </p>
            </div>
          </button>

          {/* Option C: Temporary Extra Room */}
          <button
            type="button"
            onClick={() => setKind('EXTRA_ROOM')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              kind === 'EXTRA_ROOM'
                ? 'border-primary bg-primary-tint/30 shadow-xs'
                : 'border-border bg-canvas/30 hover:bg-surface hover:border-muted/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <Plus className="w-5 h-5" />
              </div>
              {kind === 'EXTRA_ROOM' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary text-white">
                  Active
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-ink">Temporary Extra Room Available</div>
              <p className="text-xs text-muted mt-1">
                Extra seminar hall, vacant drawing hall, or temporary room freed up.
              </p>
            </div>
          </button>
        </div>

        {/* Quick Action Preset: Cancel Lab Sessions & Adjust to Theory Lectures */}
        <div
          className={`p-4 border rounded-xl transition-all ${
            selectedLabRule
              ? 'bg-amber-50/90 border-amber-400 shadow-sm'
              : 'bg-canvas/50 border-border hover:bg-canvas/80'
          } space-y-3 text-xs`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  selectedLabRule ? 'bg-amber-600 text-white' : 'bg-muted/20 text-muted'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-ink">
                <strong>Lab Hours Adjustment Rule:</strong> Cancel lab sessions and conduct theory lectures in classrooms during scheduled slots.
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedLabRule ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-600 text-white shadow-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                  Active: {selectedLabRule === 'ALL' ? 'All Labs' : `${selectedLabRule} Labs`}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface border border-border text-muted">
                  Normal Mode (Inactive)
                </span>
              )}

              {/* Clear button to restore normal mode */}
              {(selectedLabRule !== null ||
                reason.toLowerCase().includes('cancel') ||
                selectedRoomIds.length > 3) && (
                <button
                  type="button"
                  onClick={handleClearLabRule}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-red-50 text-red-700 hover:text-red-800 border border-red-300 text-xs font-semibold transition shadow-xs cursor-pointer"
                  title="Clear lab adjustment rule and reset to normal mode"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Choice (Normal Mode)
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectLabRule('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedLabRule === 'ALL'
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-700'
                  : 'bg-surface hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {selectedLabRule === 'ALL' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              Cancel All Labs (Adjust to Theory)
            </button>
            <button
              type="button"
              onClick={() => handleSelectLabRule('SE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                selectedLabRule === 'SE'
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-700'
                  : 'bg-surface hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {selectedLabRule === 'SE' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              Cancel SE Labs
            </button>
            <button
              type="button"
              onClick={() => handleSelectLabRule('TE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                selectedLabRule === 'TE'
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-700'
                  : 'bg-surface hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {selectedLabRule === 'TE' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              Cancel TE Labs
            </button>
          </div>

          <p className="text-[11px] text-muted">
            {selectedLabRule
              ? '⚡ Only active because an option is selected. Cancelled lab hours for selected classes will be converted to theory lectures in classrooms during scheduled slots.'
              : 'ℹ️ Rule is Inactive: The system works normally. Routine room/faculty disruptions will be reassigned to vacant rooms or shifted slots without cancelling labs.'}
          </p>
        </div>

        {/* SECTION 2: TARGET SELECTION (ROOMS OR FACULTY) - VISUAL MULTI-SELECT */}
        <div className="pt-4 border-t border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                2
              </div>
              <h2 className="text-base font-semibold text-ink">
                {kind !== 'FACULTY_UNAVAILABLE'
                  ? 'Select Affected Room(s) / Lab(s) — Click one or multiple'
                  : 'Select Absent Faculty Member(s) — Click one or multiple'}
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-tint text-primary border border-primary/20">
              {selectedCount} selected
            </span>
          </div>

          {/* ROOM SELECTION INTERFACE */}
          {kind !== 'FACULTY_UNAVAILABLE' ? (
            <div className="space-y-3">
              {/* Filter and Search controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-canvas/40 p-3 rounded-lg border border-border">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRoomCategoryFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      roomCategoryFilter === 'ALL'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface text-ink hover:bg-canvas border border-border'
                    }`}
                  >
                    All Venues ({rooms.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomCategoryFilter('CLASSROOM')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      roomCategoryFilter === 'CLASSROOM'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface text-ink hover:bg-canvas border border-border'
                    }`}
                  >
                    Classrooms ({rooms.filter((r) => r.roomType === 'CLASSROOM').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomCategoryFilter('LAB')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      roomCategoryFilter === 'LAB'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface text-ink hover:bg-canvas border border-border'
                    }`}
                  >
                    Computer Labs ({rooms.filter((r) => r.roomType === 'LAB').length})
                  </button>
                </div>

                {/* Search Box */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search room code or name..."
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary w-48"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleAllFilteredRooms(filteredRooms)}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-ink hover:bg-canvas"
                  >
                    {filteredRooms.every((r) => selectedRoomIds.includes(r.id))
                      ? 'Deselect Filtered'
                      : 'Select All Filtered'}
                  </button>
                </div>
              </div>

              {/* Grid of Room Cards (ZERO DROPDOWNS) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-72 overflow-y-auto p-1">
                {filteredRooms.map((room) => {
                  const isSelected = selectedRoomIds.includes(room.id);
                  return (
                    <div
                      key={room.id}
                      onClick={() => toggleRoom(room.id)}
                      className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary bg-primary-tint/40 shadow-xs ring-1 ring-primary'
                          : 'border-border bg-surface hover:bg-canvas/60 hover:border-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-sm text-ink">{room.code}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-border bg-surface'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-[11px] font-medium text-ink truncate" title={room.name}>
                          {room.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              room.roomType === 'LAB'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {room.roomType}
                          </span>
                          <span className="text-[10px] text-muted">Cap: {room.capacity}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* FACULTY SELECTION INTERFACE */
            <div className="space-y-3">
              {/* Search & Select All */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-canvas/40 p-3 rounded-lg border border-border">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by faculty name or abbreviation..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary w-64"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleAllFilteredFaculty(filteredFaculty)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-ink hover:bg-canvas"
                >
                  {filteredFaculty.every((f) => selectedFacultyIds.includes(f.id))
                    ? 'Deselect Filtered'
                    : 'Select All Filtered'}
                </button>
              </div>

              {/* Grid of Faculty Cards (ZERO DROPDOWNS) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-72 overflow-y-auto p-1">
                {filteredFaculty.map((fac) => {
                  const isSelected = selectedFacultyIds.includes(fac.id);
                  return (
                    <div
                      key={fac.id}
                      onClick={() => toggleFaculty(fac.id)}
                      className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary bg-primary-tint/40 shadow-xs ring-1 ring-primary'
                          : 'border-border bg-surface hover:bg-canvas/60 hover:border-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                          {fac.code}
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-border bg-surface'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-ink truncate" title={fac.fullName}>
                          {fac.fullName}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">Code: {fac.code}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: TIME SLOT (NO DROPDOWNS - QUICK PRESETS) */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                3
              </div>
              <h2 className="text-base font-semibold text-ink">Duration / Time Slots (Click to choose)</h2>
            </div>
            <span className="text-xs text-muted">
              Current: <strong className="text-ink">{startTime} to {endTime}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { id: 'FULL_DAY', label: 'Full Day', start: '09:00', end: '17:00' },
              { id: 'MORNING', label: 'Morning Slot', start: '09:00', end: '13:00' },
              { id: 'AFTERNOON', label: 'Afternoon Slot', start: '13:00', end: '17:00' },
              { id: 'SLOT_1', label: 'Slot 1 (09:00 - 11:00)', start: '09:00', end: '11:00' },
              { id: 'SLOT_2', label: 'Slot 2 (11:15 - 13:15)', start: '11:15', end: '13:15' },
              { id: 'SLOT_3', label: 'Slot 3 (14:00 - 16:00)', start: '14:00', end: '16:00' },
            ].map((p) => {
              const isSelected = timePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectTimePreset(p.id, p.start, p.end)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-xs'
                      : 'border-border bg-surface text-ink hover:bg-canvas'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{p.label}</div>
                  <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-muted'}`}>
                    {p.start} - {p.end}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Time Option */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs text-muted font-medium">Or enter custom hours:</span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setTimePreset('CUSTOM');
                  setStartTime(e.target.value);
                }}
                className="px-2.5 py-1 text-xs rounded border border-border bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted">to</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setTimePreset('CUSTOM');
                  setEndTime(e.target.value);
                }}
                className="px-2.5 py-1 text-xs rounded border border-border bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: REASON PRESETS (NO DROPDOWNS) */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              4
            </div>
            <h2 className="text-base font-semibold text-ink">Reason / Operational Note</h2>
          </div>

          {/* Preset Reason Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              'Power / Projector Maintenance',
              'University / Department Exam',
              'Faculty Casual / Medical Leave',
              'Faculty Deputation / Conference',
              'Lab System Hardware Upgrade',
              'Guest Lecture / Seminar Booking',
              'Campus Event / Activity',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setReason(chip)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  reason === chip
                    ? 'bg-ink text-white shadow-xs'
                    : 'bg-canvas text-ink hover:bg-surface border border-border'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Type or customize reason note..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* SUBMIT ACTION BAR */}
        <div className="pt-4 border-t border-border flex items-center justify-between bg-canvas/40 -mx-6 -mb-6 p-4 rounded-b-xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-muted">
              Pre-validation active: <strong>{selectedCount}</strong> {kind !== 'FACULTY_UNAVAILABLE' ? 'room(s)' : 'faculty'} selected for {targetDate}.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedRoomIds([]);
                setSelectedFacultyIds([]);
              }}
              className="px-3 py-2 text-xs font-medium text-muted hover:text-ink"
            >
              Clear Selections
            </button>

            <button
              type="button"
              disabled={isSubmitting || selectedCount === 0}
              onClick={handleBulkSubmit}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all ${
                selectedCount === 0
                  ? 'bg-muted/40 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>Logging...</>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Log Disruption ({selectedCount} Selected)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 5: CURRENT ACTIVE DISRUPTIONS FOR TARGET DATE */}
      <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink">Active Disruptions Logged for {targetDate}</h2>
            <p className="text-xs text-muted mt-0.5">
              These will be fed directly to the Rescheduling Solver.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-canvas border border-border text-ink">
              Total: {disruptions.length}
            </span>
            {disruptions.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Remove all disruptions and normalize schedule"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isClearing ? 'Normalizing...' : `Clear All (${disruptions.length}) & Normalize`}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading disruptions...</div>
        ) : disruptions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-ink">Master Timetable 100% Normalized for {targetDate}</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Zero active disruptions. All classes, labs, and faculty run as scheduled in the active master timetable.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {disruptions.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between hover:bg-canvas/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      d.kind === 'ROOM_UNAVAILABLE'
                        ? 'bg-amber-100 text-amber-700'
                        : d.kind === 'FACULTY_UNAVAILABLE'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {d.kind === 'ROOM_UNAVAILABLE' ? (
                      <DoorOpen className="w-4 h-4" />
                    ) : d.kind === 'FACULTY_UNAVAILABLE' ? (
                      <UserX className="w-4 h-4" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink">
                        {d.roomCode ? `Room: ${d.roomCode}` : d.facultyCode ? `Faculty: Prof. ${d.facultyCode}` : 'Facility'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          d.kind === 'ROOM_UNAVAILABLE'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : d.kind === 'FACULTY_UNAVAILABLE'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {d.kind.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {d.startTime || '09:00'} - {d.endTime || '17:00'}
                      </span>
                      <span>·</span>
                      <span>{d.reason || 'Operational adjustment'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete disruption"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON Import Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-ink">Import Canonical JSON Disruption Payload</h3>
              <button onClick={() => setShowJsonModal(false)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={8}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full p-3 font-mono text-xs rounded-lg border border-border bg-canvas/40 text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-3 py-1.5 text-xs text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/v1/imports/canonical-json', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: jsonText,
                    });
                    setShowJsonModal(false);
                    loadData();
                  } catch (e: any) {
                    alert('Error: ' + e.message);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
