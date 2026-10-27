package com.reslot.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface NotificationJobRepository extends JpaRepository<NotificationJob, Long> {
    Optional<NotificationJob> findByDedupeKey(String dedupeKey);
    List<NotificationJob> findByStatus(NotificationJob.Status status);

    @Query("SELECT n FROM NotificationJob n ORDER BY n.createdAt DESC")
    List<NotificationJob> findRecent();

    @Query("SELECT n FROM NotificationJob n WHERE n.override.id = :overrideId")
    List<NotificationJob> findByOverrideId(Long overrideId);
}
