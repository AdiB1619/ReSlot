package com.reslot.availability;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface DisruptionRepository extends JpaRepository<Disruption, Long> {

    @Query("SELECT d FROM Disruption d WHERE d.onDate = :date AND d.deleted = false")
    List<Disruption> findByDate(LocalDate date);

    @Query("SELECT d FROM Disruption d WHERE d.onDate >= :from AND d.onDate <= :to AND d.deleted = false")
    List<Disruption> findByDateRange(LocalDate from, LocalDate to);

    default List<Disruption> findByOnDate(LocalDate onDate) {
        return findByDate(onDate);
    }
}
