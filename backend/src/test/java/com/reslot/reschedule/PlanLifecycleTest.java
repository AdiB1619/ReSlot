package com.reslot.reschedule;

import com.reslot.audit.AuditService;
import com.reslot.availability.DisruptionRepository;
import com.reslot.conflict.PlanValidator;
import com.reslot.masterdata.RoomRepository;
import com.reslot.notification.NotificationService;
import com.reslot.rules.RoomPolicyOverrideRepository;
import com.reslot.shared.ApiException;
import com.reslot.timetable.TimetableSessionRepository;
import com.reslot.timetable.TimetableVersionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class PlanLifecycleTest {

    private TimetableVersionRepository versionRepo;
    private TimetableSessionRepository sessionRepo;
    private DisruptionRepository disruptionRepo;
    private RoomRepository roomRepo;
    private ReschedulingRunRepository runRepo;
    private ScheduleOverrideRepository overrideRepo;
    private PlanRepository planRepo;
    private PlanValidator planValidator;
    private RoomPolicyOverrideRepository roomPolicyRepo;
    private NotificationService notificationService;
    private AuditService auditService;

    private RescheduleService service;

    @BeforeEach
    void setUp() {
        versionRepo = Mockito.mock(TimetableVersionRepository.class);
        sessionRepo = Mockito.mock(TimetableSessionRepository.class);
        disruptionRepo = Mockito.mock(DisruptionRepository.class);
        roomRepo = Mockito.mock(RoomRepository.class);
        runRepo = Mockito.mock(ReschedulingRunRepository.class);
        overrideRepo = Mockito.mock(ScheduleOverrideRepository.class);
        planRepo = Mockito.mock(PlanRepository.class);
        planValidator = Mockito.mock(PlanValidator.class);
        roomPolicyRepo = Mockito.mock(RoomPolicyOverrideRepository.class);
        notificationService = Mockito.mock(NotificationService.class);
        auditService = Mockito.mock(AuditService.class);

        service = new RescheduleService(
                versionRepo, sessionRepo, disruptionRepo, roomRepo, runRepo,
                overrideRepo, planRepo, planValidator, roomPolicyRepo,
                notificationService, auditService
        );
    }

    @Test
    @DisplayName("Sunday Rejection: Rescheduling on Sunday throws 400 Bad Request (RS-AUD-011)")
    void testSundayRescheduleRejected() {
        LocalDate sunday = LocalDate.of(2026, 11, 1); // Sunday
        ApiException ex = assertThrows(ApiException.class, () -> service.triggerRun(sunday, "coordinator"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Sunday"));
    }

    @Test
    @DisplayName("Publishing REJECTED Plan: Cannot publish a rejected plan (throws 409 Conflict)")
    void testPublishRejectedPlanThrowsConflict() {
        Plan plan = Plan.builder().id(101L).runId(1L).status(PlanStatus.REJECTED).build();
        when(planRepo.findById(101L)).thenReturn(Optional.of(plan));

        ApiException ex = assertThrows(ApiException.class, () -> service.publishPlan(101L, "coordinator"));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("Cannot publish a REJECTED plan"));
    }

    @Test
    @DisplayName("Approving REJECTED Plan: Cannot approve a previously rejected plan (throws 409 Conflict)")
    void testApproveRejectedPlanThrowsConflict() {
        Plan plan = Plan.builder().id(102L).runId(1L).status(PlanStatus.REJECTED).build();
        when(planRepo.findById(102L)).thenReturn(Optional.of(plan));

        ApiException ex = assertThrows(ApiException.class, () -> service.approvePlan(102L, "coordinator", "remarks"));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("A REJECTED plan cannot be approved"));
    }

    @Test
    @DisplayName("Rejecting PUBLISHED Plan: Cannot reject a published plan (throws 409 Conflict)")
    void testRejectPublishedPlanThrowsConflict() {
        Plan plan = Plan.builder().id(103L).runId(1L).status(PlanStatus.PUBLISHED).build();
        when(planRepo.findById(103L)).thenReturn(Optional.of(plan));

        ApiException ex = assertThrows(ApiException.class, () -> service.rejectPlan(103L, "coordinator", "reason"));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("A PUBLISHED plan cannot be rejected"));
    }

    @Test
    @DisplayName("Plan Superseding: Publishing when another plan was published supersedes old plan to REJECTED")
    void testPublishingPlanSupersedesExistingPublishedPlan() {
        LocalDate date = LocalDate.of(2026, 10, 26);
        ReschedulingRun run = ReschedulingRun.builder().id(1L).onDate(date).build();
        Plan plan2 = Plan.builder().id(202L).runId(1L).label("Plan B").status(PlanStatus.APPROVED).build();

        Plan plan1AlreadyPublished = Plan.builder().id(201L).runId(1L).status(PlanStatus.PUBLISHED).build();

        when(planRepo.findById(202L)).thenReturn(Optional.of(plan2));
        when(runRepo.findById(1L)).thenReturn(Optional.of(run));
        when(planRepo.findByTargetDateAndStatus(date, PlanStatus.PUBLISHED)).thenReturn(List.of(plan1AlreadyPublished));
        when(overrideRepo.findByPlanId(202L)).thenReturn(Collections.emptyList());
        when(overrideRepo.findByPlanId(201L)).thenReturn(Collections.emptyList());

        PlanValidation validResult = PlanValidation.builder()
                .isValid(true).newClashesCount(0).preExistingClashesCount(0).build();
        when(planValidator.validatePlan(Mockito.eq(plan2), any(), Mockito.eq(date))).thenReturn(validResult);

        service.publishPlan(202L, "coordinator");

        assertEquals(PlanStatus.PUBLISHED, plan2.getStatus());
        assertEquals(PlanStatus.REJECTED, plan1AlreadyPublished.getStatus());
        assertTrue(plan1AlreadyPublished.getRejectionReason().contains("Superseded"));
    }

    @Test
    @DisplayName("Clash Blocks Publication: Plan with new clashes fails re-validation at publish time (409 Conflict)")
    void testClashBlocksPublication() {
        LocalDate date = LocalDate.of(2026, 10, 26);
        ReschedulingRun run = ReschedulingRun.builder().id(1L).onDate(date).build();
        Plan plan = Plan.builder().id(301L).runId(1L).status(PlanStatus.APPROVED).build();

        when(planRepo.findById(301L)).thenReturn(Optional.of(plan));
        when(runRepo.findById(1L)).thenReturn(Optional.of(run));
        when(planRepo.findByTargetDateAndStatus(date, PlanStatus.PUBLISHED)).thenReturn(Collections.emptyList());
        when(overrideRepo.findByPlanId(301L)).thenReturn(Collections.emptyList());

        PlanValidation invalidResult = PlanValidation.builder()
                .isValid(false).newClashesCount(2).preExistingClashesCount(0).build();
        when(planValidator.validatePlan(Mockito.eq(plan), any(), Mockito.eq(date))).thenReturn(invalidResult);

        ApiException ex = assertThrows(ApiException.class, () -> service.publishPlan(301L, "coordinator"));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("Publication blocked"));
    }
}
