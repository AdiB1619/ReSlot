package com.reslot.reschedule;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/plans")
@Tag(name = "Plans", description = "Plan inspection, blast radius, verification and publish")
public class PlanController {

    private final RescheduleService rescheduleService;

    public PlanController(RescheduleService rescheduleService) {
        this.rescheduleService = rescheduleService;
    }

    @GetMapping
    @Operation(summary = "Get generated plans for date (or latest)")
    public List<RescheduleService.PlanSummaryDto> getPlans(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        return rescheduleService.getPlansForDate(date);
    }

    @GetMapping("/published")
    @Operation(summary = "Get currently published plan for date if any")
    public ResponseEntity<RescheduleService.PlanSummaryDto> getPublishedPlan(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        return rescheduleService.getPublishedPlanForDate(date)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/{planId}")
    @Operation(summary = "Get single plan by ID")
    public ResponseEntity<RescheduleService.PlanSummaryDto> getPlan(@PathVariable Long planId) {
        return rescheduleService.getPlanById(planId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{planId}/overrides")
    @Operation(summary = "Get detailed session overrides (moves) for a plan")
    public List<RescheduleService.ScheduleOverrideDto> getPlanOverrides(@PathVariable Long planId) {
        return rescheduleService.getOverridesForPlan(planId);
    }

    @PostMapping("/{planId}/approve")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    @Operation(summary = "Coordinator or Admin approves a candidate plan with zero new clashes")
    public ResponseEntity<Void> approvePlan(
            @PathVariable Long planId,
            @RequestBody(required = false) ApprovalRequest req,
            @AuthenticationPrincipal UserDetails user) {
        String actor = user != null ? user.getUsername() : "coordinator@rscoe.edu.in";
        String remarks = req != null ? req.remarks() : null;
        rescheduleService.approvePlan(planId, actor, remarks);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{planId}/reject")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    @Operation(summary = "Coordinator or Admin rejects a candidate plan")
    public ResponseEntity<Void> rejectPlan(
            @PathVariable Long planId,
            @RequestBody(required = false) RejectionRequest req,
            @AuthenticationPrincipal UserDetails user) {
        String actor = user != null ? user.getUsername() : "coordinator@rscoe.edu.in";
        String reason = req != null ? req.reason() : null;
        rescheduleService.rejectPlan(planId, actor, reason);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{planId}/publish")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    @Operation(summary = "Coordinator or Admin publishes a plan and triggers WhatsApp notifications")
    public ResponseEntity<Void> publishPlan(
            @PathVariable Long planId,
            @AuthenticationPrincipal UserDetails user) {
        String actor = user != null ? user.getUsername() : "coordinator@rscoe.edu.in";
        rescheduleService.publishPlan(planId, actor);
        return ResponseEntity.ok().build();
    }

    public record ApprovalRequest(String remarks) {}
    public record RejectionRequest(String reason) {}
}
