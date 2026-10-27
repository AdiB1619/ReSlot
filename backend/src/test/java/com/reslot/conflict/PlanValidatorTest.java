package com.reslot.conflict;

import com.reslot.availability.Disruption;
import com.reslot.availability.Disruption.DisruptionKind;
import com.reslot.availability.DisruptionRepository;
import com.reslot.masterdata.*;
import com.reslot.reschedule.Plan;
import com.reslot.reschedule.PlanValidation;
import com.reslot.reschedule.PlanValidationRepository;
import com.reslot.reschedule.ScheduleOverride;
import com.reslot.rules.RoomPolicyOverride;
import com.reslot.rules.RoomPolicyOverrideRepository;
import com.reslot.timetable.TimetableSession;
import com.reslot.timetable.TimetableSession.SessionType;
import com.reslot.timetable.TimetableSessionRepository;
import com.reslot.timetable.TimetableVersion;
import com.reslot.timetable.TimetableVersion.VersionStatus;
import com.reslot.timetable.TimetableVersionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class PlanValidatorTest {

    private TimetableVersionRepository versionRepo;
    private TimetableSessionRepository sessionRepo;
    private DisruptionRepository disruptionRepo;
    private RoomPolicyOverrideRepository roomPolicyRepo;
    private PlanValidationRepository validationRepo;
    private PlanValidator validator;

    private TimetableVersion activeVersion;
    private LocalDate mondayDate;
    private Room roomA209;
    private Room roomA210;
    private Faculty facultySW;
    private Faculty facultyPT;
    private StudentGroup groupDivA;
    private StudentGroup groupBatchSA1;
    private Subject subjectOS;

    @BeforeEach
    void setUp() {
        versionRepo = Mockito.mock(TimetableVersionRepository.class);
        sessionRepo = Mockito.mock(TimetableSessionRepository.class);
        disruptionRepo = Mockito.mock(DisruptionRepository.class);
        roomPolicyRepo = Mockito.mock(RoomPolicyOverrideRepository.class);
        validationRepo = Mockito.mock(PlanValidationRepository.class);

        when(validationRepo.save(any(PlanValidation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        validator = new PlanValidator(versionRepo, sessionRepo, disruptionRepo, roomPolicyRepo, validationRepo);

        mondayDate = LocalDate.of(2026, 10, 26); // A Monday
        activeVersion = TimetableVersion.builder().id(1L).status(VersionStatus.ACTIVE).academicYear("2026-27").semester("1").build();
        when(versionRepo.findActive()).thenReturn(Optional.of(activeVersion));

        roomA209 = Room.builder().id(101L).code("A-209").name("Network Lab").roomType(Room.RoomType.LAB).build();
        roomA210 = Room.builder().id(102L).code("A-210").name("Classroom 210").roomType(Room.RoomType.CLASSROOM).build();

        facultySW = Faculty.builder().id(30L).code("SW").fullName("Prof. Shalaka Wagh").build();
        facultyPT = Faculty.builder().id(16L).code("PT").fullName("Prof. Pooja Thakre").build();

        groupDivA = StudentGroup.builder().id(1L).name("SY-A").level("SY").kind(StudentGroup.GroupKind.DIVISION).parent(null).build();
        groupBatchSA1 = StudentGroup.builder().id(2L).name("SY-A/SA1").level("SY").kind(StudentGroup.GroupKind.BATCH).parent(groupDivA).build();

        subjectOS = Subject.builder().id(1L).code("CS201").name("Operating Systems").build();
    }

    @Test
    @DisplayName("Room Collision: New override placing session in an occupied room is flagged as a new clash")
    void testRoomCollisionDetected() {
        // Session 1: Master session in A-209 from 10:00 to 11:00
        TimetableSession s1 = TimetableSession.builder()
                .id(1L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0))
                .room(roomA209).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultySW)).groups(Set.of(groupBatchSA1))
                .build();

        // Session 2: Master session in A-210 from 10:00 to 11:00
        TimetableSession s2 = TimetableSession.builder()
                .id(2L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0))
                .room(roomA210).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultyPT)).groups(Set.of(groupDivA))
                .build();

        when(sessionRepo.findByVersionId(1L)).thenReturn(List.of(s1, s2));
        when(disruptionRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());
        when(roomPolicyRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());

        // Override s2 into A-209 (creating a room clash with s1)
        ScheduleOverride ov = ScheduleOverride.builder()
                .session(s2).onDate(mondayDate)
                .action(ScheduleOverride.Action.ROOM_CHANGE)
                .newRoom(roomA209)
                .build();

        Plan plan = Plan.builder().id(10L).runId(1L).build();
        PlanValidation result = validator.validatePlan(plan, List.of(ov), mondayDate);

        assertFalse(result.isValid(), "Plan introducing room collision must be invalid");
        assertTrue(result.getNewClashesCount() > 0, "New clashes count must be > 0");
        assertTrue(result.getFindings().stream().anyMatch(f -> "ROOM_COLLISION".equals(f.get("code"))),
                "Findings must contain ROOM_COLLISION");
    }

    @Test
    @DisplayName("Faculty Double-Booking: Moving a session so a teacher overlaps with another session is flagged")
    void testFacultyDoubleBookingDetected() {
        // Session 1: Faculty SW teaching at 09:00 - 10:00
        TimetableSession s1 = TimetableSession.builder()
                .id(1L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0))
                .room(roomA209).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultySW)).groups(Set.of(groupBatchSA1))
                .build();

        // Session 2: Faculty SW teaching at 14:00 - 15:00 in master
        TimetableSession s2 = TimetableSession.builder()
                .id(2L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(14, 0)).endTime(LocalTime.of(15, 0))
                .room(roomA210).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultySW)).groups(Set.of(groupDivA))
                .build();

        when(sessionRepo.findByVersionId(1L)).thenReturn(List.of(s1, s2));
        when(disruptionRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());
        when(roomPolicyRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());

        // Move s2 from 14:00 to 09:00 (double booking SW with s1)
        ScheduleOverride ov = ScheduleOverride.builder()
                .session(s2).onDate(mondayDate)
                .action(ScheduleOverride.Action.MOVE)
                .origStartTime(LocalTime.of(14, 0)).origEndTime(LocalTime.of(15, 0))
                .newStartTime(LocalTime.of(9, 0)).newEndTime(LocalTime.of(10, 0))
                .newRoom(roomA210)
                .build();

        Plan plan = Plan.builder().id(11L).runId(1L).build();
        PlanValidation result = validator.validatePlan(plan, List.of(ov), mondayDate);

        assertFalse(result.isValid(), "Plan with faculty double booking must be invalid");
        assertTrue(result.getFindings().stream().anyMatch(f -> "FACULTY_DOUBLE_BOOKING".equals(f.get("code"))));
    }

    @Test
    @DisplayName("Group Hierarchy Clash: Division SE-A and its Batch SA1 overlapping is flagged")
    void testStudentGroupOverlapDetected() {
        // Session 1: Division SY-A at 10:00 - 11:00
        TimetableSession s1 = TimetableSession.builder()
                .id(1L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0))
                .room(roomA210).subject(subjectOS).sessionType(SessionType.LECTURE)
                .faculty(Set.of(facultyPT)).groups(Set.of(groupDivA))
                .build();

        // Session 2: Batch SA1 at 14:00 - 15:00
        TimetableSession s2 = TimetableSession.builder()
                .id(2L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(14, 0)).endTime(LocalTime.of(15, 0))
                .room(roomA209).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultySW)).groups(Set.of(groupBatchSA1))
                .build();

        when(sessionRepo.findByVersionId(1L)).thenReturn(List.of(s1, s2));
        when(disruptionRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());
        when(roomPolicyRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());

        // Move s2 to 10:00 - 11:00 (overlaps with parent division SY-A)
        ScheduleOverride ov = ScheduleOverride.builder()
                .session(s2).onDate(mondayDate)
                .action(ScheduleOverride.Action.MOVE)
                .origStartTime(LocalTime.of(14, 0)).origEndTime(LocalTime.of(15, 0))
                .newStartTime(LocalTime.of(10, 0)).newEndTime(LocalTime.of(11, 0))
                .newRoom(roomA209)
                .build();

        Plan plan = Plan.builder().id(12L).runId(1L).build();
        PlanValidation result = validator.validatePlan(plan, List.of(ov), mondayDate);

        assertFalse(result.isValid());
        assertTrue(result.getFindings().stream().anyMatch(f -> "GROUP_COLLISION".equals(f.get("code"))));
    }

    @Test
    @DisplayName("Pre-existing Baseline Clash: Master baseline clashes remain preserved and do NOT fail validation")
    void testPreExistingBaselineClashPreserved() {
        // Two sessions already colliding in the master timetable
        TimetableSession s1 = TimetableSession.builder()
                .id(1L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0))
                .room(roomA209).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultySW)).groups(Set.of(groupBatchSA1))
                .build();

        TimetableSession s2 = TimetableSession.builder()
                .id(2L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0))
                .room(roomA209).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultyPT)).groups(Set.of(groupBatchSA1))
                .build();

        when(sessionRepo.findByVersionId(1L)).thenReturn(List.of(s1, s2));
        when(disruptionRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());
        when(roomPolicyRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());

        // Zero overrides: both sessions undisturbed
        Plan plan = Plan.builder().id(13L).runId(1L).build();
        PlanValidation result = validator.validatePlan(plan, Collections.emptyList(), mondayDate);

        assertTrue(result.isValid(), "Pre-existing baseline clashes must not invalidate the plan (Domain Rule 3)");
        assertEquals(0, result.getNewClashesCount(), "Zero new clashes");
        assertTrue(result.getPreExistingClashesCount() > 0, "Baseline clash must be recorded as pre-existing");
    }

    @Test
    @DisplayName("Disrupted Room: Placing session in room undergoing ROOM_UNAVAILABLE disruption is rejected")
    void testDisruptedRoomOverlapDetected() {
        TimetableSession s1 = TimetableSession.builder()
                .id(1L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0))
                .room(roomA210).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultySW)).groups(Set.of(groupBatchSA1))
                .build();

        when(sessionRepo.findByVersionId(1L)).thenReturn(List.of(s1));

        Disruption d = Disruption.builder()
                .id(1L).onDate(mondayDate).kind(DisruptionKind.ROOM_UNAVAILABLE)
                .room(roomA209).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(13, 0))
                .build();

        when(disruptionRepo.findByOnDate(mondayDate)).thenReturn(List.of(d));
        when(roomPolicyRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());

        // Move s1 into disrupted room A-209
        ScheduleOverride ov = ScheduleOverride.builder()
                .session(s1).onDate(mondayDate)
                .action(ScheduleOverride.Action.ROOM_CHANGE)
                .newRoom(roomA209)
                .build();

        Plan plan = Plan.builder().id(14L).runId(1L).build();
        PlanValidation result = validator.validatePlan(plan, List.of(ov), mondayDate);

        assertFalse(result.isValid());
        assertTrue(result.getFindings().stream().anyMatch(f -> "ROOM_UNAVAILABLE_VIOLATION".equals(f.get("code"))));
    }

    @Test
    @DisplayName("Room Policy Override: LAB in Classroom permitted when policy override exists")
    void testLabInClassroomPermittedWithPolicyOverride() {
        TimetableSession s1 = TimetableSession.builder()
                .id(1L).version(activeVersion).dayOfWeek(1)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0))
                .room(roomA209).subject(subjectOS).sessionType(SessionType.LAB)
                .faculty(Set.of(facultySW)).groups(Set.of(groupBatchSA1))
                .build();

        when(sessionRepo.findByVersionId(1L)).thenReturn(List.of(s1));
        when(disruptionRepo.findByOnDate(mondayDate)).thenReturn(Collections.emptyList());

        // Policy override allowing CLASSROOM
        RoomPolicyOverride policy = RoomPolicyOverride.builder()
                .onDate(mondayDate).sessionType(SessionType.LAB)
                .allowRoomTypes(new String[]{"CLASSROOM"})
                .build();
        when(roomPolicyRepo.findByOnDate(mondayDate)).thenReturn(List.of(policy));

        // Move s1 to classroom A-210
        ScheduleOverride ov = ScheduleOverride.builder()
                .session(s1).onDate(mondayDate)
                .action(ScheduleOverride.Action.ROOM_CHANGE)
                .newRoom(roomA210)
                .build();

        Plan plan = Plan.builder().id(15L).runId(1L).build();
        PlanValidation result = validator.validatePlan(plan, List.of(ov), mondayDate);

        assertTrue(result.isValid(), "LAB in Classroom must be permitted when RoomPolicyOverride exists");
        assertEquals(0, result.getNewClashesCount());
    }
}
