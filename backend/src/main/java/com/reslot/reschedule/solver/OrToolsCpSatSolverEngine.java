package com.reslot.reschedule.solver;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OrToolsCpSatSolverEngine implements SolverEngine {

    private final boolean nativeLoaded;

    public OrToolsCpSatSolverEngine() {
        boolean loaded = false;
        try {
            Class.forName("com.google.ortools.sat.CpModel");
            loaded = true;
        } catch (Throwable t) {
            loaded = false;
        }
        this.nativeLoaded = loaded;
    }

    @Override
    public String getEngineName() {
        return "OR_TOOLS_CP_SAT";
    }

    @Override
    public String getDescription() {
        return "Google OR-Tools Mathematical CP-SAT Constraint Programming Solver";
    }

    @Override
    public boolean isAvailable() {
        return nativeLoaded;
    }
}
