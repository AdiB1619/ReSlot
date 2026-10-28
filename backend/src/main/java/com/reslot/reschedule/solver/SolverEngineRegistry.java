package com.reslot.reschedule.solver;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
public class SolverEngineRegistry {

    private final List<SolverEngine> engines;

    @Value("${reslot.solver.engine:heuristic}")
    private String configuredEngine;

    public SolverEngineRegistry(List<SolverEngine> engines) {
        this.engines = engines;
    }

    public SolverEngine getActiveEngine() {
        if ("cp-sat".equalsIgnoreCase(configuredEngine)) {
            for (SolverEngine e : engines) {
                if (e.getEngineName().equals("OR_TOOLS_CP_SAT") && e.isAvailable()) {
                    return e;
                }
            }
            log.warn("Configured solver engine 'cp-sat' requested but native OR-Tools runtime is not found on classpath. Falling back to Java Backtracking Heuristic Engine.");
        }

        return engines.stream()
                .filter(e -> e.getEngineName().equals("JAVA_BACKTRACKING_HEURISTIC"))
                .findFirst()
                .orElse(engines.get(0));
    }

    public List<SolverEngine> getAllEngines() {
        return engines;
    }
}
