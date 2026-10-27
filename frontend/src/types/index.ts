export type Role = 'COORDINATOR' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  mustChangePassword?: boolean;
}

export interface EffectiveSession {
  id: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
  sessionType: string;
  roomCode: string | null;
  faculty: FacultyRef[];
  groups: GroupRef[];
  status: string;
  originalRoomCode?: string;
  originalStartTime?: string;
  originalEndTime?: string;
  changeReason?: string;
}

export interface EffectiveTimetableResponse {
  date: string;
  dayOfWeek: string;
  totalSessions: number;
  sessions: EffectiveSession[];
}

export interface FacultyRef {
  id: number;
  code: string;
  fullName: string;
}

export interface GroupRef {
  id: number;
  name: string;
}

export interface SessionCell {
  id: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
  sessionType: 'LECTURE' | 'LAB' | 'TUTORIAL' | 'OTHER';
  roomCode: string | null;
  rawRoom?: string;
  rawFaculty?: string;
  faculty: FacultyRef[];
  groups: GroupRef[];
  isFixed: boolean;
  needsReview: boolean;
  reviewNote?: string;
  sourceRef?: string;
}

export interface MasterGridResponse {
  versionId: number;
  versionName: string;
  status: string;
  days: Record<number, SessionCell[]>;
}

export interface Disruption {
  id: number;
  kind: 'ROOM_UNAVAILABLE' | 'FACULTY_UNAVAILABLE' | 'EXTRA_ROOM' | 'OTHER';
  roomId?: number;
  roomCode?: string;
  facultyId?: number;
  facultyCode?: string;
  onDate: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  createdBy?: string;
  createdAt: string;
}

export interface RoomRule {
  id: number;
  onDate: string;
  level?: string;
  groupId?: number;
  groupName?: string;
  sessionType: string;
  allowRoomTypes: string;
  layout: 'ONE_ROOM_PER_BATCH' | 'MERGE_BATCHES';
  confirmedBy?: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export interface PlanSummary {
  id: number;
  code: string;
  name: string;
  description: string;
  sessionsMoved: number;
  facultyAffected: number;
  groupsAffected: number;
  newClashes: number;
  baselineClashes: number;
  shortfallMinutes: number;
  status: 'PROPOSED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
}

export interface ScheduleOverride {
  id: number;
  runId: number;
  sessionId: number;
  subject: string;
  sessionType: string;
  faculty: string;
  groups: string;
  origStartTime: string;
  origEndTime: string;
  origRoom: string;
  newStartTime?: string;
  newEndTime?: string;
  newRoom?: string;
  action: 'MOVE' | 'ROOM_CHANGE' | 'CANCEL';
  reason?: string;
  status: 'PROPOSED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
}

export interface NotificationJob {
  id: number;
  overrideId: number;
  facultyName?: string;
  facultyPhone?: string;
  groupName?: string;
  message: string;
  dedupeKey: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  attempts: number;
  providerMessageId?: string;
  createdAt: string;
  sentAt?: string;
}

export interface AuditLogItem {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: number;
  detail?: string;
}

export interface ClashReport {
  clashType: string;
  category: string;
  description: string;
  session1Id: number;
  session2Id: number;
  subject1: string;
  subject2: string;
}

export interface RoomItem {
  id: number;
  code: string;
  name: string;
  roomType: 'CLASSROOM' | 'LAB' | 'OTHER';
  labCode?: string;
  capacity: number;
  isTemporary?: boolean;
}

export interface FacultyItem {
  id: number;
  code: string;
  fullName: string;
  email?: string;
  whatsappE164?: string;
  isActive: boolean;
}

export interface StudentGroupItem {
  id: number;
  name: string;
  level: string;
  kind: string;
  strength: number;
}

export interface BroadcastDraft {
  id: string;
  type: 'FACULTY' | 'STUDENT_GROUP' | 'DEPARTMENT_MASTER';
  title: string;
  subtitle: string;
  phone?: string;
  message: string;
}

export interface SampleParsedSession {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
  roomCode: string;
  facultyCodes: string[];
  groups: string[];
  sessionType: string;
}

export interface TimetableParseReport {
  versionId: number;
  versionName: string;
  academicYear: string;
  semester: string;
  sourceFile: string;
  totalParsedSessions: number;
  distinctDays: number;
  facultyCount: number;
  roomCount: number;
  studentGroupCount: number;
  sampleSessions: SampleParsedSession[];
  aiClassificationSummary: string;
  success: boolean;
}

export interface BulkDisruptionPayload {
  kind: 'ROOM_UNAVAILABLE' | 'FACULTY_UNAVAILABLE' | 'EXTRA_ROOM';
  roomIds: number[];
  facultyIds: number[];
  onDate: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}
