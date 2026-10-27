package com.reslot.reschedule;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "plan_validations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlanValidation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plan_id")
    private Long planId;

    @Column(name = "plan_hash", nullable = false)
    private String planHash;

    @Column(name = "is_valid", nullable = false)
    private boolean isValid;

    @Column(name = "new_clashes_count", nullable = false)
    private int newClashesCount;

    @Column(name = "pre_existing_clashes_count", nullable = false)
    private int preExistingClashesCount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> findings = new ArrayList<>();

    @Builder.Default
    @Column(name = "validated_at", nullable = false)
    private Instant validatedAt = Instant.now();

    @Builder.Default
    @Column(name = "validated_by", nullable = false)
    private String validatedBy = "SYSTEM_VALIDATOR";
}
