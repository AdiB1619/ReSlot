import axios from 'axios';
import {
  MasterGridResponse,
  Disruption,
  PlanSummary,
  ScheduleOverride,
  NotificationJob,
  AuditLogItem,
  ClashReport,
  RoomItem,
  FacultyItem,
  StudentGroupItem,
  User,
  EffectiveTimetableResponse,
} from '../types';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reslot_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('reslot_token');
      localStorage.removeItem('reslot_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // --- Auth & Identity ---
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await apiClient.post('/auth/login', { email, password });
    const token = res.data?.token || res.data?.accessToken;
    let user = res.data?.user;
    if (token) {
      localStorage.setItem('reslot_token', token);
      if (!user) {
        const meRes = await apiClient.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        user = meRes.data;
      }
      localStorage.setItem('reslot_user', JSON.stringify(user));
    }
    return { token, user };
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('reslot_token');
      localStorage.removeItem('reslot_user');
    }
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', { oldPassword, newPassword });
  },

  // --- Users Management (Admin) ---
  async getUsers(): Promise<User[]> {
    const res = await apiClient.get('/users');
    return res.data;
  },

  async createUser(payload: { email: string; password: string; fullName: string; role: string; facultyId?: number; groupId?: number }): Promise<User> {
    const res = await apiClient.post('/users', payload);
    return res.data;
  },

  async updateUser(id: number, payload: Partial<User & { password?: string }>): Promise<User> {
    const res = await apiClient.put(`/users/${id}`, payload);
    return res.data;
  },

  async deleteUser(id: number): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },

  // --- System ---
  async ping(): Promise<{ status: string; service: string }> {
    const res = await apiClient.get('/ping');
    return res.data;
  },

  // --- Master Timetable ---
  async getMasterTimetable(): Promise<MasterGridResponse> {
    const res = await apiClient.get('/timetable/master');
    return res.data;
  },

  async getTimetableVersions(): Promise<Array<{ id: number; name: string; status: string }>> {
    const res = await apiClient.get('/timetable/versions');
    return res.data;
  },

  // --- Effective Timetable & Exports ---
  async getEffectiveTimetable(params?: { date?: string; groupId?: number; facultyId?: number; roomId?: number }): Promise<EffectiveTimetableResponse> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.groupId) query.set('groupId', params.groupId.toString());
    if (params?.facultyId) query.set('facultyId', params.facultyId.toString());
    if (params?.roomId) query.set('roomId', params.roomId.toString());
    const res = await apiClient.get(`/timetable/effective?${query.toString()}`);
    return res.data;
  },

  async getMyTimetable(date?: string): Promise<EffectiveTimetableResponse> {
    const query = date ? `?date=${date}` : '';
    const res = await apiClient.get(`/timetable/me${query}`);
    return res.data;
  },

  exportExcelUrl(date?: string): string {
    return `/api/v1/timetable/export/excel${date ? `?date=${date}` : ''}`;
  },

  exportPdfUrl(date?: string): string {
    return `/api/v1/timetable/export/pdf${date ? `?date=${date}` : ''}`;
  },

  exportIcsUrl(date?: string): string {
    return `/api/v1/timetable/export/ics${date ? `?date=${date}` : ''}`;
  },

  // --- Resources ---
  async getRooms(): Promise<RoomItem[]> {
    const res = await apiClient.get('/rooms');
    return res.data;
  },

  async getFaculty(): Promise<FacultyItem[]> {
    const res = await apiClient.get('/faculty');
    return res.data;
  },

  async getStudentGroups(): Promise<StudentGroupItem[]> {
    const res = await apiClient.get('/student-groups');
    return res.data;
  },

  // --- Disruptions ---
  async getDisruptions(date?: string): Promise<Disruption[]> {
    const params = date ? `?date=${date}` : '';
    const res = await apiClient.get(`/disruptions${params}`);
    return res.data;
  },

  async createDisruption(disruption: Partial<Disruption>): Promise<Disruption> {
    const res = await apiClient.post('/disruptions', disruption);
    return res.data;
  },

  async createBulkDisruptions(payload: any): Promise<{ count: number; disruptions: Disruption[] }> {
    const res = await apiClient.post('/disruptions/bulk', payload);
    return res.data;
  },

  async deleteDisruption(id: number): Promise<void> {
    await apiClient.delete(`/disruptions/${id}`);
  },

  async resetDay(date?: string): Promise<{ date: string; clearedCount: number; message: string }> {
    const params = date ? `?date=${date}` : '';
    const res = await apiClient.post(`/disruptions/reset-day${params}`);
    return res.data;
  },

  async clearAllBroadcasts(date?: string): Promise<void> {
    const params = date ? `?date=${date}` : '';
    await apiClient.delete(`/notifications/broadcasts${params}`);
  },

  // --- Timetable File Upload & Import ---
  async uploadTimetableFile(formData: FormData): Promise<any> {
    const res = await apiClient.post('/imports/timetable-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async activateTimetableVersion(versionId: number): Promise<void> {
    await apiClient.post(`/imports/versions/${versionId}/activate`);
  },

  // --- Room Rules ---
  async getRoomRules(date: string): Promise<any[]> {
    const res = await apiClient.get(`/room-rules?date=${date}`);
    return res.data;
  },

  async createRoomRule(rule: any): Promise<any> {
    const res = await apiClient.post('/room-rules', rule);
    return res.data;
  },

  async deleteRoomRule(id: number): Promise<void> {
    await apiClient.delete(`/room-rules/${id}`);
  },

  async checkCapacity(roomId: number, groupId: number): Promise<any> {
    const res = await apiClient.post('/room-rules/precheck', { roomId, groupId });
    return res.data;
  },

  // --- Analytics ---
  async getAnalyticsOverview(): Promise<{
    totalSessions: number;
    lectureCount: number;
    labCount: number;
    tutorialCount: number;
    totalRooms: number;
    totalFaculty: number;
    totalRuns: number;
    zeroNewClashRate: number;
    roomUtilization: Array<{ roomName: string; utilizationPercent: number; bookedHours: number; capacityHours: number }>;
    dayDistribution: Array<{ day: string; lectures: number; labs: number }>;
  }> {
    const res = await apiClient.get('/analytics/overview');
    return res.data;
  },

  // --- Conflicts ---
  async getBaselineClashes(): Promise<ClashReport[]> {
    const res = await apiClient.get('/conflicts/baseline');
    return res.data;
  },

  // --- Rescheduling Runs & Plans ---
  async triggerReschedule(onDate: string): Promise<{ runId: number }> {
    const res = await apiClient.post('/reschedule/runs', { onDate });
    return res.data;
  },

  async getRuns(): Promise<PlanSummary[]> {
    const res = await apiClient.get('/reschedule/runs');
    return res.data;
  },

  async getPlans(date?: string): Promise<PlanSummary[]> {
    const params = date ? `?date=${date}` : '';
    const res = await apiClient.get(`/plans${params}`);
    return res.data;
  },

  async getPublishedPlan(date?: string): Promise<PlanSummary | null> {
    const params = date ? `?date=${date}` : '';
    try {
      const res = await apiClient.get(`/plans/published${params}`);
      return res.data || null;
    } catch {
      return null;
    }
  },

  async getPlan(planId: number): Promise<PlanSummary> {
    const res = await apiClient.get(`/plans/${planId}`);
    return res.data;
  },

  async getPlanOverrides(planId: number): Promise<ScheduleOverride[]> {
    const res = await apiClient.get(`/plans/${planId}/overrides`);
    return res.data;
  },

  async approvePlan(planId: number, remarks?: string): Promise<void> {
    await apiClient.post(`/plans/${planId}/approve`, { remarks });
  },

  async rejectPlan(planId: number, reason?: string): Promise<void> {
    await apiClient.post(`/plans/${planId}/reject`, { reason });
  },

  async publishPlan(planId: number): Promise<void> {
    await apiClient.post(`/plans/${planId}/publish`);
  },

  async getRunOverrides(runId: number): Promise<ScheduleOverride[]> {
    const res = await apiClient.get(`/reschedule/runs/${runId}/overrides`);
    return res.data;
  },

  // --- Notifications & Broadcasts ---
  async getNotifications(): Promise<NotificationJob[]> {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  async getBroadcastDrafts(date?: string): Promise<any[]> {
    const params = date ? `?date=${date}` : '';
    const res = await apiClient.get(`/notifications/broadcasts${params}`);
    return res.data;
  },

  async dispatchNotifications(): Promise<void> {
    await apiClient.post('/notifications/dispatch');
  },

  // --- Audit Logs ---
  async getAuditLogs(): Promise<AuditLogItem[]> {
    const res = await apiClient.get('/audit-logs');
    return res.data;
  },

  // --- AI Assistant ---
  async askAi(query: string, apiKey?: string, model?: string): Promise<{
    answer: string;
    recommendations: string[];
    suggestedActions: string[];
    mode: string;
  }> {
    const res = await apiClient.post('/ai/suggest', { query, apiKey, model }, {
      timeout: 60000,
    });
    return res.data;
  },
};
