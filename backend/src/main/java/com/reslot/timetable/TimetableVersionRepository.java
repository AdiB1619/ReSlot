package com.reslot.timetable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface TimetableVersionRepository extends JpaRepository<TimetableVersion, Long> {

    Optional<TimetableVersion> findBySourceSha256(String sha256);

    @Query("SELECT v FROM TimetableVersion v WHERE v.status = 'ACTIVE'")
    Optional<TimetableVersion> findActive();
}
