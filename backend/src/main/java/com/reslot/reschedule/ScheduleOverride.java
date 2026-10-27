package com.reslot.reschedule;

import com.reslot.availability.Disruption;
import com.reslot.masterdata.Room;
import com.reslot.timetable.TimetableSession;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "schedule_overrides")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScheduleOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "disruption_id")
    private Disruption disruption;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "run_id")
    private ReschedulingRun run;

    @Column(name = "plan_id")
    private Long planId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private TimetableSession session;

    @Column(name = "on_date", nullable = false)
    private LocalDate onDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Action action; // MOVE, ROOM_CHANGE, CANCEL

    @Column(name = "orig_start_time", nullable = false)
    private LocalTime origStartTime;

    @Column(name = "orig_end_time", nullable = false)
    private LocalTime origEndTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "orig_room_id")
    private Room origRoom;

    @Column(name = "new_start_time")
    private LocalTime newStartTime;

    @Column(name = "new_end_time")
    private LocalTime newEndTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "new_room_id")
    private Room newRoom;

    @Column
    private String reason;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Status status = Status.PROPOSED; // PROPOSED, APPROVED, PUBLISHED, REJECTED

    @Builder.Default
    @Column(name = "proposed_at", nullable = false)
    private Instant proposedAt = Instant.now();

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    public enum Action {
        MOVE, ROOM_CHANGE, CANCEL
    }

    public enum Status {
        PROPOSED, APPROVED, PUBLISHED, REJECTED
    }
}
