package com.reslot.audit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepo;

    public AuditService(AuditLogRepository auditLogRepo) {
        this.auditLogRepo = auditLogRepo;
    }

    @Transactional
    public AuditLog record(String actor, String action, String entity, Long entityId, String detail) {
        String jsonDetail;
        if (detail == null || detail.isBlank()) {
            jsonDetail = "{}";
        } else if (detail.trim().startsWith("{") || detail.trim().startsWith("[")) {
            jsonDetail = detail;
        } else {
            jsonDetail = "{\"message\":\"" + detail.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "") + "\"}";
        }

        AuditLog log = AuditLog.builder()
                .at(Instant.now())
                .actor(actor != null ? actor : "system")
                .action(action)
                .entity(entity)
                .entityId(entityId)
                .detail(jsonDetail)
                .build();
        return auditLogRepo.save(log);
    }

    public List<AuditLog> listRecent(String actor, String entity) {
        if (actor != null || entity != null) {
            return auditLogRepo.searchLogs(actor, entity);
        }
        return auditLogRepo.findTop100ByOrderByAtDesc();
    }
}
