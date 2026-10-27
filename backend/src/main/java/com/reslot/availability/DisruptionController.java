package com.reslot.availability;

import com.reslot.masterdata.Faculty;
import com.reslot.masterdata.FacultyRepository;
import com.reslot.masterdata.Room;
import com.reslot.masterdata.RoomRepository;
import com.reslot.notification.NotificationService;
import com.reslot.reschedule.*;
import com.reslot.shared.ApiException;
import com.reslot.shared.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import com.reslot.rules.RoomPolicyOverrideRepository;

@Slf4j
@RestController
@RequestMapping("/api/v1/disruptions")
@Tag(name = "Availability", description = "Disruptions: rooms/faculty unavailability and extra rooms")
@PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
public class DisruptionController {

    private final DisruptionRepository disruptionRepo;
    private final RoomRepository roomRepo;
    private final FacultyRepository facultyRepo;
    private final Clock clock;
    private final ScheduleOverrideRepository overrideRepo;
    private final NotificationService notificationService;
    private final PlanRepository planRepo;
    private final RoomPolicyOverrideRepository roomPolicyRepo;

    public DisruptionController(DisruptionRepository disruptionRepo, RoomRepository roomRepo,
                                FacultyRepository facultyRepo, Clock clock,
                                ScheduleOverrideRepository overrideRepo,
                                NotificationService notificationService,
                                PlanRepository planRepo,
                                RoomPolicyOverrideRepository roomPolicyRepo) {
        this.disruptionRepo = disruptionRepo;
        this.roomRepo = roomRepo;
        this.facultyRepo = facultyRepo;
        this.clock = clock;
        this.overrideRepo = overrideRepo;
        this.notificationService = notificationService;
        this.planRepo = planRepo;
        this.roomPolicyRepo = roomPolicyRepo;
    }

    @GetMapping
    @Operation(summary = "List disruptions for a date")
    public List<DisruptionDto> list(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate queryDate = (date != null) ? date : LocalDate.now(clock);
        return disruptionRepo.findByDate(queryDate).stream().map(this::toDto).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a disruption")
    public DisruptionDto create(@Valid @RequestBody CreateDisruptionRequest req,
                                @AuthenticationPrincipal UserDetails user) {
        Room room = req.roomId() != null ? roomRepo.findById(req.roomId())
                .orElseThrow(() -> ApiException.notFound("Room not found: " + req.roomId())) : null;
        Faculty faculty = req.facultyId() != null ? facultyRepo.findById(req.facultyId())
                .orElseThrow(() -> ApiException.notFound("Faculty not found: " + req.facultyId())) : null;

        if (room == null && faculty == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Either roomId or facultyId must be provided", HttpStatus.BAD_REQUEST);
        }

        LocalTime start = null;
        LocalTime end = null;
        if (req.startTime() != null && !req.startTime().isBlank()) {
            try {
                start = LocalTime.parse(req.startTime().trim());
            } catch (Exception e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Invalid startTime format: " + req.startTime() + ". Expected HH:mm", HttpStatus.BAD_REQUEST);
            }
        }
        if (req.endTime() != null && !req.endTime().isBlank()) {
            try {
                end = LocalTime.parse(req.endTime().trim());
            } catch (Exception e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Invalid endTime format: " + req.endTime() + ". Expected HH:mm", HttpStatus.BAD_REQUEST);
            }
        }

        if (start != null && end != null && !start.isBefore(end)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "startTime (" + start + ") must be before endTime (" + end + ")", HttpStatus.BAD_REQUEST);
        }

        Disruption d = Disruption.builder()
                .kind(Disruption.DisruptionKind.valueOf(req.kind().trim().toUpperCase()))
                .room(room)
                .faculty(faculty)
                .onDate(req.onDate())
                .startTime(start)
                .endTime(end)
                .reason(req.reason())
                .createdBy(user != null ? user.getUsername() : "coordinator@rscoe.edu.in")
                .createdAt(Instant.now(clock))
                .deleted(false)
                .build();

        return toDto(disruptionRepo.save(d));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a disruption safely")
    @Transactional
    public void delete(@PathVariable Long id) {
        Disruption d = disruptionRepo.findById(id).orElseThrow(() -> ApiException.notFound("Disruption not found: " + id));

        LocalDate date = d.getOnDate();

        d.setDeleted(true);
        disruptionRepo.save(d);

        // Clean up only PROPOSED overrides that were linked to this disruption
        List<ScheduleOverride> proposedLinked = overrideRepo.findByOnDate(date).stream()
                .filter(o -> o.getStatus() == ScheduleOverride.Status.PROPOSED &&
                        o.getDisruption() != null && o.getDisruption().getId().equals(id))
                .toList();

        for (ScheduleOverride o : proposedLinked) {
            notificationService.deleteJobsForOverride(o);
            overrideRepo.delete(o);
        }
        overrideRepo.flush();
    }

    @PostMapping("/reset-day")
    @Operation(summary = "Clear draft disruptions and proposed schedule for date (preserves approved/published plans)")
    @Transactional
    public ResetDayResponse resetDay(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate target = (date != null) ? date : LocalDate.now(clock);
        int clearedCount = normalizeDay(target);
        return new ResetDayResponse(target.toString(), clearedCount, "Draft schedule normalized to active Master Timetable");
    }

    @DeleteMapping("/all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete all draft disruptions for a date")
    @Transactional
    public void deleteAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate target = (date != null) ? date : LocalDate.now(clock);
        normalizeDay(target);
    }

    private int normalizeDay(LocalDate date) {
        List<Disruption> disruptions = disruptionRepo.findByDate(date);
        for (Disruption d : disruptions) {
            d.setDeleted(true);
            disruptionRepo.save(d);
        }

        // Clean up or revert plans for this date back to master timetable
        List<Plan> allPlans = planRepo.findByTargetDate(date);
        for (Plan p : allPlans) {
            List<ScheduleOverride> planOverrides = overrideRepo.findByPlanId(p.getId());
            if (p.getStatus() == PlanStatus.PROPOSED || p.getStatus() == PlanStatus.VALIDATED) {
                for (ScheduleOverride o : planOverrides) {
                    notificationService.deleteJobsForOverride(o);
                    overrideRepo.delete(o);
                }
                planRepo.delete(p);
            } else if (p.getStatus() == PlanStatus.APPROVED || p.getStatus() == PlanStatus.PUBLISHED) {
                p.setStatus(PlanStatus.REJECTED);
                p.setRejectionReason("Schedule normalized to active Master Timetable by coordinator");
                planRepo.save(p);
                for (ScheduleOverride o : planOverrides) {
                    notificationService.deleteJobsForOverride(o);
                    o.setStatus(ScheduleOverride.Status.REJECTED);
                    overrideRepo.save(o);
                }
            }
        }
        overrideRepo.flush();
        planRepo.flush();

        // Also clear temporary date-specific room policy overrides (e.g. Lab Hours Adjustment Rule)
        roomPolicyRepo.findByOnDate(date).forEach(roomPolicyRepo::delete);
        roomPolicyRepo.flush();

        return disruptions.size();
    }

    private DisruptionDto toDto(Disruption d) {
        return new DisruptionDto(
                d.getId(),
                d.getKind().name(),
                d.getRoom() != null ? d.getRoom().getId() : null,
                d.getRoom() != null ? d.getRoom().getCode() : null,
                d.getFaculty() != null ? d.getFaculty().getId() : null,
                d.getFaculty() != null ? d.getFaculty().getCode() : null,
                d.getOnDate().toString(),
                d.getStartTime() != null ? d.getStartTime().toString() : null,
                d.getEndTime() != null ? d.getEndTime().toString() : null,
                d.getReason(),
                d.getCreatedBy(),
                d.getCreatedAt().toString()
        );
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create multiple disruptions at once")
    public List<DisruptionDto> createBulk(
            @Valid @RequestBody CreateBulkDisruptionsRequest req,
            @AuthenticationPrincipal UserDetails user) {
        LocalTime start = null;
        LocalTime end = null;
        if (req.startTime() != null && !req.startTime().isBlank()) {
            try {
                start = LocalTime.parse(req.startTime().trim());
            } catch (Exception e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Invalid startTime format: " + req.startTime(), HttpStatus.BAD_REQUEST);
            }
        }
        if (req.endTime() != null && !req.endTime().isBlank()) {
            try {
                end = LocalTime.parse(req.endTime().trim());
            } catch (Exception e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Invalid endTime format: " + req.endTime(), HttpStatus.BAD_REQUEST);
            }
        }

        if (start != null && end != null && !start.isBefore(end)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "startTime must be before endTime", HttpStatus.BAD_REQUEST);
        }

        List<DisruptionDto> results = new ArrayList<>();
        if (req.roomIds() != null) {
            for (Long roomId : req.roomIds()) {
                Room r = roomRepo.findById(roomId)
                        .orElseThrow(() -> ApiException.notFound("Room not found: " + roomId));
                Disruption d = Disruption.builder()
                        .kind(Disruption.DisruptionKind.valueOf(req.kind().trim().toUpperCase()))
                        .room(r)
                        .onDate(req.onDate())
                        .startTime(start)
                        .endTime(end)
                        .reason(req.reason())
                        .createdBy(user != null ? user.getUsername() : "coordinator@rscoe.edu.in")
                        .createdAt(Instant.now(clock))
                        .deleted(false)
                        .build();
                results.add(toDto(disruptionRepo.save(d)));
            }
        }
        if (req.facultyIds() != null) {
            for (Long facultyId : req.facultyIds()) {
                Faculty f = facultyRepo.findById(facultyId)
                        .orElseThrow(() -> ApiException.notFound("Faculty not found: " + facultyId));
                Disruption d = Disruption.builder()
                        .kind(Disruption.DisruptionKind.valueOf(req.kind().trim().toUpperCase()))
                        .faculty(f)
                        .onDate(req.onDate())
                        .startTime(start)
                        .endTime(end)
                        .reason(req.reason())
                        .createdBy(user != null ? user.getUsername() : "coordinator@rscoe.edu.in")
                        .createdAt(Instant.now(clock))
                        .deleted(false)
                        .build();
                results.add(toDto(disruptionRepo.save(d)));
            }
        }
        return results;
    }

    public record CreateDisruptionRequest(
            @NotBlank String kind,
            Long roomId,
            Long facultyId,
            @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate onDate,
            String startTime,
            String endTime,
            String reason
    ) {}

    public record CreateBulkDisruptionsRequest(
            @NotBlank String kind,
            List<Long> roomIds,
            List<Long> facultyIds,
            @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate onDate,
            String startTime,
            String endTime,
            String reason
    ) {}

    public record DisruptionDto(
            Long id, String kind, Long roomId, String roomCode,
            Long facultyId, String facultyCode, String onDate,
            String startTime, String endTime, String reason,
            String createdBy, String createdAt
    ) {}

    public record ResetDayResponse(String onDate, int clearedDisruptions, String message) {}
}
