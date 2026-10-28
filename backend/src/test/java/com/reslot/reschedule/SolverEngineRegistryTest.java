package com.reslot.reschedule;

import com.reslot.reschedule.solver.BacktrackingHeuristicSolverEngine;
import com.reslot.reschedule.solver.OrToolsCpSatSolverEngine;
import com.reslot.reschedule.solver.SolverEngine;
import com.reslot.reschedule.solver.SolverEngineRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SolverEngineRegistryTest {

    @Test
    @DisplayName("SolverEngineRegistry selects available heuristic engine and provides engine registry")
    void testActiveEngineSelection() {
        BacktrackingHeuristicSolverEngine heuristic = new BacktrackingHeuristicSolverEngine();
        OrToolsCpSatSolverEngine cpSat = new OrToolsCpSatSolverEngine();

        SolverEngineRegistry registry = new SolverEngineRegistry(List.of(heuristic, cpSat));

        SolverEngine active = registry.getActiveEngine();
        assertThat(active).isNotNull();
        assertThat(active.getEngineName()).isEqualTo("JAVA_BACKTRACKING_HEURISTIC");
        assertThat(registry.getAllEngines()).hasSize(2);
    }
}
