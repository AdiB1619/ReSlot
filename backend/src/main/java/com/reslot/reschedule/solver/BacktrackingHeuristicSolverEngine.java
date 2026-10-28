package com.reslot.reschedule.solver;

import org.springframework.stereotype.Component;

@Component
public class BacktrackingHeuristicSolverEngine implements SolverEngine {

    @Override
    public String getEngineName() {
        return "JAVA_BACKTRACKING_HEURISTIC";
    }

    @Override
    public String getDescription() {
        return "Deterministic multi-pass constraint backtracking solver (Preserves 2h lab blocks, zero new clashes)";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }
}
