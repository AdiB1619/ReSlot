package com.reslot.audit;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/audit-logs")
@Tag(name = "Audit", description = "Immutable audit trail")
@PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @Operation(summary = "List audit logs with optional filtering")
    public List<AuditLog> listLogs(
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String entity) {
        return auditService.listRecent(actor, entity);
    }
}
