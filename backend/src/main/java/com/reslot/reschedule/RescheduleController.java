package com.reslot.reschedule;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/reschedule")
@Tag(name = "Rescheduling", description = "Solver trigger, run management, and generated plans")
public class RescheduleController {

    private final RescheduleService rescheduleService;

    public RescheduleController(RescheduleService rescheduleService) {
        this.rescheduleService = rescheduleService;
    }

    @PostMapping("/runs")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    @Operation(summary = "Trigger a rescheduling run for a given date")
    public ResponseEntity<RescheduleService.RescheduleRunResult> triggerRun(
            @Valid @RequestBody TriggerRunRequest req,
            @AuthenticationPrincipal UserDetails user) {
        var result = rescheduleService.triggerRun(req.onDate(), user != null ? user.getUsername() : "coordinator");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/runs/{runId}/plans")
    @Operation(summary = "Get candidate plans generated for a run")
    public List<RescheduleService.PlanSummaryDto> getPlans(@PathVariable Long runId) {
        return rescheduleService.getPlansForRun(runId);
    }

    @GetMapping("/runs")
    @Operation(summary = "Get all generated plans across runs")
    public List<RescheduleService.PlanSummaryDto> getAllRuns() {
        return rescheduleService.getAllPlans();
    }

    @GetMapping("/runs/{runId}/overrides")
    @Operation(summary = "Get schedule overrides for a run")
    public List<RescheduleService.ScheduleOverrideDto> getRunOverrides(@PathVariable Long runId) {
        return rescheduleService.getOverridesForPlan(runId);
    }

    public record TriggerRunRequest(@NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate onDate) {}
}
