package com.reslot.rules;

import com.reslot.audit.AuditService;
import com.reslot.masterdata.Room;
import com.reslot.masterdata.RoomRepository;
import com.reslot.masterdata.StudentGroup;
import com.reslot.masterdata.StudentGroupRepository;
import com.reslot.shared.ApiException;
import com.reslot.timetable.TimetableSession.SessionType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/room-rules")
@Tag(name = "Room Rules", description = "Room policy overrides and capacity pre-check")
@PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
public class RoomRuleController {

    private final RoomPolicyOverrideRepository ruleRepo;
    private final StudentGroupRepository groupRepo;
    private final RoomRepository roomRepo;
    private final AuditService auditService;

    public RoomRuleController(
            RoomPolicyOverrideRepository ruleRepo,
            StudentGroupRepository groupRepo,
            RoomRepository roomRepo,
            AuditService auditService) {
        this.ruleRepo = ruleRepo;
        this.groupRepo = groupRepo;
        this.roomRepo = roomRepo;
        this.auditService = auditService;
    }

    @GetMapping
    @Operation(summary = "List room rules for a date")
    public List<RoomRuleDto> listRules(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ruleRepo.findByOnDate(date).stream().map(this::toDto).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a room policy override")
    public RoomRuleDto createRule(
            @Valid @RequestBody CreateRoomRuleRequest req,
            @AuthenticationPrincipal UserDetails user) {
        StudentGroup group = req.groupId() != null ? groupRepo.findById(req.groupId())
                .orElseThrow(() -> ApiException.notFound("Group not found")) : null;

        String layout = req.layout() != null ? req.layout() : "ONE_ROOM_PER_BATCH";
        String confirmedBy = req.confirmedBy();
        if ("MERGE_BATCHES".equalsIgnoreCase(layout)) {
            if (confirmedBy == null || confirmedBy.isBlank()) {
                confirmedBy = user != null ? user.getUsername() : null;
            }
            if (confirmedBy == null || confirmedBy.isBlank()) {
                throw ApiException.badRequest("Merging batches requires a named human confirmer (RS-AUD-027).");
            }
        }

        SessionType sType = SessionType.LAB;
        if (req.sessionType() != null && !req.sessionType().isBlank()) {
            try {
                sType = SessionType.valueOf(req.sessionType().toUpperCase());
            } catch (Exception e) {
                throw ApiException.badRequest("Invalid sessionType: " + req.sessionType());
            }
        }

        String[] allow = req.allowRoomTypes() != null && !req.allowRoomTypes().isBlank()
                ? req.allowRoomTypes().split("\\s*,\\s*")
                : new String[]{"CLASSROOM"};

        String normLevel = (req.level() == null || req.level().isBlank() || "ALL".equalsIgnoreCase(req.level())) ? null : req.level();

        RoomPolicyOverride rule = RoomPolicyOverride.builder()
                .onDate(req.onDate())
                .level(normLevel)
                .group(group)
                .sessionType(sType)
                .allowRoomTypes(allow)
                .layout(layout)
                .confirmedBy(confirmedBy)
                .reason(req.reason())
                .createdBy(user != null ? user.getUsername() : "coordinator")
                .build();

        rule = ruleRepo.save(rule);
        auditService.record(user != null ? user.getUsername() : "coordinator",
                "ROOM_RULE_CREATED", "room_policy_overrides", rule.getId(), req.reason());
        return toDto(rule);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a room policy override")
    public void deleteRule(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        if (!ruleRepo.existsById(id)) {
            throw ApiException.notFound("Room rule not found: " + id);
        }
        ruleRepo.deleteById(id);
        auditService.record(user != null ? user.getUsername() : "coordinator",
                "ROOM_RULE_DELETED", "room_policy_overrides", id, "Room rule deleted");
    }

    @PostMapping("/precheck")
    @Operation(summary = "Pre-check classroom capacity against student groups")
    public CapacityCheckResult precheck(@RequestBody CapacityCheckRequest req) {
        Room room = roomRepo.findById(req.roomId())
                .orElseThrow(() -> ApiException.notFound("Room not found: " + req.roomId()));
        StudentGroup group = groupRepo.findById(req.groupId())
                .orElseThrow(() -> ApiException.notFound("Group not found: " + req.groupId()));

        int roomCap = room.getCapacity() != null ? room.getCapacity() : 60;
        int groupStrength = group.getStrength() != null ? group.getStrength() : 45;
        boolean fits = groupStrength <= roomCap;
        int difference = roomCap - groupStrength;

        String verdict = fits ? "FEASIBLE" : "OVERFLOW";
        String message = fits
                ? String.format("Capacity OK: Room %s has capacity %d, group %s strength is %d (%d seats spare).",
                    room.getCode(), roomCap, group.getName(), groupStrength, difference)
                : String.format("Capacity WARNING: Room %s has capacity %d, but group %s requires %d (%d students deficit)!",
                    room.getCode(), roomCap, group.getName(), groupStrength, Math.abs(difference));

        return new CapacityCheckResult(fits, verdict, roomCap, groupStrength, difference, message);
    }

    private RoomRuleDto toDto(RoomPolicyOverride r) {
        return new RoomRuleDto(
                r.getId(),
                r.getOnDate().toString(),
                r.getLevel(),
                r.getGroup() != null ? r.getGroup().getId() : null,
                r.getGroup() != null ? r.getGroup().getName() : null,
                r.getSessionType().name(),
                r.getAllowRoomTypes() != null ? String.join(",", r.getAllowRoomTypes()) : "CLASSROOM",
                r.getLayout(),
                r.getConfirmedBy(),
                r.getReason(),
                r.getCreatedBy(),
                r.getCreatedAt().toString()
        );
    }

    public record RoomRuleDto(Long id, String onDate, String level, Long groupId, String groupName,
                             String sessionType, String allowRoomTypes, String layout,
                             String confirmedBy, String reason, String createdBy, String createdAt) {}

    public record CreateRoomRuleRequest(
            @NotNull LocalDate onDate, String level, Long groupId, String sessionType,
            String allowRoomTypes, String layout, String confirmedBy, String reason) {}

    public record CapacityCheckRequest(@NotNull Long roomId, @NotNull Long groupId) {}
    public record CapacityCheckResult(boolean fits, String verdict, int roomCapacity, int groupStrength, int spareSeats, String message) {}
}
