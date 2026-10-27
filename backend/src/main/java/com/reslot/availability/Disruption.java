package com.reslot.availability;

import com.reslot.masterdata.Faculty;
import com.reslot.masterdata.Room;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "disruptions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Disruption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DisruptionKind kind;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "faculty_id")
    private Faculty faculty;

    @Column(nullable = false)
    private LocalDate onDate;

    @Column
    private LocalTime startTime;

    @Column
    private LocalTime endTime;

    @Column
    private String reason;

    @Column
    private String createdBy;

    @Column(nullable = false)
    private Instant createdAt;

    @Builder.Default
    @Column(nullable = false)
    private boolean deleted = false;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public enum DisruptionKind { ROOM_UNAVAILABLE, FACULTY_UNAVAILABLE, EXTRA_ROOM, OTHER }
}
