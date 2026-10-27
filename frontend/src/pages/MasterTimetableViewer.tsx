import React, { useEffect, useState, useRef } from 'react';
import {
  Calendar,
  Filter,
  Download,
  Clock,
  Search,
  FileSpreadsheet,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  RefreshCw,
  Building,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import { MasterGridResponse, SessionCell, RoomItem, FacultyItem, TimetableParseReport } from '../types';

export const MasterTimetableViewer: React.FC = () => {
  const [gridData, setGridData] = useState<MasterGridResponse | null>(null);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [faculty, setFaculty] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState<string>('2026-27');
  const [semester, setSemester] = useState<string>('SEM-I');
  const [versionName, setVersionName] = useState<string>('A.Y. 2026-27 SEM-I Uploaded Master');
  const [activateImmediately, setActivateImmediately] = useState<boolean>(true);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadReport, setUploadReport] = useState<TimetableParseReport | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadTimetable();
  }, []);

  async function loadTimetable() {
    setLoading(true);
    try {
      const [g, r, f] = await Promise.all([
        api.getMasterTimetable(),
        api.getRooms(),
        api.getFaculty(),
      ]);
      setGridData(g);
      setRooms(r);
      setFaculty(f);
    } catch (err) {
      console.error('Failed to load master timetable', err);
    } finally {
      setLoading(false);
    }
  }

  const daysOfWeek = [
    { id: 1, name: 'Monday' },
    { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' },
    { id: 4, name: 'Thursday' },
    { id: 5, name: 'Friday' },
    { id: 6, name: 'Saturday' },
  ];

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please choose a PDF, Excel (.xlsx/.xls), or CSV timetable file.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadReport(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('academicYear', academicYear);
    formData.append('semester', semester);
    formData.append('versionName', versionName);
    formData.append('activateImmediately', String(activateImmediately));

    try {
      const report = await api.uploadTimetableFile(formData);
      setUploadReport(report);
      // Refresh active timetable grid
      await loadTimetable();
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to upload and parse timetable file');
    } finally {
      setUploadLoading(false);
    }
  };

  // Helper to normalize division/group filters so SE matches SY, TE matches TY
  const normalizeGroup = (str: string) =>
    str
      .toUpperCase()
      .replace(/\bSE-?/g, 'SY-')
      .replace(/\bTE-?/g, 'TY-')
      .replace(/\bSE\b/g, 'SY')
      .replace(/\bTE\b/g, 'TY')
      .trim();

  const matchesGroupFilter = (groupName: string, selectedFilter: string): boolean => {
    if (selectedFilter === 'ALL') return true;
    const normFilter = normalizeGroup(selectedFilter);
    const normGroup = normalizeGroup(groupName);
    return normGroup.includes(normFilter) || normFilter.includes(normGroup);
  };

  const formatGroupLabel = (groupName: string): string => {
    return groupName.replace(/\bSY-/g, 'SE-').replace(/\bTY-/g, 'TE-');
  };

  const filterSessions = (sessions: SessionCell[] = []) => {
    return sessions.filter((s) => {
      if (selectedGroup !== 'ALL') {
        const hasGroup = s.groups.some((g) => matchesGroupFilter(g.name, selectedGroup));
        if (!hasGroup) return false;
      }
      if (selectedFaculty !== 'ALL') {
        const hasFac = s.faculty.some((f) => f.code === selectedFaculty);
        if (!hasFac) return false;
      }
      if (selectedRoom !== 'ALL') {
        if (s.roomCode !== selectedRoom) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const normQ = normalizeGroup(q).toLowerCase();
        const match =
          s.subjectCode.toLowerCase().includes(q) ||
          (s.subjectName && s.subjectName.toLowerCase().includes(q)) ||
          (s.roomCode && s.roomCode.toLowerCase().includes(q)) ||
          s.faculty.some((f) => (f.fullName && f.fullName.toLowerCase().includes(q)) || f.code.toLowerCase().includes(q)) ||
          s.groups.some((g) => {
            const gLower = g.name.toLowerCase();
            const normGLower = normalizeGroup(g.name).toLowerCase();
            return gLower.includes(q) || normGLower.includes(normQ) || gLower.includes(normQ);
          });
        if (!match) return false;
      }
      return true;
    });
  };

  const getCellBg = (type: string) => {
    switch (type) {
      case 'LECTURE':
        return 'bg-[#E8EEF7] border-[#B9C7E0] text-[#1E3A8A]';
      case 'LAB':
        return 'bg-[#E6F3EE] border-[#A9D3C0] text-[#065F46]';
      case 'TUTORIAL':
        return 'bg-[#F3EAF7] border-[#D0B8DD] text-[#6B21A8]';
      default:
        return 'bg-[#EFEFEF] border-[#D4D4D4] text-[#374151]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Master Timetable</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {gridData?.versionName || 'Active Master'} (Read-Only)
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Department of Computer Engineering • JSPM's RSCOE Tathawade • Active Baseline Schedule
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* UPLOAD BUTTON */}
          <button
            onClick={() => {
              setUploadReport(null);
              setUploadError(null);
              setShowUploadModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover flex items-center gap-2 shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Semester Timetable
          </button>

          <button
            onClick={() => alert('Exporting Master Timetable as official PDF format...')}
            className="px-3 py-2 rounded-lg bg-surface border border-border hover:bg-canvas text-xs font-semibold text-ink flex items-center gap-1.5 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={() => alert('Exporting Master Timetable as Excel (.xlsx)...')}
            className="px-3 py-2 rounded-lg bg-surface border border-border hover:bg-canvas text-xs font-semibold text-ink flex items-center gap-1.5 transition shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel
          </button>
        </div>
      </div>

      {/* Filter Toolbar (No dropdowns where possible, select for large lists) */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-ink">
            <Filter className="w-3.5 h-3.5 text-primary" /> Filter Master Matrix
          </div>
          <button
            onClick={() => {
              setSelectedGroup('ALL');
              setSelectedFaculty('ALL');
              setSelectedRoom('ALL');
              setSelectedDay('ALL');
              setSearchQuery('');
            }}
            className="text-[11px] text-muted hover:text-ink font-medium"
          >
            Reset Filters
          </button>
        </div>

        {/* Division Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-muted mr-1">Quick Division:</span>
          {['ALL', 'SE-A', 'SE-B', 'SE-C', 'TE-A', 'TE-B', 'TE-C', 'BE-A', 'BE-B'].map((grp) => (
            <button
              key={grp}
              onClick={() => setSelectedGroup(grp)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedGroup === grp
                  ? 'bg-primary text-white shadow-xs font-semibold'
                  : 'bg-canvas text-ink hover:bg-surface border border-border'
              }`}
            >
              {grp === 'ALL' ? 'All Divisions' : grp}
            </button>
          ))}
        </div>

        {/* Day Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-muted mr-1">Day of Week:</span>
          <button
            onClick={() => setSelectedDay('ALL')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              selectedDay === 'ALL'
                ? 'bg-ink text-white font-semibold'
                : 'bg-canvas text-ink hover:bg-surface border border-border'
            }`}
          >
            All Days (Mon-Sat)
          </button>
          {daysOfWeek.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedDay === d.id
                  ? 'bg-ink text-white font-semibold'
                  : 'bg-canvas text-ink hover:bg-surface border border-border'
              }`}
            >
              {d.name.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Search & Detail Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search Subject, Code or Faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-canvas border border-border rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Faculty select */}
          <select
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-canvas border border-border rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Faculty Members ({faculty.length})</option>
            {faculty.map((f) => (
              <option key={f.id} value={f.code}>
                {f.code} - {f.fullName}
              </option>
            ))}
          </select>

          {/* Room select */}
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-canvas border border-border rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Rooms & Labs ({rooms.length})</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.code}>
                {r.code} {r.labCode ? `(${r.labCode})` : ''} - {r.roomType}
              </option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-[11px] text-muted">
          <span className="font-semibold text-ink">Session Types:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#E8EEF7] border border-[#B9C7E0]"></span> Lecture (1 hr)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#E6F3EE] border border-[#A9D3C0]"></span> Lab Practical (2 hrs)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#F3EAF7] border border-[#D0B8DD]"></span> Tutorial / Mentoring
          </span>
        </div>
      </div>

      {/* Grid Matrix */}
      {loading ? (
        <div className="p-12 text-center text-sm text-muted">Loading timetable matrix...</div>
      ) : (
        <div className="space-y-6">
          {daysOfWeek
            .filter((d) => selectedDay === 'ALL' || selectedDay === d.id)
            .map((day) => {
              const rawSessions = gridData?.days[day.id] || [];
              const daySessions = filterSessions(rawSessions);

              return (
                <div key={day.id} className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
                  {/* Day Header */}
                  <div className="px-5 py-3 bg-canvas border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-sm text-ink">{day.name}</h3>
                      <span className="text-xs text-muted">({daySessions.length} sessions scheduled)</span>
                    </div>
                  </div>

                  {/* Day Sessions Grid / Cards */}
                  <div className="p-4">
                    {daySessions.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted">
                        No sessions match current filter criteria for {day.name}.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {daySessions.map((session) => (
                          <div
                            key={session.id}
                            className={`p-3.5 rounded-lg border text-xs flex flex-col justify-between transition hover:shadow-xs ${getCellBg(
                              session.sessionType
                            )}`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-sm font-bold tracking-tight">{session.subjectCode}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-white/70 shadow-2xs">
                                  {session.sessionType}
                                </span>
                              </div>
                              <div className="font-medium truncate text-ink" title={session.subjectName}>
                                {session.subjectName}
                              </div>
                            </div>

                            <div className="pt-3 mt-2 border-t border-black/10 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Clock className="w-3 h-3" /> {session.startTime} - {session.endTime}
                                </span>
                                <span className="font-bold px-1.5 py-0.5 rounded bg-white/80">
                                  {session.roomCode || 'TBD'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-ink/80 pt-0.5">
                                <span>
                                  {session.faculty.map((f) => f.code).join(', ') || 'Staff'}
                                </span>
                                <span
                                  className="font-semibold text-primary"
                                  title={session.groups.map((g) => g.name).join(', ')}
                                >
                                  {session.groups.map((g) => formatGroupLabel(g.name)).join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* UPLOAD & AI CLASSIFICATION MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink">Upload Semester Master Timetable</h3>
                  <p className="text-xs text-muted">Supports PDF, Excel (.xlsx, .xls), and CSV timetable formats</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-canvas"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* If parsing completed, show AI classification report */}
            {uploadReport ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Timetable Successfully Analyzed & Activated as Active Master!
                  </div>
                  <p className="text-xs text-emerald-700">
                    File: <strong>{uploadReport.sourceFile}</strong> · Version: <strong>{uploadReport.versionName}</strong> ({uploadReport.academicYear} {uploadReport.semester})
                  </p>
                </div>

                {/* Classification Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-canvas rounded-lg border border-border text-center">
                    <div className="text-xl font-black text-ink">{uploadReport.totalParsedSessions}</div>
                    <div className="text-[11px] text-muted">Parsed Sessions</div>
                  </div>
                  <div className="p-3 bg-canvas rounded-lg border border-border text-center">
                    <div className="text-xl font-black text-ink">{uploadReport.distinctDays}</div>
                    <div className="text-[11px] text-muted">Days Scheduled</div>
                  </div>
                  <div className="p-3 bg-canvas rounded-lg border border-border text-center">
                    <div className="text-xl font-black text-ink">{uploadReport.facultyCount}</div>
                    <div className="text-[11px] text-muted">Faculty Mapped</div>
                  </div>
                  <div className="p-3 bg-canvas rounded-lg border border-border text-center">
                    <div className="text-xl font-black text-ink">{uploadReport.roomCount}</div>
                    <div className="text-[11px] text-muted">Rooms & Labs</div>
                  </div>
                </div>

                {/* AI Classification Summary */}
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    AI & NLP Structural Analysis
                  </div>
                  <p className="text-xs text-indigo-800 leading-relaxed">
                    {uploadReport.aiClassificationSummary}
                  </p>
                </div>

                {/* Sample Sessions Table */}
                {uploadReport.sampleSessions && uploadReport.sampleSessions.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-canvas text-xs font-bold text-ink border-b border-border">
                      Sample Classified Sessions
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-border text-[11px]">
                      {uploadReport.sampleSessions.slice(0, 5).map((s, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-canvas/30">
                          <div>
                            <span className="font-bold text-ink">{s.subjectCode}</span> - {s.subjectName}
                            <span className="text-muted ml-2">({s.sessionType})</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted">
                            <span>{s.roomCode}</span>
                            <span>·</span>
                            <span className="text-primary font-semibold">{s.groups.join(', ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs"
                  >
                    View Active Master Timetable
                  </button>
                </div>
              </div>
            ) : (
              /* Upload Form */
              <form onSubmit={handleFileUpload} className="space-y-4">
                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    uploadFile
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-border hover:border-primary bg-canvas/30 hover:bg-canvas/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }}
                  />

                  {uploadFile ? (
                    <div className="space-y-1">
                      <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto" />
                      <div className="font-bold text-sm text-ink">{uploadFile.name}</div>
                      <div className="text-xs text-muted">
                        {(uploadFile.size / 1024).toFixed(1)} KB · Ready to classify
                      </div>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setUploadFile(null);
                        }}
                        className="text-xs text-rose-600 hover:underline pt-1"
                      >
                        Change file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="w-10 h-10 text-muted mx-auto" />
                      <div className="font-bold text-sm text-ink">
                        Click or drag timetable document here
                      </div>
                      <div className="text-xs text-muted">
                        Official RSCOE timetable sheets in PDF, Excel (.xlsx, .xls), or CSV
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Academic Year</label>
                    <div className="flex gap-2">
                      {['2026-27', '2027-28'].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setAcademicYear(yr)}
                          className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                            academicYear === yr
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-surface text-ink border-border hover:bg-canvas'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Semester</label>
                    <div className="flex gap-2">
                      {['SEM-I', 'SEM-II'].map((sem) => (
                        <button
                          key={sem}
                          type="button"
                          onClick={() => setSemester(sem)}
                          className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                            semester === sem
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-surface text-ink border-border hover:bg-canvas'
                          }`}
                        >
                          {sem}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Master Timetable Label</label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="e.g. A.Y. 2026-27 Sem I (Final Approved)"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Instant Activation Toggle */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={activateImmediately}
                    onChange={(e) => setActivateImmediately(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                  />
                  <span className="text-xs text-ink font-medium">
                    Activate immediately as active baseline master timetable
                  </span>
                </label>

                {/* Submit button */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={uploadLoading || !uploadFile}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-xs transition-all ${
                      uploadLoading || !uploadFile
                        ? 'bg-muted/50 cursor-not-allowed'
                        : 'bg-primary hover:bg-primary-hover active:scale-[0.98]'
                    }`}
                  >
                    {uploadLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing & Classifying Timetable...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Analyze & Classify Timetable
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
