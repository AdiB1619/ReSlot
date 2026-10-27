import React, { useEffect, useState } from 'react';
import { Layers, Users, DoorOpen, GraduationCap, Phone, Search } from 'lucide-react';
import { api } from '../services/api';
import { RoomItem, FacultyItem, StudentGroupItem } from '../types';

export const ResourcesPage: React.FC = () => {
  const [tab, setTab] = useState<'ROOMS' | 'LABS' | 'FACULTY' | 'GROUPS'>('ROOMS');
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [faculty, setFaculty] = useState<FacultyItem[]>([]);
  const [groups, setGroups] = useState<StudentGroupItem[]>([]);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    async function load() {
      const [r, f, g] = await Promise.all([api.getRooms(), api.getFaculty(), api.getStudentGroups()]);
      setRooms(r);
      setFaculty(f);
      setGroups(g);
    }
    load();
  }, []);

  const classrooms = rooms.filter((r) => r.roomType === 'CLASSROOM');
  const labs = rooms.filter((r) => r.roomType === 'LAB');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-ink">Department Resources & Infrastructure</h2>
        <p className="text-xs text-muted mt-1">
          Reference data for Computer Engineering: classrooms, specialized laboratories, faculty with WhatsApp contacts, and student cohorts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('ROOMS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tab === 'ROOMS' ? 'bg-primary text-white shadow-xs' : 'bg-surface text-ink hover:bg-canvas border border-border'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" /> Classrooms ({classrooms.length})
          </button>
          <button
            onClick={() => setTab('LABS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tab === 'LABS' ? 'bg-primary text-white shadow-xs' : 'bg-surface text-ink hover:bg-canvas border border-border'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Labs ({labs.length})
          </button>
          <button
            onClick={() => setTab('FACULTY')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tab === 'FACULTY' ? 'bg-primary text-white shadow-xs' : 'bg-surface text-ink hover:bg-canvas border border-border'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Faculty Staff ({faculty.length})
          </button>
          <button
            onClick={() => setTab('GROUPS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tab === 'GROUPS' ? 'bg-primary text-white shadow-xs' : 'bg-surface text-ink hover:bg-canvas border border-border'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" /> Student Groups ({groups.length})
          </button>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Classrooms Tab */}
      {tab === 'ROOMS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms
            .filter((c) => c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase()))
            .map((room) => (
              <div key={room.id} className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-primary">{room.code}</span>
                  {room.isTemporary ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Extra Room</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Permanent</span>
                  )}
                </div>
                <div className="font-semibold text-xs text-ink">{room.name}</div>
                <div className="text-xs text-muted flex items-center justify-between pt-2 border-t border-border">
                  <span>Seating Capacity:</span>
                  <span className="font-bold text-ink">{room.capacity} students</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Labs Tab */}
      {tab === 'LABS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {labs
            .filter((l) => l.code.toLowerCase().includes(search.toLowerCase()) || l.name.toLowerCase().includes(search.toLowerCase()) || (l.labCode && l.labCode.toLowerCase().includes(search.toLowerCase())))
            .map((lab) => (
              <div key={lab.id} className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary">{lab.code}</span>
                    {lab.labCode && (
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-primary-tint text-primary">
                        {lab.labCode}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Specialized Lab</span>
                </div>
                <div className="font-semibold text-xs text-ink">{lab.name}</div>
                <div className="text-xs text-muted flex items-center justify-between pt-2 border-t border-border">
                  <span>Workstations / Capacity:</span>
                  <span className="font-bold text-ink">{lab.capacity} seats</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Faculty Tab */}
      {tab === 'FACULTY' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {faculty
            .filter((f) => f.code.toLowerCase().includes(search.toLowerCase()) || f.fullName.toLowerCase().includes(search.toLowerCase()))
            .map((f) => (
              <div key={f.id} className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-primary text-white px-2 py-0.5 rounded">{f.code}</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Active
                  </span>
                </div>
                <div className="font-bold text-sm text-ink">{f.fullName}</div>
                <div className="text-xs text-muted truncate">{f.email}</div>
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" /> WhatsApp:
                  </span>
                  <span className="font-mono font-medium text-ink">{f.whatsappE164 || 'Registered'}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Student Groups Tab */}
      {tab === 'GROUPS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {groups
            .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()) || g.level.toLowerCase().includes(search.toLowerCase()))
            .map((g) => (
              <div key={g.id} className="bg-surface p-4 rounded-xl border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-primary">{g.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-canvas text-muted border border-border">
                    {g.kind}
                  </span>
                </div>
                <div className="text-xs text-muted flex items-center justify-between pt-1">
                  <span>Year Level:</span>
                  <span className="font-semibold text-ink">{g.level}</span>
                </div>
                <div className="text-xs text-muted flex items-center justify-between pt-1 border-t border-border">
                  <span>Strength:</span>
                  <span className="font-bold text-ink">{g.strength} students</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
