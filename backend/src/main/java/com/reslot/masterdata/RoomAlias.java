package com.reslot.masterdata;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "room_aliases")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RoomAlias {

    @Id
    @Column(nullable = false, unique = true)
    private String alias;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;
}
