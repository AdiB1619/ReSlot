import React, { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, Navigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';

export interface AiChatMessage {
  sender: 'user' | 'ai';
  text: string;
  recs?: string[];
  actions?: string[];
  mode?: string;
}

const defaultInitialAiMessages: AiChatMessage[] = [
  {
    sender: 'ai',
    text: 'Hello! I am your ReSlot AI Assistant powered by Google Gemini. I can analyze the active master timetable, evaluate vacant laboratories, suggest qualified proxy faculty, and explain Pareto blast-radius tradeoffs. All suggestions are strictly propose-only and require Coordinator verification before publication.',
    recs: [
      'Ask about free computer laboratories on Thursday morning',
      'Suggest proxy faculty candidates for Prof. SW on leave',
      'Compare Plan A and Plan B blast radius metrics',
      'Verify room capacity for SE-B practical batch',
    ],
    actions: ['Open Plan Builder', 'View Baseline Clashes'],
    mode: 'AI_ASSISTANT',
  },
];

interface AppContextType {
  targetDate: string;
  setTargetDate: (d: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  aiMessages: AiChatMessage[];
  setAiMessages: React.Dispatch<React.SetStateAction<AiChatMessage[]>>;
  resetAiMessages: () => void;
}

const today = new Date().toISOString().split('T')[0];

export const AppContext = createContext<AppContextType>({
  targetDate: today,
  setTargetDate: () => {},
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  toggleSidebar: () => {},
  aiMessages: defaultInitialAiMessages,
  setAiMessages: () => {},
  resetAiMessages: () => {},
});

export const useApp = () => useContext(AppContext);

export const AppLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromQuery = searchParams.get('date');

  const [targetDate, setTargetDateState] = useState<string>(() => {
    return dateFromQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery) ? dateFromQuery : today;
  });

  useEffect(() => {
    if (dateFromQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery) && dateFromQuery !== targetDate) {
      setTargetDateState(dateFromQuery);
    }
  }, [dateFromQuery]);

  const setTargetDate = (d: string) => {
    setTargetDateState(d);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('date', d);
      return next;
    }, { replace: true });
  };
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>(defaultInitialAiMessages);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('reslot_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const resetAiMessages = () => {
    setAiMessages(defaultInitialAiMessages);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('reslot_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted font-medium">Loading ReSlot Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppContext.Provider
      value={{
        targetDate,
        setTargetDate,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        aiMessages,
        setAiMessages,
        resetAiMessages,
      }}
    >
      <div className="flex h-screen bg-canvas overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header selectedDate={targetDate} onDateChange={setTargetDate} />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
};
