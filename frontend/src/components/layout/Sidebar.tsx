import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  AlertTriangle,
  Cpu,
  Layers,
  Bot,
  BarChart3,
  MessageSquare,
  PanelLeftClose,
  UploadCloud,
  CheckCircle2,
  FileText,
  Sliders,
  Bell,
  Smartphone,
  Palette,
  LogOut,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { useApp } from './AppLayout';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

interface NavItemConfig {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  roles?: Role[];
}

const allNavItems: NavItemConfig[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Overview & metrics',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/approval-queue',
    label: 'Plan Publishing',
    icon: CheckCircle2,
    description: 'Verify & publish reschedule plans',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/timetable',
    label: 'Master Timetable',
    icon: Calendar,
    description: 'Browse active read-only master',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/master-upload',
    label: 'Master Upload',
    icon: UploadCloud,
    description: 'Upload PDF / Excel master timetable',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/published',
    label: 'Published Schedule',
    icon: Calendar,
    description: 'Date-effective timetable & exports',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/resources',
    label: 'Rooms & Faculty',
    icon: Layers,
    description: 'Reference catalog & capacities',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/disruptions',
    label: 'Disruptions',
    icon: AlertTriangle,
    description: 'Log room & faculty unavailability',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/room-rules',
    label: 'Room Policy Rules',
    icon: Sliders,
    description: 'Division-specific venue constraints',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/plans',
    label: 'Plan Builder',
    icon: Cpu,
    description: 'Trigger solver & review Pareto plans',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/broadcasts',
    label: 'WhatsApp Broadcasts',
    icon: MessageSquare,
    description: 'Published plan notice drafts',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/notifications',
    label: 'Notification Center',
    icon: Bell,
    description: 'Outbox dispatch status',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/audit',
    label: 'Audit Trail',
    icon: FileText,
    description: 'Tamper-evident system activity',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/admin',
    label: 'User Administration',
    icon: Shield,
    description: 'Manage institutional accounts & roles',
    roles: ['ADMIN'],
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'Room utilization & metrics',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/ai-assistant',
    label: 'AI Assistant',
    icon: Bot,
    description: 'Propose-only reasoning engine',
    roles: ['COORDINATOR', 'ADMIN'],
  },
  {
    to: '/gallery',
    label: 'Design System',
    icon: Palette,
    description: 'Component specs & color tokens',
    roles: ['ADMIN'],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed: propCollapsed, onToggle: propOnToggle }) => {
  const app = useApp();
  const { user, logout } = useAuth();
  const collapsed = propCollapsed !== undefined ? propCollapsed : app.sidebarCollapsed;
  const onToggle = propOnToggle !== undefined ? propOnToggle : app.toggleSidebar;

  const userRole: Role = user?.role || 'COORDINATOR';

  // Filter items matching user's role
  const visibleNavItems = allNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'COORDINATOR':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-surface border-r border-border flex flex-col h-screen select-none shrink-0 shadow-sm transition-all duration-300 ease-in-out relative`}
    >
      {/* Branding & Toggle */}
      <div
        className={`h-16 border-b border-border flex items-center bg-header-deep text-white transition-all duration-300 ${
          collapsed ? 'justify-center px-2' : 'px-4 justify-between'
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            title="Click to expand sidebar"
            className="w-full h-full flex items-center justify-center p-1.5 hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <img
              src="/RSCOELogo.png"
              alt="RSCOE Logo"
              className="h-10 w-auto object-contain group-hover:scale-105 transition-transform"
            />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src="/RSCOELogo.png"
                alt="RSCOE Logo"
                className="h-10 w-auto object-contain shrink-0"
              />
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-sm tracking-wide text-white truncate">ReSlot</span>
                <span className="text-[11px] text-white/70 truncate">RSCOE · Comp. Dept</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggle}
              title="Collapse sidebar"
              className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2 py-4' : 'px-3 py-4'} space-y-1`}>
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center justify-between">
            <span>Navigation</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getRoleBadgeColor(userRole)}`}>
              {userRole}
            </span>
          </div>
        )}

        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? `${item.label} — ${item.description}` : item.description}
              className={({ isActive }) =>
                `flex items-center rounded-lg text-sm font-medium transition-colors ${
                  collapsed
                    ? 'justify-center py-2.5 px-0'
                    : 'gap-3 px-3 py-2'
                } ${
                  isActive
                    ? 'bg-primary-tint text-primary font-semibold shadow-xs'
                    : 'text-ink/80 hover:bg-canvas hover:text-ink'
                }`
              }
            >
              <Icon className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0 text-current`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-border bg-canvas/40 text-xs">
        {collapsed ? (
          <button
            type="button"
            onClick={logout}
            title={`Sign out (${user?.fullName || 'User'})`}
            className="w-full flex justify-center p-2 rounded-lg text-muted hover:text-primary hover:bg-primary-tint/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between overflow-hidden">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  {user?.fullName?.charAt(0) || <UserIcon className="w-3.5 h-3.5" />}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-semibold text-xs text-ink truncate">{user?.fullName || 'Active User'}</span>
                  <span className="text-[10px] text-muted truncate">{user?.email || 'user@rscoe.edu.in'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of ReSlot"
                className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-tint/40 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted">
              <span>A.Y. 2026-27 Sem I</span>
              <span className="font-semibold text-primary">v2.1</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
