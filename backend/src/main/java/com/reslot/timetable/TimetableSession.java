package com.reslot.timetable;

import com.reslot.masterdata.*;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "timetable_sessions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class TimetableSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_id", nullable = false)
    private TimetableVersion version;

    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek; // 1=Mon .. 6=Sat

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @Column(name = "raw_room")
    private String rawRoom;

    @Column(name = "raw_faculty")
    private String rawFaculty;

    @Enumerated(EnumType.STRING)
    @Column(name = "session_type", nullable = false)
    private SessionType sessionType;

    @Builder.Default
    @Column(name = "is_fixed", nullable = false)
    private boolean isFixed = false;

    @Column(name = "source_ref")
    private String sourceRef;

    @Builder.Default
    @Column(name = "needs_review", nullable = false)
    private boolean needsReview = false;

    @Column(name = "review_note")
    private String reviewNote;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "session_groups",
            joinColumns = @JoinColumn(name = "session_id"),
            inverseJoinColumns = @JoinColumn(name = "group_id"))
    @Builder.Default
    private Set<StudentGroup> groups = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "session_faculty",
            joinColumns = @JoinColumn(name = "session_id"),
            inverseJoinColumns = @JoinColumn(name = "faculty_id"))
    @Builder.Default
    private Set<Faculty> faculty = new HashSet<>();

    public enum SessionType { LECTURE, LAB, TUTORIAL, OTHER }
}
