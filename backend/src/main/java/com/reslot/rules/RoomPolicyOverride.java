package com.reslot.rules;

import com.reslot.masterdata.StudentGroup;
import com.reslot.timetable.TimetableSession.SessionType;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "room_policy_overrides")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RoomPolicyOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "on_date", nullable = false)
    private LocalDate onDate;

    @Column
    private String level; // FY, SY, TY, BE

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private StudentGroup group;

    @Enumerated(EnumType.STRING)
    @Column(name = "session_type", nullable = false)
    @Builder.Default
    private SessionType sessionType = SessionType.LAB;

    @Column(name = "allow_room_types", nullable = false)
    private String[] allowRoomTypes;

    @Column(nullable = false)
    @Builder.Default
    private String layout = "ONE_ROOM_PER_BATCH"; // ONE_ROOM_PER_BATCH or MERGE_BATCHES

    @Column(name = "confirmed_by")
    private String confirmedBy;

    @Column
    private String reason;

    @Column(name = "created_by")
    private String createdBy;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
