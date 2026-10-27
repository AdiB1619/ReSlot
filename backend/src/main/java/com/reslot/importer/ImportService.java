package com.reslot.importer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.reslot.audit.AuditService;
import com.reslot.availability.Disruption;
import com.reslot.availability.DisruptionRepository;
import com.reslot.masterdata.*;
import com.reslot.rules.RoomPolicyOverride;
import com.reslot.rules.RoomPolicyOverrideRepository;
import com.reslot.shared.ApiException;
import com.reslot.timetable.TimetableVersion;
import com.reslot.timetable.TimetableVersionRepository;
import com.reslot.timetable.TimetableSession.SessionType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class ImportService {

    private static final Logger log = LoggerFactory.getLogger(ImportService.class);

    private final ObjectMapper objectMapper;
    private final RoomRepository roomRepo;
    private final FacultyRepository facultyRepo;
    private final StudentGroupRepository groupRepo;
    private final DisruptionRepository disruptionRepo;
    private final RoomPolicyOverrideRepository ruleRepo;
    private final TimetableVersionRepository versionRepo;
    private final AuditService auditService;

    public ImportService(
            ObjectMapper objectMapper,
            RoomRepository roomRepo,
            FacultyRepository facultyRepo,
            StudentGroupRepository groupRepo,
            DisruptionRepository disruptionRepo,
            RoomPolicyOverrideRepository ruleRepo,
            TimetableVersionRepository versionRepo,
            AuditService auditService) {
        this.objectMapper = objectMapper;
        this.roomRepo = roomRepo;
        this.facultyRepo = facultyRepo;
        this.groupRepo = groupRepo;
        this.disruptionRepo = disruptionRepo;
        this.ruleRepo = ruleRepo;
        this.versionRepo = versionRepo;
        this.auditService = auditService;
    }

    @Transactional
    public IngestionResult importCanonicalJson(String jsonString, String user) {
        try {
            JsonNode root = objectMapper.readTree(jsonString);
            String dateStr = root.has("date") ? root.get("date").asText() : LocalDate.now().toString();
            LocalDate date = LocalDate.parse(dateStr);

            int disruptionsCreated = 0;
            int rulesCreated = 0;

            // 1. Process unavailable rooms
            if (root.has("unavailable")) {
                for (JsonNode u : root.get("unavailable")) {
                    String roomCode = u.get("room").asText();
                    LocalTime from = u.has("from") && !u.get("from").isNull() && !u.get("from").asText().isBlank()
                            ? LocalTime.parse(u.get("from").asText()) : null;
                    LocalTime to = u.has("to") && !u.get("to").isNull() && !u.get("to").asText().isBlank()
                            ? LocalTime.parse(u.get("to").asText()) : null;
                    String reason = u.has("reason") ? u.get("reason").asText() : "Unavailable";

                    Room room = roomRepo.findByCode(roomCode)
                            .orElseThrow(() -> ApiException.validationFailed("Unknown room code in unavailable list: " + roomCode));
                    Disruption d = Disruption.builder()
                            .kind(Disruption.DisruptionKind.ROOM_UNAVAILABLE)
                            .room(room)
                            .onDate(date)
                            .startTime(from)
                            .endTime(to)
                            .reason(reason)
                            .createdBy(user)
                            .build();
                    disruptionRepo.save(d);
                    disruptionsCreated++;
                }
            }

            // 2. Process faculty unavailable
            if (root.has("faculty_unavailable")) {
                for (JsonNode fu : root.get("faculty_unavailable")) {
                    String facultyCode = fu.get("faculty").asText();
                    LocalTime from = fu.has("from") && !fu.get("from").isNull() && !fu.get("from").asText().isBlank()
                            ? LocalTime.parse(fu.get("from").asText()) : null;
                    LocalTime to = fu.has("to") && !fu.get("to").isNull() && !fu.get("to").asText().isBlank()
                            ? LocalTime.parse(fu.get("to").asText()) : null;
                    String reason = fu.has("reason") ? fu.get("reason").asText() : "On leave";

                    Faculty faculty = facultyRepo.findByCode(facultyCode)
                            .orElseThrow(() -> ApiException.validationFailed("Unknown faculty code in faculty_unavailable list: " + facultyCode));
                    Disruption d = Disruption.builder()
                            .kind(Disruption.DisruptionKind.FACULTY_UNAVAILABLE)
                            .faculty(faculty)
                            .onDate(date)
                            .startTime(from)
                            .endTime(to)
                            .reason(reason)
                            .createdBy(user)
                            .build();
                    disruptionRepo.save(d);
                    disruptionsCreated++;
                }
            }

            // 3. Process extra rooms
            if (root.has("extra_rooms")) {
                JsonNode extra = root.get("extra_rooms");
                if (extra.has("classrooms")) {
                    for (JsonNode c : extra.get("classrooms")) {
                        String id = c.get("id").asText();
                        Room room = roomRepo.findByCode(id).orElseGet(() -> {
                            Room r = Room.builder()
                                    .code(id)
                                    .name("Temporary Classroom " + id)
                                    .roomType(Room.RoomType.CLASSROOM)
                                    .capacity(60)
                                    .isTemporary(true)
                                    .build();
                            return roomRepo.save(r);
                        });

                        LocalTime from = c.has("from") && !c.get("from").isNull() && !c.get("from").asText().isBlank()
                                ? LocalTime.parse(c.get("from").asText()) : null;
                        LocalTime to = c.has("to") && !c.get("to").isNull() && !c.get("to").asText().isBlank()
                                ? LocalTime.parse(c.get("to").asText()) : null;
                        Disruption d = Disruption.builder()
                                .kind(Disruption.DisruptionKind.EXTRA_ROOM)
                                .room(room)
                                .onDate(date)
                                .startTime(from)
                                .endTime(to)
                                .reason("Extra Classroom")
                                .createdBy(user)
                                .build();
                        disruptionRepo.save(d);
                        disruptionsCreated++;
                    }
                }
            }

            // 4. Process room rules
            if (root.has("room_rules")) {
                for (JsonNode r : root.get("room_rules")) {
                    String level = null;
                    StudentGroup targetGroup = null;
                    if (r.has("scope")) {
                        JsonNode scope = r.get("scope");
                        if (scope.has("level") && !scope.get("level").isNull()) {
                            level = scope.get("level").asText();
                        }
                        if (scope.has("division") && !scope.get("division").isNull()) {
                            String divName = scope.get("division").asText();
                            targetGroup = groupRepo.findByName(divName).orElse(null);
                        }
                    }
                    SessionType sType = SessionType.LAB;
                    if (r.has("sessions")) {
                        try {
                            sType = SessionType.valueOf(r.get("sessions").asText().toUpperCase());
                        } catch (Exception ignored) {}
                    }
                    String layout = r.has("layout") ? r.get("layout").asText() : "ONE_ROOM_PER_BATCH";
                    String confirmedBy = r.has("confirmed_by") ? r.get("confirmed_by").asText() : null;
                    String reason = r.has("reason") ? r.get("reason").asText() : "Room rule";

                    List<String> allow = new ArrayList<>();
                    if (r.has("allow")) {
                        for (JsonNode a : r.get("allow")) {
                            allow.add(a.asText());
                        }
                    }

                    RoomPolicyOverride rule = RoomPolicyOverride.builder()
                            .onDate(date)
                            .level(level)
                            .group(targetGroup)
                            .sessionType(sType)
                            .allowRoomTypes(allow.isEmpty() ? new String[]{"CLASSROOM"} : allow.toArray(new String[0]))
                            .layout(layout)
                            .confirmedBy(confirmedBy)
                            .reason(reason)
                            .createdBy(user)
                            .build();
                    ruleRepo.save(rule);
                    rulesCreated++;
                }
            }

            auditService.record(user, "IMPORT_CANONICAL_JSON", "disruptions", null,
                    String.format("Imported %d disruptions and %d rules for %s", disruptionsCreated, rulesCreated, date));

            return new IngestionResult(true, date.toString(), disruptionsCreated, rulesCreated, "Successfully imported canonical JSON payload");
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse canonical input JSON", e);
            throw new ApiException(com.reslot.shared.ErrorCode.VALIDATION_FAILED, "Failed to parse JSON: " + e.getMessage());
        }
    }

    @Transactional
    public void activateVersion(Long versionId, String user) {
        TimetableVersion target = versionRepo.findById(versionId)
                .orElseThrow(() -> ApiException.notFound("Version not found: " + versionId));

        // Deactivate currently active version
        versionRepo.findActive().ifPresent(v -> {
            v.setStatus(TimetableVersion.VersionStatus.ARCHIVED);
            versionRepo.saveAndFlush(v);
        });

        target.setStatus(TimetableVersion.VersionStatus.ACTIVE);
        versionRepo.saveAndFlush(target);

        auditService.record(user, "ACTIVATE_TIMETABLE_VERSION", "timetable_versions", target.getId(),
                "Activated timetable version: " + target.getName());
    }

    public record IngestionResult(boolean success, String date, int disruptionsImported, int rulesImported, String message) {}
}
