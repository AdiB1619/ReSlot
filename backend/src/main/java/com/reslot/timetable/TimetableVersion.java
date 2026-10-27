package com.reslot.timetable;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "timetable_versions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TimetableVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "academic_year", nullable = false)
    private String academicYear;

    @Column(nullable = false)
    private String semester;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VersionStatus status = VersionStatus.DRAFT;

    @Column(name = "source_file")
    private String sourceFile;

    @Column(name = "source_sha256", unique = true)
    private String sourceSha256;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "created_by")
    private String createdBy;

    public enum VersionStatus { DRAFT, ACTIVE, ARCHIVED }
}
