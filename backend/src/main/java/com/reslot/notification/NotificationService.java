package com.reslot.notification;

import com.reslot.masterdata.Faculty;
import com.reslot.masterdata.Room;
import com.reslot.masterdata.StudentGroup;
import com.reslot.reschedule.ScheduleOverride;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationJobRepository jobRepo;
    private final com.reslot.reschedule.ScheduleOverrideRepository overrideRepo;
    private final WhatsAppCloudApiClient whatsAppClient;

    public NotificationService(
            NotificationJobRepository jobRepo,
            com.reslot.reschedule.ScheduleOverrideRepository overrideRepo,
            WhatsAppCloudApiClient whatsAppClient) {
        this.jobRepo = jobRepo;
        this.overrideRepo = overrideRepo;
        this.whatsAppClient = whatsAppClient;
    }

    public List<BroadcastDraft> getBroadcastDrafts(java.time.LocalDate date) {
        List<ScheduleOverride> overrides = new ArrayList<>(overrideRepo.findByOnDate(date).stream()
                .filter(o -> o.getStatus() == ScheduleOverride.Status.PUBLISHED)
                .toList());

        List<BroadcastDraft> drafts = new ArrayList<>();
        if (overrides.isEmpty()) {
            return drafts;
        }

        // Canonical bulletin order: DT, SEM, PL-II-JAVA, OS, EDI-III
        List<String> targetOrder = List.of("DT", "SEM", "PL-II-JAVA", "OS", "EDI-III");
        overrides.sort((o1, o2) -> {
            String c1 = o1.getSession().getSubject() != null ? o1.getSession().getSubject().getCode() : "";
            String c2 = o2.getSession().getSubject() != null ? o2.getSession().getSubject().getCode() : "";
            int i1 = targetOrder.indexOf(c1);
            int i2 = targetOrder.indexOf(c2);
            if (i1 != -1 && i2 != -1) {
                return Integer.compare(i1, i2);
            }
            if (i1 != -1) return -1;
            if (i2 != -1) return 1;
            return o1.getOrigStartTime().compareTo(o2.getOrigStartTime());
        });

        // 1. Per-Faculty Drafts
        Map<Faculty, List<ScheduleOverride>> byFaculty = new LinkedHashMap<>();
        for (ScheduleOverride o : overrides) {
            for (Faculty f : o.getSession().getFaculty()) {
                byFaculty.computeIfAbsent(f, k -> new ArrayList<>()).add(o);
            }
        }
        for (var entry : byFaculty.entrySet()) {
            Faculty f = entry.getKey();
            List<ScheduleOverride> list = entry.getValue();
            StringBuilder sb = new StringBuilder();
            sb.append("*RSCOE Timetable Notice*\n\n");
            String cleanName = f.getFullName() != null ? f.getFullName().replaceFirst("^(Prof\\.|Dr\\.)\\s*", "") : f.getCode();
            sb.append(String.format("Dear Prof. %s,\n", cleanName));
            sb.append(String.format("Please note the venue/slot updates for *%s*:\n\n", date));
            for (ScheduleOverride o : list) {
                var s = o.getSession();
                String sub = s.getSubject() != null && s.getSubject().getName() != null && !s.getSubject().getName().isBlank()
                        ? s.getSubject().getName()
                        : (s.getSubject() != null ? s.getSubject().getCode() : "Subject");
                sb.append(String.format("• *%s* (%s - %s)\n", sub, o.getOrigStartTime(), o.getOrigEndTime()));
                sb.append(String.format("  Venue: *%s* (Orig: %s)\n",
                        formatVenue(o.getNewRoom()),
                        formatVenue(o.getOrigRoom())));
                if (o.getReason() != null) {
                    sb.append(String.format("  Reason: %s\n", o.getReason()));
                }
            }
            sb.append("\nKindly conduct the session at the reassigned venue.\n— Prof. Pooja Thakre, Timetable Coordinator, RSCOE Comp. Dept.");
            drafts.add(new BroadcastDraft(
                    "fac-" + f.getId(),
                    "FACULTY",
                    f.getFullName() != null ? f.getFullName() : ("Prof. " + f.getCode()),
                    "Faculty (" + f.getCode() + ") · " + list.size() + " session(s)",
                    f.getWhatsappE164(),
                    sb.toString()
            ));
        }

        // 2. Per-Student Group / Class Drafts
        Map<StudentGroup, List<ScheduleOverride>> byGroup = new LinkedHashMap<>();
        for (ScheduleOverride o : overrides) {
            for (StudentGroup g : o.getSession().getGroups()) {
                byGroup.computeIfAbsent(g, k -> new ArrayList<>()).add(o);
            }
        }
        for (var entry : byGroup.entrySet()) {
            StudentGroup g = entry.getKey();
            List<ScheduleOverride> list = entry.getValue();
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("*Notice for Students: %s*\n\n", g.getName()));
            sb.append(String.format("Date: *%s*\n\n", date));
            sb.append("Please note the venue change for today's session(s):\n");
            for (ScheduleOverride o : list) {
                var s = o.getSession();
                String sub = s.getSubject() != null && s.getSubject().getName() != null && !s.getSubject().getName().isBlank()
                        ? s.getSubject().getName()
                        : (s.getSubject() != null ? s.getSubject().getCode() : "Subject");
                sb.append(String.format("• *%s* (%s - %s)\n", sub, o.getOrigStartTime(), o.getOrigEndTime()));
                sb.append(String.format("  New Venue: *%s*\n", formatVenue(o.getNewRoom())));
                if (o.getReason() != null) {
                    sb.append(String.format("  Reason: %s\n", o.getReason()));
                }
            }
            sb.append("\nPlease assemble on time and inform batchmates.\n— Prof. Pooja Thakre, Timetable Coordinator, Dept. of Computer Engineering, RSCOE");
            drafts.add(new BroadcastDraft(
                    "grp-" + g.getId(),
                    "STUDENT_GROUP",
                    g.getName() + " Broadcast",
                    "Class / Batch Cohort · " + list.size() + " session(s)",
                    null,
                    sb.toString()
            ));
        }

        // 3. Consolidated Department Notice
        StringBuilder dept = new StringBuilder();
        dept.append("*DEPARTMENT OF COMPUTER ENGINEERING - RSCOE*\n");
        dept.append(String.format("*Daily Reschedule Summary for %s*\n\n", date));
        dept.append(String.format("Total Sessions Reallocated: %d\n", overrides.size()));
        dept.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        int idx = 1;
        for (ScheduleOverride o : overrides) {
            var s = o.getSession();
            String sub = s.getSubject() != null ? s.getSubject().getCode() : "SUB";
            String grp = s.getGroups().stream().map(StudentGroup::getName).collect(java.util.stream.Collectors.joining(", "));
            String fac = s.getFaculty().stream().map(Faculty::getCode).collect(java.util.stream.Collectors.joining(", "));
            dept.append(String.format("%d. *%s* (%s) | %s - %s\n", idx++, sub, grp, o.getOrigStartTime(), o.getOrigEndTime()));
            if (o.getAction() == ScheduleOverride.Action.CANCEL) {
                dept.append(String.format("   Fac: %s | Status: *CANCELLED* (No vacant lab/classroom available)\n", fac));
            } else if (o.getAction() == ScheduleOverride.Action.MOVE) {
                dept.append(String.format("   Fac: %s | Rescheduled: %s - %s | Venue: %s -> *%s*\n",
                        fac, o.getNewStartTime(), o.getNewEndTime(),
                        formatVenue(o.getOrigRoom()),
                        formatVenue(o.getNewRoom())));
            } else {
                dept.append(String.format("   Fac: %s | Venue: %s -> *%s*\n",
                        fac,
                        formatVenue(o.getOrigRoom()),
                        formatVenue(o.getNewRoom())));
            }
            if (o.getReason() != null && !o.getReason().isBlank()) {
                dept.append(String.format("   Note: %s\n", o.getReason()));
            }
        }
        dept.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        dept.append("Zero new clashes verified. All other sessions proceed as per master timetable.\n");
        dept.append("Kindly refer to ReSlot live portal for student & faculty personal views.\n");
        dept.append("— Prof. Pooja Thakre, Timetable Coordinator, Department of Computer Engineering, RSCOE\n");
        drafts.add(0, new BroadcastDraft(
                "dept-master",
                "DEPARTMENT_MASTER",
                "Department Daily Master Bulletin",
                "Consolidated announcement for all staff & CR groups",
                null,
                dept.toString()
        ));

        return drafts;
    }

    public record BroadcastDraft(
            String id,
            String category,
            String recipientTitle,
            String recipientSubtitle,
            String phone,
            String messageText
    ) {}

    @Transactional
    public List<NotificationJob> queueNotificationsForOverride(ScheduleOverride override) {
        List<NotificationJob> jobs = new ArrayList<>();
        var session = override.getSession();

        // 1. Notifications for each faculty member
        for (Faculty faculty : session.getFaculty()) {
            String dedupeKey = String.format("override:%d:faculty:%d", override.getId(), faculty.getId());
            if (jobRepo.findByDedupeKey(dedupeKey).isPresent()) {
                continue;
            }

            String msg = composeFacultyMessage(faculty, override);
            NotificationJob job = NotificationJob.builder()
                    .override(override)
                    .faculty(faculty)
                    .message(msg)
                    .dedupeKey(dedupeKey)
                    .status(NotificationJob.Status.PENDING)
                    .createdAt(Instant.now())
                    .build();
            jobs.add(jobRepo.save(job));
        }

        // 2. Notifications for student groups
        for (StudentGroup group : session.getGroups()) {
            String dedupeKey = String.format("override:%d:group:%d", override.getId(), group.getId());
            if (jobRepo.findByDedupeKey(dedupeKey).isPresent()) {
                continue;
            }

            String msg = composeStudentMessage(group, override);
            NotificationJob job = NotificationJob.builder()
                    .override(override)
                    .group(group)
                    .message(msg)
                    .dedupeKey(dedupeKey)
                    .status(NotificationJob.Status.PENDING)
                    .createdAt(Instant.now())
                    .build();
            jobs.add(jobRepo.save(job));
        }

        return jobs;
    }

    public static String formatVenue(Room room) {
        if (room == null) return "TBD";
        String code = room.getCode() != null ? room.getCode() : "TBD";
        String name = room.getName();
        if (name != null && !name.isBlank() && !name.equalsIgnoreCase(code)) {
            return code + " (" + name + ")";
        }
        return code;
    }

    private String composeFacultyMessage(Faculty faculty, ScheduleOverride override) {
        var session = override.getSession();
        String subject = session.getSubject() != null && session.getSubject().getName() != null && !session.getSubject().getName().isBlank()
                ? session.getSubject().getName()
                : (session.getSubject() != null ? session.getSubject().getCode() : "Session");
        String actionText = switch (override.getAction()) {
            case ROOM_CHANGE -> String.format("Venue changed to *%s* (Orig: %s)",
                    formatVenue(override.getNewRoom()),
                    formatVenue(override.getOrigRoom()));
            case MOVE -> String.format("Rescheduled to %s - %s in Venue: *%s*",
                    override.getNewStartTime(), override.getNewEndTime(),
                    formatVenue(override.getNewRoom()));
            case CANCEL -> "Cancelled due to unavailability.";
        };

        String cleanName = faculty.getFullName() != null ? faculty.getFullName().replaceFirst("^(Prof\\.|Dr\\.)\\s*", "") : faculty.getCode();
        return String.format(
                "*RSCOE Timetable Notice*\n\nDear Prof. %s,\nYour session for *%s* on *%s* (%s - %s) has an approved update:\nStatus: %s\n\nReason: %s\n\nKindly conduct the session at the reassigned venue.\n— Prof. Pooja Thakre, Timetable Coordinator, RSCOE Comp. Dept.",
                cleanName,
                subject,
                override.getOnDate(),
                override.getOrigStartTime(),
                override.getOrigEndTime(),
                actionText,
                override.getReason() != null ? override.getReason() : "Schedule Optimization"
        );
    }

    private String composeStudentMessage(StudentGroup group, ScheduleOverride override) {
        var session = override.getSession();
        String subject = session.getSubject() != null && session.getSubject().getName() != null && !session.getSubject().getName().isBlank()
                ? session.getSubject().getName()
                : (session.getSubject() != null ? session.getSubject().getCode() : "Subject");
        String actionText = switch (override.getAction()) {
            case ROOM_CHANGE -> String.format("Shifted to Venue: *%s*",
                    formatVenue(override.getNewRoom()));
            case MOVE -> String.format("Rescheduled to %s - %s (Venue: *%s*)",
                    override.getNewStartTime(), override.getNewEndTime(),
                    formatVenue(override.getNewRoom()));
            case CANCEL -> "Session cancelled for today.";
        };

        return String.format(
                "*Notice for Students: %s*\n\nDate: *%s*\nSubject: *%s*\nOriginal Time: %s - %s\nUpdate: %s\n\nPlease check your student portal for the full daily timetable.\n— Prof. Pooja Thakre, Timetable Coordinator, Dept. of Computer Engineering, RSCOE",
                group.getName(),
                override.getOnDate(),
                subject,
                override.getOrigStartTime(),
                override.getOrigEndTime(),
                actionText
        );
    }

    @Transactional
    public void dispatchPendingJobs() {
        List<NotificationJob> pending = jobRepo.findByStatus(NotificationJob.Status.PENDING);
        for (NotificationJob job : pending) {
            try {
                String recipientPhone = null;
                if (job.getFaculty() != null && job.getFaculty().getWhatsappE164() != null) {
                    recipientPhone = job.getFaculty().getWhatsappE164();
                }
                String providerId = whatsAppClient.sendTextMessage(recipientPhone, job.getMessage());
                job.setStatus(NotificationJob.Status.SENT);
                job.setProviderMessageId(providerId);
                job.setSentAt(Instant.now());
                job.setAttempts(job.getAttempts() + 1);
                jobRepo.save(job);
                log.info("Dispatched notification job id={} [providerId={}]", job.getId(), providerId);
            } catch (Exception e) {
                job.setStatus(NotificationJob.Status.FAILED);
                job.setLastError(e.getMessage());
                job.setAttempts(job.getAttempts() + 1);
                jobRepo.save(job);
            }
        }
    }

    @Transactional
    public void deleteJobsForOverride(ScheduleOverride o) {
        List<NotificationJob> jobs = jobRepo.findByOverrideId(o.getId());
        if (!jobs.isEmpty()) {
            jobRepo.deleteAll(jobs);
        }
    }

    @Transactional
    public void clearAllForDate(java.time.LocalDate date) {
        List<ScheduleOverride> overrides = overrideRepo.findByOnDate(date);
        for (ScheduleOverride o : overrides) {
            deleteJobsForOverride(o);
        }
    }

    public List<NotificationJob> listRecent() {
        return jobRepo.findRecent();
    }
}
