package com.reslot.reschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ScheduleOverrideRepository extends JpaRepository<ScheduleOverride, Long> {
    List<ScheduleOverride> findByOnDate(LocalDate onDate);
    List<ScheduleOverride> findByRunId(Long runId);
    List<ScheduleOverride> findByPlanId(Long planId);
    List<ScheduleOverride> findByPlanIdIn(java.util.Collection<Long> planIds);
    List<ScheduleOverride> findByOnDateAndStatus(LocalDate onDate, ScheduleOverride.Status status);

    @Query("SELECT o FROM ScheduleOverride o WHERE o.onDate = :onDate AND o.status IN ('APPROVED', 'PUBLISHED')")
    List<ScheduleOverride> findActiveOverridesForDate(@Param("onDate") LocalDate onDate);

    @Query("SELECT o FROM ScheduleOverride o WHERE o.status = 'PROPOSED' ORDER BY o.proposedAt DESC")
    List<ScheduleOverride> findPendingApprovals();
}
