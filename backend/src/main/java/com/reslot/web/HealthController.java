package com.reslot.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Operations", description = "Health and operational endpoints")
public class HealthController {

    @GetMapping("/ping")
    @Operation(summary = "Simple liveness check")
    public Map<String, Object> ping() {
        return Map.of("status", "ok", "timestamp", Instant.now().toString(), "service", "reslot-api");
    }
}
