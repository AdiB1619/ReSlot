package com.reslot.masterdata;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;

@Entity
@Table(name = "lab_blocks")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LabBlock {

    @Id
    private String code;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    @Column
    private String note;
}
