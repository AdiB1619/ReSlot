package com.reslot.masterdata;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "student_groups")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class StudentGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private String level; // FY, SY, TY, BE

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GroupKind kind;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private StudentGroup parent;

    @Column(name = "partition_key")
    private String partitionKey;

    @Column
    private Integer strength;

    public enum GroupKind { DIVISION, BATCH, ELECTIVE }
}
