package com.reslot.shared;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TimeRangeTest {

    @Test
    void testOverlaps() {
        TimeRange morning = TimeRange.of("09:00", "11:00");
        TimeRange overlapping = TimeRange.of("10:00", "12:00");
        TimeRange adjacent = TimeRange.of("11:00", "13:00");
        TimeRange separate = TimeRange.of("14:00", "16:00");

        assertTrue(morning.overlaps(overlapping), "Ranges sharing 10:00-11:00 should overlap");
        assertFalse(morning.overlaps(adjacent), "Half-open ranges [9, 11) and [11, 13) must NOT overlap");
        assertFalse(morning.overlaps(separate), "Separate ranges must not overlap");
    }

    @Test
    void testContains() {
        TimeRange slot = TimeRange.of("09:00", "11:00");
        TimeRange subSlot = TimeRange.of("09:30", "10:30");
        TimeRange outsideSlot = TimeRange.of("10:30", "11:30");

        assertTrue(slot.contains(subSlot), "[09:00, 11:00) should contain [09:30, 10:30)");
        assertFalse(slot.contains(outsideSlot), "[09:00, 11:00) should not contain [10:30, 11:30)");
    }
}
