package com.reslot.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findTop100ByOrderByAtDesc();

    @Query("SELECT a FROM AuditLog a WHERE (:actor IS NULL OR LOWER(a.actor) LIKE LOWER(CONCAT('%', :actor, '%'))) " +
           "AND (:entity IS NULL OR LOWER(a.entity) = LOWER(:entity)) " +
           "ORDER BY a.at DESC")
    List<AuditLog> searchLogs(@Param("actor") String actor, @Param("entity") String entity);
}
