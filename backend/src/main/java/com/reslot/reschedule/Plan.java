package com.reslot.reschedule;

import com.reslot.timetable.TimetableVersion;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "plans")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Plan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "run_id", nullable = false)
    private Long runId;

    @Column(nullable = false)
    private String label;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private PlanStatus status = PlanStatus.PROPOSED;

    @Column(name = "plan_hash")
    private String planHash;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "master_version_id")
    private TimetableVersion masterVersion;

    @Column(name = "validation_id")
    private Long validationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metrics = new HashMap<>();

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "published_by")
    private String publishedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Version
    @Builder.Default
    @Column(nullable = false)
    private Long version = 0L;

    @PreUpdate
    public void onPreUpdate() {
        this.updatedAt = Instant.now();
    }
}
