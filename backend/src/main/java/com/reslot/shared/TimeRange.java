package com.reslot.shared;

import java.time.LocalTime;

/**
 * Half-open time range [start, end). Two ranges overlap when
 * they share at least one instant (back-to-back sessions do NOT overlap).
 */
public record TimeRange(LocalTime start, LocalTime end) {

    public TimeRange {
        if (!start.isBefore(end)) {
            throw new IllegalArgumentException("start must be before end: %s - %s".formatted(start, end));
        }
    }

    /** Returns true when this range and other share at least one instant. */
    public boolean overlaps(TimeRange other) {
        return this.start.isBefore(other.end) && other.start.isBefore(this.end);
    }

    /** Returns true when this range completely contains the other. */
    public boolean contains(TimeRange other) {
        return !this.start.isAfter(other.start) && !this.end.isBefore(other.end);
    }

    @Override
    public String toString() {
        return "%s-%s".formatted(start, end);
    }

    public static TimeRange of(String start, String end) {
        return new TimeRange(LocalTime.parse(start), LocalTime.parse(end));
    }
}
