package com.reslot.reschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PlanRepository extends JpaRepository<Plan, Long> {
    List<Plan> findByStatus(PlanStatus status);
    Optional<Plan> findByRunIdAndLabel(Long runId, String label);

    @Query("SELECT p FROM Plan p JOIN ReschedulingRun r ON p.runId = r.id WHERE r.onDate = :targetDate AND p.status = :status")
    List<Plan> findByTargetDateAndStatus(@Param("targetDate") LocalDate targetDate, @Param("status") PlanStatus status);

    @Query("SELECT p FROM Plan p JOIN ReschedulingRun r ON p.runId = r.id WHERE r.onDate = :targetDate ORDER BY r.id DESC, p.label ASC, p.id ASC")
    List<Plan> findByTargetDate(@Param("targetDate") LocalDate targetDate);

    @Query("SELECT p FROM Plan p WHERE p.runId = :runId ORDER BY p.label ASC, p.id ASC")
    List<Plan> findByRunId(@Param("runId") Long runId);
}
