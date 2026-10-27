import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApprovalQueuePage } from './pages/ApprovalQueuePage';
import { MasterTimetableViewer } from './pages/MasterTimetableViewer';
import { MasterUploadWizard } from './pages/MasterUploadWizard';
import { ResourcesPage } from './pages/ResourcesPage';
import { DisruptionsPage } from './pages/DisruptionsPage';
import { RoomRulesPage } from './pages/RoomRulesPage';
import { PlanBuilderPage } from './pages/PlanBuilderPage';
import { PlanDetailPage } from './pages/PlanDetailPage';
import { PublishedTimetablePage } from './pages/PublishedTimetablePage';
import { BroadcastsPage } from './pages/BroadcastsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { DesignGalleryPage } from './pages/DesignGalleryPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="approval-queue" element={<ApprovalQueuePage />} />
            <Route path="timetable" element={<MasterTimetableViewer />} />
            <Route path="master-upload" element={<MasterUploadWizard />} />
            <Route path="resources" element={<ResourcesPage />} />
            <Route path="disruptions" element={<DisruptionsPage />} />
            <Route path="room-rules" element={<RoomRulesPage />} />
            <Route path="plans" element={<PlanBuilderPage />} />
            <Route path="plans/:id" element={<PlanDetailPage />} />
            <Route path="published" element={<PublishedTimetablePage />} />
            <Route path="broadcasts" element={<BroadcastsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="admin" element={<AdminSettingsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="ai-assistant" element={<AiAssistantPage />} />
            <Route path="portal" element={<Navigate to="/published" replace />} />
            <Route path="gallery" element={<DesignGalleryPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
