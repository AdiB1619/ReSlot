package com.reslot.analytics;

import com.reslot.masterdata.FacultyRepository;
import com.reslot.masterdata.Room;
import com.reslot.masterdata.RoomRepository;
import com.reslot.reschedule.PlanValidationRepository;
import com.reslot.reschedule.ReschedulingRunRepository;
import com.reslot.timetable.TimetableSession;
import com.reslot.timetable.TimetableSessionRepository;
import com.reslot.timetable.TimetableVersionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/v1/analytics")
@Tag(name = "Analytics", description = "Department timetable metrics, room utilization, and solver insights")
public class AnalyticsController {

    private final TimetableVersionRepository versionRepo;
    private final TimetableSessionRepository sessionRepo;
    private final RoomRepository roomRepo;
    private final FacultyRepository facultyRepo;
    private final ReschedulingRunRepository runRepo;
    private final PlanValidationRepository validationRepo;

    public AnalyticsController(
            TimetableVersionRepository versionRepo,
            TimetableSessionRepository sessionRepo,
            RoomRepository roomRepo,
            FacultyRepository facultyRepo,
            ReschedulingRunRepository runRepo,
            PlanValidationRepository validationRepo) {
        this.versionRepo = versionRepo;
        this.sessionRepo = sessionRepo;
        this.roomRepo = roomRepo;
        this.facultyRepo = facultyRepo;
        this.runRepo = runRepo;
        this.validationRepo = validationRepo;
    }

    @GetMapping("/overview")
    @Operation(summary = "Get high-level timetable and operational analytics")
    public AnalyticsOverview getOverview() {
        var activeOpt = versionRepo.findActive();
        long totalSessions = 0;
        long lectureCount = 0;
        long labCount = 0;
        long tutorialCount = 0;
        List<TimetableSession> sessions = Collections.emptyList();

        if (activeOpt.isPresent()) {
            sessions = sessionRepo.findByVersionId(activeOpt.get().getId());
            totalSessions = sessions.size();
            lectureCount = sessions.stream().filter(s -> s.getSessionType() == TimetableSession.SessionType.LECTURE).count();
            labCount = sessions.stream().filter(s -> s.getSessionType() == TimetableSession.SessionType.LAB).count();
            tutorialCount = sessions.stream().filter(s -> s.getSessionType() == TimetableSession.SessionType.TUTORIAL).count();
        }

        long totalRooms = roomRepo.count();
        long totalFaculty = facultyRepo.count();
        long totalRuns = runRepo.count();

        // Compute zero new clashes guarantee rate from independent validation records
        long totalValidations = validationRepo.count();
        long zeroNewClashesCount = validationRepo.countByNewClashesCount(0);
        double zeroNewClashRate = totalValidations > 0 ? (zeroNewClashesCount * 100.0) / totalValidations : 100.0;

        // Dynamic room utilization from active timetable sessions
        List<Room> allRooms = roomRepo.findAll();
        Map<Long, Double> roomHoursMap = new HashMap<>();
        for (TimetableSession s : sessions) {
            if (s.getRoom() != null && s.getStartTime() != null && s.getEndTime() != null) {
                double hours = Duration.between(s.getStartTime(), s.getEndTime()).toMinutes() / 60.0;
                roomHoursMap.merge(s.getRoom().getId(), hours, Double::sum);
            }
        }

        List<RoomUtilization> roomUtilization = new ArrayList<>();
        int capacityWeeklyHours = 42; // Standard 7 hours/day * 6 days
        for (Room r : allRooms) {
            double booked = roomHoursMap.getOrDefault(r.getId(), 0.0);
            double pct = Math.min(100.0, Math.round((booked / capacityWeeklyHours) * 1000.0) / 10.0);
            roomUtilization.add(new RoomUtilization(
                    r.getName() != null && !r.getName().isBlank() ? r.getName() + " (" + r.getCode() + ")" : r.getCode(),
                    pct,
                    (int) Math.round(booked),
                    capacityWeeklyHours
            ));
        }
        roomUtilization.sort(Comparator.comparingDouble(RoomUtilization::utilizationPercent).reversed());
        if (roomUtilization.size() > 8) {
            roomUtilization = roomUtilization.subList(0, 8);
        }

        // Dynamic day-by-day session distribution (Monday = 1 ... Saturday = 6)
        String[] dayNames = {"", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
        List<DayDistribution> dayDistribution = new ArrayList<>();
        for (int d = 1; d <= 6; d++) {
            final int dayNum = d;
            long lecs = sessions.stream().filter(s -> s.getDayOfWeek() == dayNum && s.getSessionType() == TimetableSession.SessionType.LECTURE).count();
            long labs = sessions.stream().filter(s -> s.getDayOfWeek() == dayNum && s.getSessionType() == TimetableSession.SessionType.LAB).count();
            dayDistribution.add(new DayDistribution(dayNames[d], (int) lecs, (int) labs));
        }

        return new AnalyticsOverview(
                totalSessions,
                lectureCount,
                labCount,
                tutorialCount,
                totalRooms,
                totalFaculty,
                totalRuns,
                Math.round(zeroNewClashRate * 10.0) / 10.0,
                roomUtilization,
                dayDistribution
        );
    }

    public record AnalyticsOverview(
            long totalSessions, long lectureCount, long labCount, long tutorialCount,
            long totalRooms, long totalFaculty, long totalRuns, double zeroNewClashRate,
            List<RoomUtilization> roomUtilization,
            List<DayDistribution> dayDistribution
    ) {}

    public record RoomUtilization(String roomName, double utilizationPercent, int bookedHours, int capacityHours) {}
    public record DayDistribution(String day, int lectures, int labs) {}
}
