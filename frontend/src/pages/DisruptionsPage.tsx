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
  Layers,
  Warehouse,
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

  // High-level Disruption Focus Mode
  // 'ROOMS' = Unified Room Availability (Unavailable Rooms + Temporary Extra Rooms)
  // 'FACULTY' = Faculty on Leave / Absent
  const [activeTab, setActiveTab] = useState<'ROOMS' | 'FACULTY'>('ROOMS');

  // Rooms marked UNAVAILABLE for target date
  const [selectedUnavailableRoomIds, setSelectedUnavailableRoomIds] = useState<number[]>([11, 12]); // e.g. A1-209, A1-113

  // Rooms marked TEMPORARY EXTRA ROOMS available for target date
  const [selectedExtraRoomIds, setSelectedExtraRoomIds] = useState<number[]>([]);

  // Faculty on leave
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<number[]>([]);

  // Lab Hours Adjustment Rule state: null = Inactive (Normal mode), or 'ALL' | 'SE' | 'TE'
  const [selectedLabRule, setSelectedLabRule] = useState<'ALL' | 'SE' | 'TE' | null>(null);

  // New Extra Room form state (for outside venues)
  const [newExtraCode, setNewExtraCode] = useState<string>('');
  const [newExtraName, setNewExtraName] = useState<string>('');
  const [newExtraType, setNewExtraType] = useState<'CLASSROOM' | 'LAB' | 'OTHER'>('OTHER');
  const [newExtraCapacity, setNewExtraCapacity] = useState<number>(100);
  const [isAddingExtraRoom, setIsAddingExtraRoom] = useState<boolean>(false);

  // Filtering in pre-existing visual grids
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<'ALL' | 'CLASSROOM' | 'LAB'>('ALL');
  const [roomSearch, setRoomSearch] = useState<string>('');
  const [facultySearch, setFacultySearch] = useState<string>('');

  // Time preset selector (No dropdowns)
  const [timePreset, setTimePreset] = useState<string>('FULL_DAY');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');

  // Reason selector (No dropdowns)
  const [reason, setReason] = useState<string>('T&P activity / Maintenance');

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

      // Pre-populate any existing extra rooms logged for today
      const todayExtraIds = d
        .filter((item) => item.kind === 'EXTRA_ROOM' && item.roomId)
        .map((item) => item.roomId as number);
      if (todayExtraIds.length > 0) {
        setSelectedExtraRoomIds((prev) => Array.from(new Set([...prev, ...todayExtraIds])));
      }
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

  // Toggle pre-existing room unavailability
  const toggleUnavailableRoom = (id: number) => {
    setSelectedUnavailableRoomIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  // Toggle temporary extra room selection
  const toggleExtraRoom = (id: number) => {
    setSelectedExtraRoomIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  // Toggle faculty selection
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
    const labIds = rooms.filter((r) => r.roomType === 'LAB' && !r.isTemporary).map((r) => r.id);
    if (rule === 'ALL') {
      setSelectedUnavailableRoomIds((prev) => Array.from(new Set([...prev, ...labIds])));
      setReason('Cancel all lab sessions - adjust to classroom theory lectures');
    } else if (rule === 'SE') {
      setSelectedUnavailableRoomIds((prev) => Array.from(new Set([...prev, ...labIds.slice(0, 3)])));
      setReason('Cancel lab sessions for SE - adjust to classroom theory lectures');
    } else if (rule === 'TE') {
      setSelectedUnavailableRoomIds((prev) => Array.from(new Set([...prev, ...labIds.slice(0, 3)])));
      setReason('Cancel lab sessions for TE - adjust to classroom theory lectures');
    }
  };

  const handleClearLabRule = () => {
    setSelectedLabRule(null);
    setReason('Routine Maintenance / Unavailability');
  };

  // Add a new temporary extra room (external to computer department)
  const handleAddExtraRoom = async (
    code: string,
    name: string,
    roomType: 'CLASSROOM' | 'LAB' | 'OTHER',
    capacity: number
  ) => {
    if (!code.trim() || !name.trim()) {
      alert('Please enter both Room Code (e.g. SEM-HALL-1) and Room Name (e.g. Central Seminar Hall).');
      return;
    }

    setIsAddingExtraRoom(true);
    try {
      const created = await api.createRoom({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        roomType,
        capacity: capacity > 0 ? capacity : 60,
        isTemporary: true,
      });

      // Update room list
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === created.id || r.code.toUpperCase() === created.code.toUpperCase());
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = created;
          return next;
        }
        return [...prev, created];
      });

      // Automatically add to selectedExtraRoomIds
      setSelectedExtraRoomIds((prev) => Array.from(new Set([...prev, created.id])));
      setNewExtraCode('');
      setNewExtraName('');
      setNewExtraCapacity(100);
      setFeedbackMsg(`Extra room "${created.code} (${created.name})" created and added to available extra rooms!`);
    } catch (err: any) {
      alert('Failed to add extra room: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsAddingExtraRoom(false);
    }
  };

  // Quick campus presets for external venues
  const campusVenuePresets = [
    { code: 'SEM-HALL-1', name: 'Central Seminar Hall (Ground Floor)', roomType: 'OTHER' as const, capacity: 120 },
    { code: 'AUDI-MAIN', name: 'Main Campus Auditorium', roomType: 'OTHER' as const, capacity: 300 },
    { code: 'MECH-CAD', name: 'Mechanical CAD / Simulation Lab', roomType: 'LAB' as const, capacity: 40 },
    { code: 'DRAW-HALL-2', name: 'Engineering Drawing Hall B-201', roomType: 'CLASSROOM' as const, capacity: 80 },
  ];

  // Select / deselect all filtered pre-existing department rooms
  const handleToggleAllFilteredRooms = (filteredList: RoomItem[]) => {
    const filteredIds = filteredList.map((r) => r.id);
    const allSelected = filteredIds.every((id) => selectedUnavailableRoomIds.includes(id));
    if (allSelected) {
      setSelectedUnavailableRoomIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedUnavailableRoomIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
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

  // Submit bulk disruptions (Logs unavailable rooms, extra rooms, and faculty AT ONCE)
  const handleBulkSubmit = async () => {
    const unavailCount = selectedUnavailableRoomIds.length;
    const extraCount = selectedExtraRoomIds.length;
    const facCount = selectedFacultyIds.length;
    const totalCount = unavailCount + extraCount + facCount;

    if (totalCount === 0) {
      alert('Please select at least one unavailable room, temporary extra room, or absent faculty.');
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const promises: Promise<any>[] = [];

      // 1. Log ROOM_UNAVAILABLE disruptions
      if (unavailCount > 0) {
        promises.push(
          api.createBulkDisruptions({
            kind: 'ROOM_UNAVAILABLE',
            roomIds: selectedUnavailableRoomIds,
            facultyIds: [],
            onDate: targetDate,
            startTime,
            endTime,
            reason: reason || 'T&P activity / Maintenance',
          })
        );
      }

      // 2. Log EXTRA_ROOM disruptions
      if (extraCount > 0) {
        promises.push(
          api.createBulkDisruptions({
            kind: 'EXTRA_ROOM',
            roomIds: selectedExtraRoomIds,
            facultyIds: [],
            onDate: targetDate,
            startTime,
            endTime,
            reason: 'Temporary Extra Room available for rescheduling',
          })
        );
      }

      // 3. Log FACULTY_UNAVAILABLE disruptions
      if (facCount > 0) {
        promises.push(
          api.createBulkDisruptions({
            kind: 'FACULTY_UNAVAILABLE',
            roomIds: [],
            facultyIds: selectedFacultyIds,
            onDate: targetDate,
            startTime,
            endTime,
            reason: reason || 'Faculty Casual / Medical / Duty Leave',
          })
        );
      }

      // 4. If Lab Hours Adjustment Rule was chosen, create the corresponding room policy override
      if (selectedLabRule) {
        promises.push(
          api.createRoomRule({
            onDate: targetDate,
            level: selectedLabRule === 'ALL' ? undefined : (selectedLabRule === 'SE' ? 'SY' : 'TY'),
            layout: 'ONE_ROOM_PER_BATCH',
            allowRoomTypes: 'CLASSROOM',
            sessionType: 'LAB',
            reason: 'Lab Hours Adjustment Rule: Conduct practicals in classrooms as theory lectures',
          }).catch((ruleErr) => {
            console.warn('Note: Room rule creation returned:', ruleErr);
          })
        );
      }

      await Promise.all(promises);

      const parts: string[] = [];
      if (unavailCount > 0) parts.push(`${unavailCount} closed room(s)`);
      if (extraCount > 0) parts.push(`${extraCount} temporary extra room(s)`);
      if (facCount > 0) parts.push(`${facCount} absent faculty`);
      setFeedbackMsg(`Successfully logged ${parts.join(', ')} for ${targetDate}!`);

      // Reset selections
      setSelectedUnavailableRoomIds([]);
      setSelectedExtraRoomIds([]);
      setSelectedFacultyIds([]);
      setSelectedLabRule(null);
      setReason('T&P activity / Maintenance');
      await loadData();
    } catch (err: any) {
      alert('Failed to log disruptions: ' + (err.response?.data?.message || err.message));
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
      setSelectedUnavailableRoomIds([]);
      setSelectedExtraRoomIds([]);
      setSelectedFacultyIds([]);
      await loadData();
    } catch (err: any) {
      alert('Failed to reset day: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsClearing(false);
    }
  };

  // Pre-existing computer department rooms (excluding temporary extra rooms)
  const departmentRooms = useMemo(() => {
    return rooms.filter((r) => !r.isTemporary);
  }, [rooms]);

  // Temporary extra rooms (external or newly added)
  const temporaryExtraRooms = useMemo(() => {
    return rooms.filter((r) => r.isTemporary || r.roomType === 'OTHER' || selectedExtraRoomIds.includes(r.id));
  }, [rooms, selectedExtraRoomIds]);

  // Filtered department rooms
  const filteredDepartmentRooms = useMemo(() => {
    return departmentRooms.filter((r) => {
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
  }, [departmentRooms, roomCategoryFilter, roomSearch]);

  // Filtered faculty
  const filteredFaculty = useMemo(() => {
    return faculty.filter((f) => {
      if (!facultySearch.trim()) return true;
      const q = facultySearch.toLowerCase();
      return f.code.toLowerCase().includes(q) || (f.fullName && f.fullName.toLowerCase().includes(q));
    });
  }, [faculty, facultySearch]);

  const totalSelectedCount = selectedUnavailableRoomIds.length + selectedExtraRoomIds.length + selectedFacultyIds.length;

  const submitButtonLabel = useMemo(() => {
    const unavail = selectedUnavailableRoomIds.length;
    const extra = selectedExtraRoomIds.length;
    const fac = selectedFacultyIds.length;
    const total = unavail + extra + fac;

    if (total === 0) return 'Log Disruptions (0 Selected)';
    if (activeTab === 'ROOMS') {
      if (unavail > 0 && extra > 0) return `Log Disruptions (${unavail} Closed, ${extra} Extra Available)`;
      if (unavail > 0) return `Log Room Closures (${unavail} Selected)`;
      if (extra > 0) return `Log Extra Venues (${extra} Available)`;
    } else {
      if (fac > 0) return `Log Faculty Leave (${fac} Absent)`;
    }
    return `Log Disruptions (${total} Selected)`;
  }, [selectedUnavailableRoomIds, selectedExtraRoomIds, selectedFacultyIds, activeTab]);

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
            Specify rooms undergoing maintenance, add temporary extra campus venues (seminar halls, auditoriums, outside labs), or faculty on leave. Configure both room closures and extra rooms at once!
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: UNIFIED DISRUPTION MANAGEMENT (NO DROPDOWNS) */}
      <div className="bg-surface border border-border rounded-xl shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              1
            </div>
            <h2 className="text-base font-semibold text-ink">Choose Disruption Category</h2>
          </div>
          <span className="text-xs text-muted">Step 1 of 4</span>
        </div>

        {/* Unified Category Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Unified Room & Venue Availability (Unavailable Rooms + Extra Rooms) */}
          <button
            type="button"
            onClick={() => setActiveTab('ROOMS')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              activeTab === 'ROOMS'
                ? 'border-primary bg-primary-tint/30 shadow-xs'
                : 'border-border bg-canvas/30 hover:bg-surface hover:border-muted/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <span className="text-muted text-xs font-bold">+</span>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              {activeTab === 'ROOMS' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary text-white">
                  Active
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-ink flex items-center gap-2">
                Room & Lab Availability Management
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted">
                  Unified Mode
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                Mark computer department rooms unavailable <strong>AND</strong> add temporary extra rooms (seminar halls, auditoriums, outside labs) for the day at once.
              </p>
            </div>
          </button>

          {/* Card B: Faculty on Leave */}
          <button
            type="button"
            onClick={() => setActiveTab('FACULTY')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
              activeTab === 'FACULTY'
                ? 'border-primary bg-primary-tint/30 shadow-xs'
                : 'border-border bg-canvas/30 hover:bg-surface hover:border-muted/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                <UserX className="w-5 h-5" />
              </div>
              {activeTab === 'FACULTY' && (
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
        </div>

        {/* SECTION 2: TARGET SELECTION INTERFACE */}
        {activeTab === 'ROOMS' ? (
          <div className="space-y-6 pt-2">
            {/* PART 2A: UNAVAILABLE DEPARTMENT ROOMS / LABS */}
            <div className="p-5 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    2A
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Mark Department Room(s) / Lab(s) as Unavailable
                    </h3>
                    <p className="text-[11px] text-muted">
                      Click to toggle rooms undergoing maintenance, exams, or power outages.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    {selectedUnavailableRoomIds.length} closed
                  </span>
                  {selectedUnavailableRoomIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUnavailableRoomIds([])}
                      className="text-[11px] text-rose-700 hover:text-rose-900 font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Filter and Search controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border">
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
                    All Venues ({departmentRooms.length})
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
                    Classrooms ({departmentRooms.filter((r) => r.roomType === 'CLASSROOM').length})
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
                    Computer Labs ({departmentRooms.filter((r) => r.roomType === 'LAB').length})
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
                    onClick={() => handleToggleAllFilteredRooms(filteredDepartmentRooms)}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-ink hover:bg-canvas"
                  >
                    {filteredDepartmentRooms.every((r) => selectedUnavailableRoomIds.includes(r.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Grid of Department Room Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-60 overflow-y-auto p-1">
                {filteredDepartmentRooms.map((room) => {
                  const isSelected = selectedUnavailableRoomIds.includes(room.id);
                  return (
                    <div
                      key={room.id}
                      onClick={() => toggleUnavailableRoom(room.id)}
                      className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-600 bg-amber-100/70 shadow-xs ring-2 ring-amber-500'
                          : 'border-border bg-surface hover:bg-canvas/60 hover:border-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-sm text-ink">{room.code}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-amber-600 border-amber-600 text-white'
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

              {/* Quick Action Preset: Cancel Lab Sessions & Adjust to Theory Lectures */}
              <div
                className={`p-3.5 border rounded-xl transition-all ${
                  selectedLabRule
                    ? 'bg-amber-50 border-amber-400 shadow-xs'
                    : 'bg-surface border-border'
                } space-y-2 text-xs`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-semibold text-ink">
                      <strong>Lab Hours Adjustment Rule:</strong> Convert disrupted practicals into theory lectures in classrooms.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedLabRule ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-600 text-white shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Active: {selectedLabRule === 'ALL' ? 'All Labs' : `${selectedLabRule} Labs`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-canvas border border-border text-muted">
                        Normal Mode (Inactive)
                      </span>
                    )}

                    {selectedLabRule !== null && (
                      <button
                        type="button"
                        onClick={handleClearLabRule}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-red-50 text-red-700 border border-red-300 text-xs font-semibold transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Clear Rule
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectLabRule('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      selectedLabRule === 'ALL'
                        ? 'bg-amber-600 text-white shadow-xs'
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
                        ? 'bg-amber-600 text-white shadow-xs'
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
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-surface hover:bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {selectedLabRule === 'TE' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    Cancel TE Labs
                  </button>
                </div>
              </div>
            </div>

            {/* PART 2B: TEMPORARY EXTRA ROOMS & EXTERNAL VENUES */}
            <div className="p-5 rounded-xl border border-emerald-200/80 bg-emerald-50/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    2B
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Temporary Extra Room(s) & External Campus Venues Available
                    </h3>
                    <p className="text-[11px] text-muted">
                      Add seminar halls, auditoriums, drawing halls, or outside department labs available for {targetDate}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {selectedExtraRoomIds.length} extra room(s) active
                  </span>
                  {selectedExtraRoomIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedExtraRoomIds([])}
                      className="text-[11px] text-rose-700 hover:text-rose-900 font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* 1-Click Campus Venue Presets */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-ink">Quick Campus Presets (Click to add):</span>
                <div className="flex flex-wrap gap-2">
                  {campusVenuePresets.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => handleAddExtraRoom(preset.code, preset.name, preset.roomType, preset.capacity)}
                      className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-surface hover:bg-emerald-100/60 text-emerald-900 text-xs font-medium flex items-center gap-1.5 transition shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      {preset.code} ({preset.name.split(' ')[0]} · Cap: {preset.capacity})
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Extra Room Entry Form */}
              <div className="bg-surface p-4 rounded-xl border border-emerald-200 shadow-xs space-y-3">
                <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Warehouse className="w-4 h-4 text-emerald-700" /> Add Other External Room / Hall / Lab:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Room / Hall Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SEM-HALL-1"
                      value={newExtraCode}
                      onChange={(e) => setNewExtraCode(e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-canvas/30 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="text-[10px] font-bold text-muted uppercase">Venue Name / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Central Seminar Hall (Ground Floor)"
                      value={newExtraName}
                      onChange={(e) => setNewExtraName(e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-canvas/30 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Venue Type</label>
                    <select
                      value={newExtraType}
                      onChange={(e) => setNewExtraType(e.target.value as any)}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-canvas/30 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="OTHER">Seminar Hall / Auditorium (Other)</option>
                      <option value="CLASSROOM">Classroom / Lecture Hall</option>
                      <option value="LAB">Computer / Practical Lab</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted uppercase">Seating Capacity</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        value={newExtraCapacity}
                        onChange={(e) => setNewExtraCapacity(parseInt(e.target.value) || 60)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-canvas/30 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        disabled={isAddingExtraRoom || !newExtraCode.trim() || !newExtraName.trim()}
                        onClick={() => handleAddExtraRoom(newExtraCode, newExtraName, newExtraType, newExtraCapacity)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition disabled:opacity-40 cursor-pointer shadow-xs"
                      >
                        {isAddingExtraRoom ? 'Adding...' : '+ Add'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid of Selected & Available Temporary Extra Rooms */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-ink flex items-center justify-between">
                  <span>Available External Venues for Today:</span>
                  <span className="text-[11px] text-muted">Click any venue card to toggle on/off for solver allocation</span>
                </div>

                {temporaryExtraRooms.length === 0 ? (
                  <div className="p-4 bg-surface rounded-xl border border-dashed border-emerald-300 text-center text-xs text-muted">
                    No extra rooms configured yet. Use the quick presets above or enter a venue to add one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {temporaryExtraRooms.map((room) => {
                      const isSelected = selectedExtraRoomIds.includes(room.id);
                      return (
                        <div
                          key={room.id}
                          onClick={() => toggleExtraRoom(room.id)}
                          className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-100/70 shadow-xs ring-2 ring-emerald-500'
                              : 'border-border bg-surface hover:bg-canvas/60 hover:border-muted'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-bold text-sm text-ink">{room.code}</span>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-border bg-surface'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="text-[11px] font-semibold text-ink truncate" title={room.name}>
                              {room.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">
                                {room.roomType}
                              </span>
                              <span className="text-[10px] text-muted">Cap: {room.capacity}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* SECTION 2: FACULTY SELECTION INTERFACE */
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  2
                </div>
                <h2 className="text-base font-semibold text-ink">
                  Select Absent Faculty Member(s) — Click one or multiple
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-tint text-primary border border-primary/20">
                {selectedFacultyIds.length} faculty selected
              </span>
            </div>

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

            {/* Grid of Faculty Cards */}
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
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
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
              'T&P Placement Drive / Activity',
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
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
              Pre-validation active:{' '}
              {selectedUnavailableRoomIds.length > 0 && (
                <strong className="text-amber-800 mr-1">{selectedUnavailableRoomIds.length} closed room(s)</strong>
              )}
              {selectedExtraRoomIds.length > 0 && (
                <strong className="text-emerald-800 mr-1">{selectedExtraRoomIds.length} extra room(s)</strong>
              )}
              {selectedFacultyIds.length > 0 && (
                <strong className="text-rose-800 mr-1">{selectedFacultyIds.length} absent faculty</strong>
              )}
              {totalSelectedCount === 0 && '0 selected'} on {targetDate}.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedUnavailableRoomIds([]);
                setSelectedExtraRoomIds([]);
                setSelectedFacultyIds([]);
              }}
              className="px-3 py-2 text-xs font-medium text-muted hover:text-ink cursor-pointer"
            >
              Clear Selections
            </button>

            <button
              type="button"
              disabled={isSubmitting || totalSelectedCount === 0}
              onClick={handleBulkSubmit}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                totalSelectedCount === 0
                  ? 'bg-muted/40 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>Logging...</>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {submitButtonLabel}
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
            <h2 className="text-sm font-bold text-ink">Active Disruptions & Extra Venues Logged for {targetDate}</h2>
            <p className="text-xs text-muted mt-0.5">
              These will be fed directly to the Rescheduling CP-SAT Solver.
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
                className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
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
                        {d.kind === 'EXTRA_ROOM'
                          ? `Extra Venue Available: Room ${d.roomCode}`
                          : d.roomCode
                          ? `Closed Room: ${d.roomCode}`
                          : d.facultyCode
                          ? `Faculty: Prof. ${d.facultyCode}`
                          : 'Facility'}
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
                        {d.kind === 'EXTRA_ROOM' ? 'EXTRA ROOM AVAILABLE' : d.kind.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                      <span className="flex items-center gap-1 font-mono">
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
                    className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
                className="px-3 py-1.5 text-xs text-muted hover:text-ink cursor-pointer"
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
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover cursor-pointer"
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
