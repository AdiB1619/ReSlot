package com.reslot.timetable;

import com.reslot.identity.User;
import com.reslot.masterdata.Room;
import com.reslot.reschedule.ScheduleOverride;
import com.reslot.reschedule.ScheduleOverrideRepository;
import com.reslot.shared.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/timetable")
@Tag(name = "Timetable", description = "Master and effective timetable reads and exports")
@org.springframework.transaction.annotation.Transactional(readOnly = true)
public class TimetableController {

    private final TimetableVersionRepository versionRepo;
    private final TimetableSessionRepository sessionRepo;
    private final ScheduleOverrideRepository overrideRepo;
    private final TimetableExportService exportService;

    public TimetableController(
            TimetableVersionRepository versionRepo,
            TimetableSessionRepository sessionRepo,
            ScheduleOverrideRepository overrideRepo,
            TimetableExportService exportService) {
        this.versionRepo = versionRepo;
        this.sessionRepo = sessionRepo;
        this.overrideRepo = overrideRepo;
        this.exportService = exportService;
    }

    @GetMapping("/master")
    @Operation(summary = "Get master timetable as a weekly grid")
    public ResponseEntity<MasterGridResponse> getMaster(
            @RequestParam(required = false) Long versionId,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long roomId) {

        TimetableVersion version = versionId != null
                ? versionRepo.findById(versionId).orElseThrow(() -> ApiException.notFound("Version not found"))
                : versionRepo.findActive().orElseThrow(() -> ApiException.notFound("No active version"));

        List<TimetableSession> sessions;
        if (groupId != null) {
            sessions = sessionRepo.findByVersionAndGroup(version.getId(), groupId);
        } else if (facultyId != null) {
            sessions = sessionRepo.findByVersionAndFaculty(version.getId(), facultyId);
        } else if (roomId != null) {
            sessions = sessionRepo.findByVersionAndRoom(version.getId(), roomId);
        } else {
            sessions = sessionRepo.findByVersionId(version.getId());
        }

        Map<Integer, List<SessionCell>> grid = new LinkedHashMap<>();
        for (int d = 1; d <= 6; d++) {
            final int day = d;
            grid.put(day, sessions.stream()
                    .filter(s -> s.getDayOfWeek() == day)
                    .sorted(Comparator.comparing(TimetableSession::getStartTime))
                    .map(this::toCell)
                    .toList());
        }

        return ResponseEntity.ok(new MasterGridResponse(version.getId(), version.getName(), version.getStatus().name(), grid));
    }

    @GetMapping("/versions")
    @Operation(summary = "List all timetable versions")
    public List<VersionSummary> listVersions() {
        return versionRepo.findAll().stream()
                .map(v -> new VersionSummary(v.getId(), v.getName(), v.getAcademicYear(), v.getSemester(),
                        v.getEffectiveFrom().toString(), v.getStatus().name()))
                .toList();
    }

    @GetMapping("/effective")
    @Operation(summary = "Get effective timetable for a specific date (combines active master with published overrides)")
    public ResponseEntity<EffectiveTimetableResponse> getEffective(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long roomId) {

        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<EffectiveSessionDto> sessions = computeEffectiveSessions(targetDate, groupId, facultyId, roomId);

        return ResponseEntity.ok(new EffectiveTimetableResponse(
                targetDate.toString(),
                targetDate.getDayOfWeek().name(),
                sessions.size(),
                sessions
        ));
    }

    @GetMapping("/me")
    @Operation(summary = "Get personal effective schedule for the authenticated user")
    public ResponseEntity<EffectiveTimetableResponse> getMyEffective(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        LocalDate targetDate = date != null ? date : LocalDate.now();
        Long facultyId = currentUser != null ? currentUser.getFacultyId() : null;
        Long groupId = currentUser != null ? currentUser.getGroupId() : null;

        List<EffectiveSessionDto> sessions = computeEffectiveSessions(targetDate, groupId, facultyId, null);

        return ResponseEntity.ok(new EffectiveTimetableResponse(
                targetDate.toString(),
                targetDate.getDayOfWeek().name(),
                sessions.size(),
                sessions
        ));
    }

    @GetMapping("/export/excel")
    @Operation(summary = "Export effective timetable to Excel XLSX")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long roomId) {

        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<EffectiveSessionDto> sessions = computeEffectiveSessions(targetDate, groupId, facultyId, roomId);
        byte[] bytes = exportService.exportToExcel("RSCOE Computer Engineering Timetable", targetDate, sessions);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"timetable-" + targetDate + ".xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    @GetMapping("/export/pdf")
    @Operation(summary = "Export effective timetable to PDF")
    public ResponseEntity<byte[]> exportPdf(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long roomId) {

        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<EffectiveSessionDto> sessions = computeEffectiveSessions(targetDate, groupId, facultyId, roomId);
        byte[] bytes = exportService.exportToPdf("RSCOE Effective Schedule", targetDate, sessions);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"timetable-" + targetDate + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }

    @GetMapping("/export/ics")
    @Operation(summary = "Export effective timetable to iCalendar .ics format")
    public ResponseEntity<byte[]> exportIcs(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long roomId) {

        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<EffectiveSessionDto> sessions = computeEffectiveSessions(targetDate, groupId, facultyId, roomId);
        byte[] bytes = exportService.exportToIcs("RSCOE Schedule", targetDate, sessions);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"timetable-" + targetDate + ".ics\"")
                .contentType(MediaType.parseMediaType("text/calendar; charset=UTF-8"))
                .body(bytes);
    }

    private List<EffectiveSessionDto> computeEffectiveSessions(LocalDate date, Long groupId, Long facultyId, Long roomId) {
        if (date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return Collections.emptyList();
        }

        int dayOfWeek = date.getDayOfWeek().getValue();
        TimetableVersion activeVersion = versionRepo.findActive().orElse(null);
        if (activeVersion == null) {
            return Collections.emptyList();
        }

        List<TimetableSession> masterSessions = sessionRepo.findByVersionId(activeVersion.getId()).stream()
                .filter(s -> s.getDayOfWeek() == dayOfWeek)
                .toList();

        // Get all PUBLISHED overrides for this date
        List<ScheduleOverride> publishedOverrides = overrideRepo.findByOnDateAndStatus(date, ScheduleOverride.Status.PUBLISHED);
        Map<Long, ScheduleOverride> overrideBySessionId = publishedOverrides.stream()
                .filter(o -> o.getSession() != null)
                .collect(Collectors.toMap(o -> o.getSession().getId(), Function.identity(), (a, b) -> b));

        List<EffectiveSessionDto> effective = new ArrayList<>();

        for (TimetableSession s : masterSessions) {
            ScheduleOverride o = overrideBySessionId.get(s.getId());
            if (o == null) {
                effective.add(new EffectiveSessionDto(
                        s.getId(),
                        s.getStartTime().toString(),
                        s.getEndTime().toString(),
                        s.getSubject().getCode(),
                        s.getSubject().getName(),
                        s.getSessionType().name(),
                        s.getRoom() != null ? s.getRoom().getCode() : null,
                        s.getFaculty().stream().map(f -> new FacultyRef(f.getId(), f.getCode(), f.getFullName())).toList(),
                        s.getGroups().stream().map(g -> new GroupRef(g.getId(), g.getName())).toList(),
                        "NORMAL",
                        null,
                        null,
                        null,
                        null
                ));
            } else {
                String status = o.getAction().name();
                String start = o.getNewStartTime() != null ? o.getNewStartTime().toString() : s.getStartTime().toString();
                String end = o.getNewEndTime() != null ? o.getNewEndTime().toString() : s.getEndTime().toString();
                Room finalRoom = o.getNewRoom() != null ? o.getNewRoom() : s.getRoom();
                String roomCode = finalRoom != null ? finalRoom.getCode() : null;

                List<FacultyRef> facList = s.getFaculty().stream()
                        .map(f -> new FacultyRef(f.getId(), f.getCode(), f.getFullName()))
                        .toList();

                effective.add(new EffectiveSessionDto(
                        s.getId(),
                        start,
                        end,
                        s.getSubject().getCode(),
                        s.getSubject().getName(),
                        s.getSessionType().name(),
                        roomCode,
                        facList,
                        s.getGroups().stream().map(g -> new GroupRef(g.getId(), g.getName())).toList(),
                        status,
                        s.getRoom() != null ? s.getRoom().getCode() : null,
                        s.getStartTime().toString(),
                        s.getEndTime().toString(),
                        o.getReason()
                ));
            }
        }

        // Apply filtering
        return effective.stream()
                .filter(e -> {
                    if (groupId != null && e.groups().stream().noneMatch(g -> g.id().equals(groupId))) {
                        return false;
                    }
                    if (facultyId != null && e.faculty().stream().noneMatch(f -> f.id().equals(facultyId))) {
                        return false;
                    }
                    if (roomId != null && (e.roomCode() == null)) {
                        return false;
                    }
                    return true;
                })
                .sorted(Comparator.comparing(EffectiveSessionDto::startTime))
                .toList();
    }

    private SessionCell toCell(TimetableSession s) {
        return new SessionCell(
                s.getId(),
                s.getStartTime().toString(),
                s.getEndTime().toString(),
                s.getSubject().getCode(),
                s.getSubject().getName(),
                s.getSessionType().name(),
                s.getRoom() != null ? s.getRoom().getCode() : null,
                s.getRawRoom(),
                s.getRawFaculty(),
                s.getFaculty().stream().map(f -> new FacultyRef(f.getId(), f.getCode(), f.getFullName())).toList(),
                s.getGroups().stream().map(g -> new GroupRef(g.getId(), g.getName())).toList(),
                s.isFixed(),
                s.isNeedsReview(),
                s.getReviewNote(),
                s.getSourceRef()
        );
    }

    public record MasterGridResponse(Long versionId, String versionName, String status, Map<Integer, List<SessionCell>> days) {}
    public record EffectiveTimetableResponse(String date, String dayOfWeek, int totalSessions, List<EffectiveSessionDto> sessions) {}
    public record EffectiveSessionDto(Long id, String startTime, String endTime, String subjectCode, String subjectName,
                                      String sessionType, String roomCode, List<FacultyRef> faculty, List<GroupRef> groups,
                                      String status, String originalRoomCode, String originalStartTime, String originalEndTime,
                                      String changeReason) {}
    public record SessionCell(Long id, String startTime, String endTime, String subjectCode, String subjectName,
                              String sessionType, String roomCode, String rawRoom, String rawFaculty,
                              List<FacultyRef> faculty, List<GroupRef> groups,
                              boolean isFixed, boolean needsReview, String reviewNote, String sourceRef) {}
    public record FacultyRef(Long id, String code, String fullName) {}
    public record GroupRef(Long id, String name) {}
    public record VersionSummary(Long id, String name, String academicYear, String semester, String effectiveFrom, String status) {}
}
