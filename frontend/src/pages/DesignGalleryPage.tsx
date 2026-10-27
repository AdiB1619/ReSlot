import React from 'react';
import { Palette, CheckCircle2, AlertTriangle, Flame, ShieldCheck, DoorOpen, Clock } from 'lucide-react';

export const DesignGalleryPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-ink">ReSlot Design System Gallery</h2>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary-tint text-primary border border-primary-border">
            RSCOE Tokens
          </span>
        </div>
        <p className="text-xs text-muted mt-1">
          Brand color tokens, typography scales, timetable cell aesthetics, and status badge components.
        </p>
      </div>

      {/* Brand Color Palette */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-ink flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> RSCOE Brand Color Tokens
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <div className="h-16 rounded-lg bg-primary shadow-xs"></div>
            <div className="text-xs font-bold text-ink">Primary Crimson</div>
            <div className="text-[11px] text-muted font-mono">#9B1C2E</div>
          </div>
          <div className="space-y-1.5">
            <div className="h-16 rounded-lg bg-header-deep shadow-xs"></div>
            <div className="text-xs font-bold text-ink">Header Deep</div>
            <div className="text-[11px] text-muted font-mono">#3F0B15</div>
          </div>
          <div className="space-y-1.5">
            <div className="h-16 rounded-lg bg-primary-hover shadow-xs"></div>
            <div className="text-xs font-bold text-ink">Primary Hover</div>
            <div className="text-[11px] text-muted font-mono">#6F1423</div>
          </div>
          <div className="space-y-1.5">
            <div className="h-16 rounded-lg bg-canvas border border-border shadow-xs"></div>
            <div className="text-xs font-bold text-ink">Warm Canvas</div>
            <div className="text-[11px] text-muted font-mono">#F6F4F3</div>
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-ink flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Lifecycle & Status Badges
        </h3>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ACTIVE MASTER
          </span>
          <span className="px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
            PROPOSED PLAN
          </span>
          <span className="px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200">
            APPROVED PLAN
          </span>
          <span className="px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            PUBLISHED & DISPATCHED
          </span>
          <span className="px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200">
            REJECTED
          </span>
          <span className="px-2.5 py-1 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
            PROPOSE-ONLY SAFE MODE
          </span>
        </div>
      </div>

      {/* Timetable Cell Swatches */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-ink flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Weekly Timetable Cell Variants
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-[#E8EEF7] border-[#B9C7E0] text-[#1E3A8A] text-xs space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span>CS301 (Lecture)</span>
              <span className="bg-white/80 px-1.5 py-0.5 rounded text-[10px]">1 Hour</span>
            </div>
            <div className="font-medium">Data Structures</div>
            <div className="pt-2 border-t border-[#B9C7E0] flex justify-between text-[11px]">
              <span>Room A1-201</span>
              <span className="font-bold">Dr. SRP</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-[#E6F3EE] border-[#A9D3C0] text-[#065F46] text-xs space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span>CS302 (Lab Practical)</span>
              <span className="bg-white/80 px-1.5 py-0.5 rounded text-[10px]">2 Hours</span>
            </div>
            <div className="font-medium">DBMS Practical Batch SA1</div>
            <div className="pt-2 border-t border-[#A9D3C0] flex justify-between text-[11px]">
              <span>Lab A-210 (MLL)</span>
              <span className="font-bold">Prof. NAW</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-[#F3EAF7] border-[#D0B8DD] text-[#6B21A8] text-xs space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span>CS399 (Tutorial)</span>
              <span className="bg-white/80 px-1.5 py-0.5 rounded text-[10px]">Mentoring</span>
            </div>
            <div className="font-medium">Remedial Programming</div>
            <div className="pt-2 border-t border-[#D0B8DD] flex justify-between text-[11px]">
              <span>Room A1-215</span>
              <span className="font-bold">Prof. SSP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
