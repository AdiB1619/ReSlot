package com.reslot.reschedule;

import com.reslot.timetable.TimetableVersion;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "rescheduling_runs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReschedulingRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_id", nullable = false)
    private TimetableVersion version;

    @Column(name = "on_date", nullable = false)
    private LocalDate onDate;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "inputs", nullable = false)
    private String inputs;

    @Column(name = "status", nullable = false)
    private String status; // SOLVED, INFEASIBLE, FAILED

    @Column(name = "moved_sessions")
    private Integer movedSessions;

    @Column(name = "solve_ms")
    private Integer solveMs;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "summary")
    private String summary;

    @Column(name = "created_by")
    private String createdBy;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
