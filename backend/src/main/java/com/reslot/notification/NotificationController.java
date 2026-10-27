package com.reslot.notification;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "Notifications", description = "WhatsApp notification outbox and delivery logs")
@PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "List recent notification jobs")
    public List<NotificationDto> listNotifications() {
        return notificationService.listRecent().stream().map(this::toDto).toList();
    }

    @GetMapping("/broadcasts")
    @Operation(summary = "Get drafted broadcast notices for WhatsApp and communication platforms")
    public List<NotificationService.BroadcastDraft> getBroadcasts(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        java.time.LocalDate target = date != null ? date : java.time.LocalDate.now();
        return notificationService.getBroadcastDrafts(target);
    }

    @DeleteMapping("/broadcasts")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Clear notification jobs for date (does not delete published timetable overrides)")
    public ResponseEntity<Void> clearBroadcasts(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        java.time.LocalDate target = date != null ? date : java.time.LocalDate.now();
        notificationService.clearAllForDate(target);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/dispatch")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    @Operation(summary = "Trigger pending notification dispatch worker")
    public ResponseEntity<Void> dispatchPending() {
        notificationService.dispatchPendingJobs();
        return ResponseEntity.ok().build();
    }

    private NotificationDto toDto(NotificationJob n) {
        return new NotificationDto(
                n.getId(),
                n.getOverride().getId(),
                n.getFaculty() != null ? n.getFaculty().getFullName() : null,
                n.getFaculty() != null ? n.getFaculty().getWhatsappE164() : null,
                n.getGroup() != null ? n.getGroup().getName() : null,
                n.getMessage(),
                n.getStatus().name(),
                n.getProviderMessageId(),
                n.getLastError(),
                n.getCreatedAt() != null ? n.getCreatedAt().toString() : null,
                n.getSentAt() != null ? n.getSentAt().toString() : null
        );
    }

    public record NotificationDto(
            Long id, Long overrideId, String facultyName, String facultyPhone,
            String groupName, String message, String status,
            String providerMessageId, String lastError, String createdAt, String sentAt
    ) {}
}
