package com.reslot.masterdata;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "faculty_aliases")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FacultyAlias {

    @Id
    @Column(nullable = false, unique = true)
    private String alias;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "faculty_id", nullable = false)
    private Faculty faculty;
}
