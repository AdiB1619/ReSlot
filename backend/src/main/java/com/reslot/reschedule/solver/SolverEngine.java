package com.reslot.reschedule.solver;

public interface SolverEngine {
    String getEngineName();
    String getDescription();
    boolean isAvailable();
}
