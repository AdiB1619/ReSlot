package com.reslot.conflict;

import com.reslot.timetable.TimetableSession;
import com.reslot.timetable.TimetableSessionRepository;
import com.reslot.timetable.TimetableVersionRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ConflictService {

    private final TimetableVersionRepository versionRepo;
    private final TimetableSessionRepository sessionRepo;

    public ConflictService(TimetableVersionRepository versionRepo, TimetableSessionRepository sessionRepo) {
        this.versionRepo = versionRepo;
        this.sessionRepo = sessionRepo;
    }

    public List<ClashReport> findBaselineClashes() {
        var activeOpt = versionRepo.findActive();
        if (activeOpt.isEmpty()) return List.of();

        List<TimetableSession> sessions = sessionRepo.findByVersionId(activeOpt.get().getId());
        List<ClashReport> clashes = new ArrayList<>();

        for (int i = 0; i < sessions.size(); i++) {
            for (int j = i + 1; j < sessions.size(); j++) {
                var s1 = sessions.get(i);
                var s2 = sessions.get(j);

                if (s1.getDayOfWeek() != s2.getDayOfWeek()) continue;
                // Check time overlap
                if (s1.getStartTime().isBefore(s2.getEndTime()) && s1.getEndTime().isAfter(s2.getStartTime())) {
                    // Room collision
                    if (s1.getRoom() != null && s2.getRoom() != null && s1.getRoom().getId().equals(s2.getRoom().getId())) {
                        clashes.add(new ClashReport(
                                "ROOM_COLLISION",
                                "BASELINE",
                                String.format("Room %s double-booked on Day %d (%s-%s)", s1.getRoom().getCode(), s1.getDayOfWeek(), s1.getStartTime(), s1.getEndTime()),
                                s1.getId(), s2.getId(), s1.getSubject().getCode(), s2.getSubject().getCode()
                        ));
                    }
                    // Faculty collision
                    for (var f1 : s1.getFaculty()) {
                        for (var f2 : s2.getFaculty()) {
                            if (f1.getId().equals(f2.getId())) {
                                clashes.add(new ClashReport(
                                        "FACULTY_DOUBLE_BOOKING",
                                        "BASELINE",
                                        String.format("Faculty %s double-booked on Day %d (%s-%s)", f1.getCode(), s1.getDayOfWeek(), s1.getStartTime(), s1.getEndTime()),
                                        s1.getId(), s2.getId(), s1.getSubject().getCode(), s2.getSubject().getCode()
                                ));
                            }
                        }
                    }
                }
            }
        }

        return clashes;
    }

    public record ClashReport(
            String clashType, String category, String description,
            Long session1Id, Long session2Id, String subject1, String subject2
    ) {}
}
