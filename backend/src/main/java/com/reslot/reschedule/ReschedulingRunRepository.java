package com.reslot.reschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface ReschedulingRunRepository extends JpaRepository<ReschedulingRun, Long> {
    List<ReschedulingRun> findByOnDateOrderByCreatedAtDesc(LocalDate onDate);
    
    @Query("SELECT r FROM ReschedulingRun r ORDER BY r.createdAt DESC")
    List<ReschedulingRun> findRecent();
}
