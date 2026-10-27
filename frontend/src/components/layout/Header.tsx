import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Wifi, WifiOff } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ selectedDate, onDateChange }) => {
  const { user } = useAuth();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [versionName, setVersionName] = useState<string>('Loading…');

  useEffect(() => {
    api.ping()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));

    api.getTimetableVersions()
      .then((versions) => {
        const active = versions.find((v) => v.status === 'ACTIVE');
        setVersionName(active ? active.name : versions[0]?.name ?? 'No active version');
      })
      .catch(() => setVersionName('Not connected'));
  }, []);

  return (
    <header className="h-16 px-6 border-b border-border bg-surface flex items-center justify-between shrink-0 shadow-xs">
      {/* Left: Department info */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col justify-center">
          <h1 className="text-sm font-bold text-ink leading-snug">
            Department of Computer Engineering
          </h1>
          <p className="text-[11px] text-muted leading-tight">JSPM's Rajarshi Shahu College of Engineering, Pune</p>
        </div>

        {/* Active master version badge */}
        <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-border">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {versionName} — Read-Only Active Master
          </span>
        </div>
      </div>

      {/* Right: date picker + API status */}
      <div className="flex items-center gap-3">
        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-canvas px-3 py-1.5 rounded-lg border border-border text-xs text-ink font-medium">
          <CalendarIcon className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted hidden sm:inline">Target Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent text-ink font-semibold focus:outline-none cursor-pointer"
          />
        </div>

        {/* API Status */}
        <div
          title={apiOnline === null ? 'Checking API…' : apiOnline ? 'Backend API connected' : 'Backend API offline'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
            apiOnline === null
              ? 'border-border bg-canvas text-muted'
              : apiOnline
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {apiOnline === true ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {apiOnline === null ? 'Connecting…' : apiOnline ? 'API Online' : 'API Offline'}
          </span>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20 text-xs font-bold">
          {user?.fullName || 'User'} ({user?.role || 'COORDINATOR'})
        </div>
      </div>
    </header>
  );
};
