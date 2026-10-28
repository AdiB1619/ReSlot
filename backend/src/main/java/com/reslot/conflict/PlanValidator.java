package com.reslot.conflict;

import com.reslot.availability.Disruption;
import com.reslot.availability.DisruptionRepository;
import com.reslot.masterdata.*;
import com.reslot.reschedule.Plan;
import com.reslot.reschedule.PlanValidation;
import com.reslot.reschedule.PlanValidationRepository;
import com.reslot.reschedule.ScheduleOverride;
import com.reslot.rules.RoomPolicyOverride;
import com.reslot.rules.RoomPolicyOverrideRepository;
import com.reslot.timetable.TimetableSession;
import com.reslot.timetable.TimetableSessionRepository;
import com.reslot.timetable.TimetableVersion;
import com.reslot.timetable.TimetableVersionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class PlanValidator {

    private final TimetableVersionRepository versionRepo;
    private final TimetableSessionRepository sessionRepo;
    private final DisruptionRepository disruptionRepo;
    private final RoomPolicyOverrideRepository roomPolicyRepo;
    private final PlanValidationRepository validationRepo;

    public PlanValidator(TimetableVersionRepository versionRepo,
                         TimetableSessionRepository sessionRepo,
                         DisruptionRepository disruptionRepo,
                         RoomPolicyOverrideRepository roomPolicyRepo,
                         PlanValidationRepository validationRepo) {
        this.versionRepo = versionRepo;
        this.sessionRepo = sessionRepo;
        this.disruptionRepo = disruptionRepo;
        this.roomPolicyRepo = roomPolicyRepo;
        this.validationRepo = validationRepo;
    }

    public PlanValidation validatePlan(Plan plan, List<ScheduleOverride> overrides, LocalDate targetDate) {
        var activeOpt = versionRepo.findActive();
        if (activeOpt.isEmpty()) {
            throw new IllegalStateException("No active timetable version found to validate against");
        }
        TimetableVersion activeVersion = activeOpt.get();

        int dayOfWeek = targetDate.getDayOfWeek().getValue();
        List<TimetableSession> masterSessions = sessionRepo.findByVersionId(activeVersion.getId()).stream()
                .filter(s -> s.getDayOfWeek() == dayOfWeek)
                .toList();

        Map<Long, ScheduleOverride> overrideMap = overrides.stream()
                .collect(Collectors.toMap(o -> o.getSession().getId(), o -> o, (a, b) -> a));

        // 1. Build Effective Sessions
        List<EffectiveSession> effectiveSessions = new ArrayList<>();
        Set<Long> overriddenSessionIds = new HashSet<>();

        for (TimetableSession ms : masterSessions) {
            ScheduleOverride ov = overrideMap.get(ms.getId());
            if (ov == null) {
                // Unchanged
                effectiveSessions.add(new EffectiveSession(
                        ms.getId(), ms, ms.getStartTime(), ms.getEndTime(),
                        ms.getRoom(), ms.getFaculty(), ms.getGroups(),
                        ms.getSessionType(), false, null
                ));
            } else {
                overriddenSessionIds.add(ms.getId());
                if (ov.getAction() == ScheduleOverride.Action.CANCEL) {
                    // Cancelled - session does not take place
                    continue;
                } else if (ov.getAction() == ScheduleOverride.Action.ROOM_CHANGE) {
                    Room room = ov.getNewRoom() != null ? ov.getNewRoom() : ms.getRoom();
                    effectiveSessions.add(new EffectiveSession(
                            ms.getId(), ms, ms.getStartTime(), ms.getEndTime(),
                            room, ms.getFaculty(), ms.getGroups(),
                            ms.getSessionType(), true, ov
                    ));
                } else if (ov.getAction() == ScheduleOverride.Action.MOVE) {
                    Room room = ov.getNewRoom() != null ? ov.getNewRoom() : ms.getRoom();
                    effectiveSessions.add(new EffectiveSession(
                            ms.getId(), ms, ov.getNewStartTime(), ov.getNewEndTime(),
                            room, ms.getFaculty(), ms.getGroups(),
                            ms.getSessionType(), true, ov
                    ));
                }
            }
        }

        // Load disruptions and room policy overrides for date
        List<Disruption> disruptions = disruptionRepo.findByOnDate(targetDate).stream()
                .filter(d -> !d.isDeleted())
                .toList();

        List<RoomPolicyOverride> roomPolicies = roomPolicyRepo.findByOnDate(targetDate);

        List<Map<String, Object>> findings = new ArrayList<>();
        int newClashes = 0;
        int preExistingClashes = 0;

        // 2. Room Double-Booking
        for (int i = 0; i < effectiveSessions.size(); i++) {
            for (int j = i + 1; j < effectiveSessions.size(); j++) {
                EffectiveSession s1 = effectiveSessions.get(i);
                EffectiveSession s2 = effectiveSessions.get(j);

                if (s1.room() != null && s2.room() != null && s1.room().getId().equals(s2.room().getId())) {
                    if (isTimeOverlap(s1.startTime(), s1.endTime(), s2.startTime(), s2.endTime())) {
                        boolean wasInMaster = s1.originalSession().getRoom() != null
                                && s2.originalSession().getRoom() != null
                                && s1.originalSession().getRoom().getId().equals(s2.originalSession().getRoom().getId())
                                && s1.originalSession().getRoom().getId().equals(s1.room().getId())
                                && s1.startTime().equals(s1.originalSession().getStartTime())
                                && s1.endTime().equals(s1.originalSession().getEndTime())
                                && s2.startTime().equals(s2.originalSession().getStartTime())
                                && s2.endTime().equals(s2.originalSession().getEndTime())
                                && isTimeOverlap(s1.originalSession().getStartTime(), s1.originalSession().getEndTime(),
                                                 s2.originalSession().getStartTime(), s2.originalSession().getEndTime());
                        boolean isNew = !wasInMaster;
                        if (isNew) {
                            newClashes++;
                            findings.add(createFinding("ROOM_COLLISION", "ERROR", false,
                                    String.format("Room %s double-booked between session %d (%s) and session %d (%s) at %s-%s",
                                            s1.room().getCode(), s1.sessionId(), s1.originalSession().getSubject().getCode(),
                                            s2.sessionId(), s2.originalSession().getSubject().getCode(),
                                            maxTime(s1.startTime(), s2.startTime()), minTime(s1.endTime(), s2.endTime())),
                                    s1.sessionId(), s2.sessionId()));
                        } else {
                            preExistingClashes++;
                            findings.add(createFinding("ROOM_COLLISION", "INFO", true,
                                    String.format("Pre-existing baseline clash: Room %s double-booked between session %d and %d",
                                            s1.room().getCode(), s1.sessionId(), s2.sessionId()),
                                    s1.sessionId(), s2.sessionId()));
                        }
                    }
                }
            }
        }

        // 3. Faculty Double-Booking
        for (int i = 0; i < effectiveSessions.size(); i++) {
            for (int j = i + 1; j < effectiveSessions.size(); j++) {
                EffectiveSession s1 = effectiveSessions.get(i);
                EffectiveSession s2 = effectiveSessions.get(j);

                if (isTimeOverlap(s1.startTime(), s1.endTime(), s2.startTime(), s2.endTime())) {
                    for (Faculty f1 : s1.faculty()) {
                        for (Faculty f2 : s2.faculty()) {
                            if (f1.getId().equals(f2.getId())) {
                                boolean wasInMaster = s1.originalSession().getFaculty().stream().anyMatch(mf1 -> mf1.getId().equals(f1.getId()))
                                        && s2.originalSession().getFaculty().stream().anyMatch(mf2 -> mf2.getId().equals(f1.getId()))
                                        && s1.startTime().equals(s1.originalSession().getStartTime())
                                        && s1.endTime().equals(s1.originalSession().getEndTime())
                                        && s2.startTime().equals(s2.originalSession().getStartTime())
                                        && s2.endTime().equals(s2.originalSession().getEndTime())
                                        && isTimeOverlap(s1.originalSession().getStartTime(), s1.originalSession().getEndTime(),
                                                         s2.originalSession().getStartTime(), s2.originalSession().getEndTime());
                                boolean isNew = !wasInMaster;
                                if (isNew) {
                                    newClashes++;
                                    findings.add(createFinding("FACULTY_DOUBLE_BOOKING", "ERROR", false,
                                            String.format("Faculty %s double-booked between session %d (%s) and session %d (%s) at %s-%s",
                                                    f1.getCode(), s1.sessionId(), s1.originalSession().getSubject().getCode(),
                                                    s2.sessionId(), s2.originalSession().getSubject().getCode(),
                                                    maxTime(s1.startTime(), s2.startTime()), minTime(s1.endTime(), s2.endTime())),
                                            s1.sessionId(), s2.sessionId()));
                                } else {
                                    preExistingClashes++;
                                    findings.add(createFinding("FACULTY_DOUBLE_BOOKING", "INFO", true,
                                            String.format("Pre-existing baseline clash: Faculty %s double-booked between session %d and %d",
                                                    f1.getCode(), s1.sessionId(), s2.sessionId()),
                                            s1.sessionId(), s2.sessionId()));
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Student Group Overlap
        for (int i = 0; i < effectiveSessions.size(); i++) {
            for (int j = i + 1; j < effectiveSessions.size(); j++) {
                EffectiveSession s1 = effectiveSessions.get(i);
                EffectiveSession s2 = effectiveSessions.get(j);

                if (isTimeOverlap(s1.startTime(), s1.endTime(), s2.startTime(), s2.endTime())) {
                    // Unsupervised or placeholder periods with no assigned faculty do not constitute an instructional collision
                    if (s1.faculty().isEmpty() || s2.faculty().isEmpty()) {
                        continue;
                    }
                    for (StudentGroup g1 : s1.groups()) {
                        for (StudentGroup g2 : s2.groups()) {
                            if (groupsOverlap(g1, g2)) {
                                boolean wasInMaster = s1.originalSession().getGroups().stream().anyMatch(mg1 ->
                                        s2.originalSession().getGroups().stream().anyMatch(mg2 -> groupsOverlap(mg1, mg2)))
                                        && s1.startTime().equals(s1.originalSession().getStartTime())
                                        && s1.endTime().equals(s1.originalSession().getEndTime())
                                        && s2.startTime().equals(s2.originalSession().getStartTime())
                                        && s2.endTime().equals(s2.originalSession().getEndTime())
                                        && isTimeOverlap(s1.originalSession().getStartTime(), s1.originalSession().getEndTime(),
                                                         s2.originalSession().getStartTime(), s2.originalSession().getEndTime());
                                boolean isNew = !wasInMaster;
                                if (isNew) {
                                    newClashes++;
                                    findings.add(createFinding("GROUP_COLLISION", "ERROR", false,
                                            String.format("Student group collision between %s (session %d) and %s (session %d) at %s-%s",
                                                    g1.getName(), s1.sessionId(), g2.getName(), s2.sessionId(),
                                                    maxTime(s1.startTime(), s2.startTime()), minTime(s1.endTime(), s2.endTime())),
                                            s1.sessionId(), s2.sessionId()));
                                } else {
                                    preExistingClashes++;
                                    findings.add(createFinding("GROUP_COLLISION", "INFO", true,
                                            String.format("Pre-existing baseline clash: Group collision between %s and %s",
                                                    g1.getName(), g2.getName()),
                                            s1.sessionId(), s2.sessionId()));
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. Disruption Constraints: Room & Faculty Unavailability
        for (Disruption d : disruptions) {
            LocalTime dStart = d.getStartTime() != null ? d.getStartTime() : LocalTime.of(0, 0);
            LocalTime dEnd = d.getEndTime() != null ? d.getEndTime() : LocalTime.of(23, 59);

            if (d.getKind() == Disruption.DisruptionKind.ROOM_UNAVAILABLE && d.getRoom() != null) {
                for (EffectiveSession es : effectiveSessions) {
                    if (es.room() != null && es.room().getId().equals(d.getRoom().getId())) {
                        if (isTimeOverlap(es.startTime(), es.endTime(), dStart, dEnd)) {
                            newClashes++;
                            findings.add(createFinding("ROOM_UNAVAILABLE_VIOLATION", "ERROR", false,
                                    String.format("Session %d (%s) scheduled in closed room %s at %s-%s during disruption",
                                            es.sessionId(), es.originalSession().getSubject().getCode(), es.room().getCode(),
                                            es.startTime(), es.endTime()),
                                    es.sessionId(), null));
                        }
                    }
                }
            } else if (d.getKind() == Disruption.DisruptionKind.FACULTY_UNAVAILABLE && d.getFaculty() != null) {
                for (EffectiveSession es : effectiveSessions) {
                    for (Faculty f : es.faculty()) {
                        if (f.getId().equals(d.getFaculty().getId())) {
                            if (isTimeOverlap(es.startTime(), es.endTime(), dStart, dEnd)) {
                                newClashes++;
                                findings.add(createFinding("ABSENT_FACULTY_VIOLATION", "ERROR", false,
                                        String.format("Session %d (%s) scheduled with absent faculty %s at %s-%s",
                                                es.sessionId(), es.originalSession().getSubject().getCode(), f.getCode(),
                                                es.startTime(), es.endTime()),
                                        es.sessionId(), null));
                            }
                        }
                    }
                }
            }
        }

        // 6. Room Type Integrity & Policy Overrides (Lab Hours Adjustment Rule & Temporary Extra Venues)
        for (EffectiveSession es : effectiveSessions) {
            if (es.sessionType() == TimetableSession.SessionType.LAB) {
                if (es.room() != null && es.room().getRoomType() != Room.RoomType.LAB) {
                    // Check 1: Is this session an EDI / Seminar / Project presentation course?
                    String subjCode = (es.originalSession().getSubject() != null && es.originalSession().getSubject().getCode() != null)
                            ? es.originalSession().getSubject().getCode().toUpperCase() : "";
                    boolean isSeminarOrProject = subjCode.contains("EDI") || subjCode.contains("SEM")
                            || subjCode.contains("PROJ") || subjCode.contains("PBL");

                    // Check 2: Was this room explicitly added as an approved Temporary Extra Venue for this date?
                    boolean isExtraRoomForDate = disruptions.stream().anyMatch(d ->
                            d.getKind() == Disruption.DisruptionKind.EXTRA_ROOM &&
                            d.getRoom() != null &&
                            d.getRoom().getId().equals(es.room().getId()));

                    // Check 3: Does a Lab Hours Adjustment Rule policy permit classrooms / other venues?
                    boolean permittedByPolicy = roomPolicies.stream().anyMatch(rp -> {
                        if (rp.getAllowRoomTypes() == null) return false;
                        boolean typeMatch = rp.getSessionType() == null || rp.getSessionType() == TimetableSession.SessionType.LAB;
                        if (!typeMatch) return false;

                        if (rp.getGroup() != null) {
                            boolean groupMatch = es.originalSession().getGroups().stream()
                                    .anyMatch(g -> g.getId().equals(rp.getGroup().getId()));
                            if (!groupMatch) return false;
                        } else if (rp.getLevel() != null && !rp.getLevel().isBlank() && !"ALL".equalsIgnoreCase(rp.getLevel())) {
                            boolean levelMatch = es.originalSession().getGroups().stream()
                                    .anyMatch(g -> g.getLevel() != null && g.getLevel().equalsIgnoreCase(rp.getLevel()));
                            if (!levelMatch) return false;
                        }

                        for (String art : rp.getAllowRoomTypes()) {
                            if ("CLASSROOM".equalsIgnoreCase(art) || "OTHER".equalsIgnoreCase(art)) return true;
                        }
                        return false;
                    });

                    if (!isSeminarOrProject && !isExtraRoomForDate && !permittedByPolicy) {
                        newClashes++;
                        findings.add(createFinding("LAB_IN_NON_LAB_ROOM", "ERROR", false,
                                String.format("LAB practical session %d (%s) placed in non-lab room %s (%s). Lab sessions must be conducted in labs only, unless Lab Hours Adjustment Rule is applied or temporary extra room is authorized.",
                                        es.sessionId(), es.originalSession().getSubject().getCode(),
                                        es.room().getCode(), es.room().getRoomType()),
                                es.sessionId(), null));
                    }
                }
            }
        }

        // 7. Duration, Recess, Lunch, and Slot Integrity
        for (ScheduleOverride ov : overrides) {
            if (ov.getAction() == ScheduleOverride.Action.MOVE) {
                LocalTime origStart = ov.getOrigStartTime() != null ? ov.getOrigStartTime()
                        : (ov.getSession() != null ? ov.getSession().getStartTime() : null);
                LocalTime origEnd = ov.getOrigEndTime() != null ? ov.getOrigEndTime()
                        : (ov.getSession() != null ? ov.getSession().getEndTime() : null);
                LocalTime newStart = ov.getNewStartTime();
                LocalTime newEnd = ov.getNewEndTime();

                if (newStart == null || newEnd == null || origStart == null || origEnd == null) {
                    newClashes++;
                    findings.add(createFinding("INVALID_MOVE_TIMES", "ERROR", false,
                            String.format("Move override for session %d has null start/end times", ov.getSession().getId()),
                            ov.getSession().getId(), null));
                    continue;
                }

                long origDurationMinutes = Duration.between(origStart, origEnd).toMinutes();
                long newDurationMinutes = Duration.between(newStart, newEnd).toMinutes();

                // Strict duration integrity: 2-hour lab slots cannot be trimmed
                if (origDurationMinutes != newDurationMinutes) {
                    newClashes++;
                    findings.add(createFinding("DURATION_MISMATCH", "ERROR", false,
                            String.format("Move for session %d changed duration from %d mins to %d mins",
                                    ov.getSession().getId(), origDurationMinutes, newDurationMinutes),
                            ov.getSession().getId(), null));
                }

                // Morning recess: 11:00 to 11:15
                if (isTimeOverlap(newStart, newEnd, LocalTime.of(11, 0), LocalTime.of(11, 15))) {
                    newClashes++;
                    findings.add(createFinding("RECESS_OVERLAP", "ERROR", false,
                            String.format("Move for session %d (%s-%s) overlaps morning recess (11:00-11:15)",
                                    ov.getSession().getId(), newStart, newEnd),
                            ov.getSession().getId(), null));
                }

                // Lunch break: 13:15 to 14:00
                if (isTimeOverlap(newStart, newEnd, LocalTime.of(13, 15), LocalTime.of(14, 0))) {
                    newClashes++;
                    findings.add(createFinding("LUNCH_OVERLAP", "ERROR", false,
                            String.format("Move for session %d (%s-%s) overlaps lunch break (13:15-14:00)",
                                    ov.getSession().getId(), newStart, newEnd),
                            ov.getSession().getId(), null));
                }
            }

            // Fixed sessions cannot be modified
            if (ov.getSession().isFixed() && ov.getAction() != null) {
                newClashes++;
                findings.add(createFinding("FIXED_SESSION_MODIFIED", "ERROR", false,
                        String.format("Session %d is marked isFixed=true and cannot be modified by any plan",
                                ov.getSession().getId()),
                        ov.getSession().getId(), null));
            }
        }

        // 8. Hash Calculation
        String planHash = calculatePlanHash(overrides);
        boolean isValid = (newClashes == 0);

        PlanValidation validation = PlanValidation.builder()
                .planId(plan != null ? plan.getId() : null)
                .planHash(planHash)
                .isValid(isValid)
                .newClashesCount(newClashes)
                .preExistingClashesCount(preExistingClashes)
                .findings(findings)
                .validatedAt(Instant.now())
                .validatedBy("SYSTEM_INDEPENDENT_VALIDATOR")
                .build();

        return validationRepo.save(validation);
    }

    private boolean isTimeOverlap(LocalTime start1, LocalTime end1, LocalTime start2, LocalTime end2) {
        return start1.isBefore(end2) && end1.isAfter(start2);
    }

    private LocalTime minTime(LocalTime a, LocalTime b) {
        return a.isBefore(b) ? a : b;
    }

    private LocalTime maxTime(LocalTime a, LocalTime b) {
        return a.isAfter(b) ? a : b;
    }

    private boolean groupsOverlap(StudentGroup a, StudentGroup b) {
        if (a == null || b == null) return false;
        if (a.getId().equals(b.getId())) return true;
        if (a.getParent() != null && a.getParent().getId().equals(b.getId())) return true;
        if (b.getParent() != null && b.getParent().getId().equals(a.getId())) return true;
        return false;
    }

    private Map<String, Object> createFinding(String code, String severity, boolean preExisting,
                                              String description, Long s1, Long s2) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("code", code);
        map.put("severity", severity);
        map.put("preExisting", preExisting);
        map.put("description", description);
        if (s1 != null) map.put("session1Id", s1);
        if (s2 != null) map.put("session2Id", s2);
        return map;
    }

    public String calculatePlanHash(List<ScheduleOverride> overrides) {
        List<ScheduleOverride> sorted = new ArrayList<>(overrides);
        sorted.sort(Comparator.comparing(o -> o.getSession().getId()));

        StringBuilder sb = new StringBuilder();
        for (ScheduleOverride o : sorted) {
            sb.append(o.getSession().getId()).append(":")
                    .append(o.getAction()).append(":")
                    .append(o.getNewStartTime()).append(":")
                    .append(o.getNewEndTime()).append(":")
                    .append(o.getNewRoom() != null ? o.getNewRoom().getId() : "null")
                    .append(";");
        }

        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            return UUID.randomUUID().toString();
        }
    }

    public record EffectiveSession(
            Long sessionId,
            TimetableSession originalSession,
            LocalTime startTime,
            LocalTime endTime,
            Room room,
            Set<Faculty> faculty,
            Set<StudentGroup> groups,
            TimetableSession.SessionType sessionType,
            boolean isModified,
            ScheduleOverride override
    ) {}
}
