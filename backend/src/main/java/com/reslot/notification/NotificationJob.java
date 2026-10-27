package com.reslot.notification;

import com.reslot.masterdata.Faculty;
import com.reslot.masterdata.StudentGroup;
import com.reslot.reschedule.ScheduleOverride;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "notification_jobs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class NotificationJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "override_id", nullable = false)
    private ScheduleOverride override;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "faculty_id")
    private Faculty faculty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private StudentGroup group;

    @Column(nullable = false, columnDefinition = "text")
    private String message;

    @Column(name = "dedupe_key", nullable = false, unique = true)
    private String dedupeKey;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Builder.Default
    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "provider_message_id")
    private String providerMessageId;

    @Column(name = "last_error")
    private String lastError;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "sent_at")
    private Instant sentAt;

    public enum Status {
        PENDING, SENT, DELIVERED, READ, FAILED
    }
}
