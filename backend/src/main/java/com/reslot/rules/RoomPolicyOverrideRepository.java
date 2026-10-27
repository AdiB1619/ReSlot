package com.reslot.rules;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface RoomPolicyOverrideRepository extends JpaRepository<RoomPolicyOverride, Long> {
    List<RoomPolicyOverride> findByOnDate(LocalDate onDate);
    void deleteByOnDate(LocalDate onDate);
}
