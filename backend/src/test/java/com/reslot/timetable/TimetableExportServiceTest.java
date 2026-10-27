package com.reslot.timetable;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TimetableExportServiceTest {

    private TimetableExportService exportService;
    private LocalDate testDate;
    private List<TimetableController.EffectiveSessionDto> sampleSessions;

    @BeforeEach
    void setUp() {
        exportService = new TimetableExportService();
        testDate = LocalDate.of(2026, 10, 26);

        var facultyRef = new TimetableController.FacultyRef(30L, "SW", "Prof. Shalaka Wagh");
        var groupRef = new TimetableController.GroupRef(1L, "SY-A");

        sampleSessions = List.of(
                new TimetableController.EffectiveSessionDto(
                        101L, "09:00", "10:00", "CS201", "Operating Systems",
                        "LECTURE", "A-209", List.of(facultyRef), List.of(groupRef),
                        "NORMAL", null, null, null, null
                ),
                new TimetableController.EffectiveSessionDto(
                        102L, "11:15", "13:15", "CS202", "Database Systems Lab",
                        "LAB", "A-210", List.of(facultyRef), List.of(groupRef),
                        "MOVED", "A-209", "14:00", "16:00", "Lab moved due to room maintenance"
                )
        );
    }

    @Test
    @DisplayName("PDF Export: Produces valid binary PDF document starting with %PDF- header")
    void testPdfExportGeneratesValidDocument() {
        byte[] pdfBytes = exportService.exportToPdf("Effective Timetable SY-A", testDate, sampleSessions);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 500, "PDF byte length must be greater than 500 bytes");

        String header = new String(pdfBytes, 0, 4, StandardCharsets.US_ASCII);
        assertEquals("%PDF", header, "PDF file must start with %PDF header");
    }

    @Test
    @DisplayName("Excel Export: Produces valid OOXML spreadsheet document with PK zip magic number")
    void testExcelExportGeneratesValidSpreadsheet() {
        byte[] xlsxBytes = exportService.exportToExcel("Effective Timetable SY-A", testDate, sampleSessions);

        assertNotNull(xlsxBytes);
        assertTrue(xlsxBytes.length > 1000, "Excel XLSX size must be greater than 1KB");

        // ZIP magic bytes for OOXML (.xlsx) are PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
        assertEquals(0x50, xlsxBytes[0]);
        assertEquals(0x4B, xlsxBytes[1]);
        assertEquals(0x03, xlsxBytes[2]);
        assertEquals(0x04, xlsxBytes[3]);
    }

    @Test
    @DisplayName("iCalendar (ICS) Export: Produces compliant RFC 5545 VCALENDAR and VEVENT entries")
    void testIcsExportGeneratesValidCalendar() {
        byte[] icsBytes = exportService.exportToIcs("SY-A Schedule", testDate, sampleSessions);

        assertNotNull(icsBytes);
        String icsContent = new String(icsBytes, StandardCharsets.UTF_8);

        assertTrue(icsContent.startsWith("BEGIN:VCALENDAR"), "Must start with BEGIN:VCALENDAR");
        assertTrue(icsContent.contains("VERSION:2.0"), "Must declare VERSION:2.0");
        assertTrue(icsContent.contains("PRODID:-//JSPM RSCOE//ReSlot//EN"));
        assertTrue(icsContent.contains("BEGIN:VEVENT"));
        assertTrue(icsContent.contains("SUMMARY:CS201 - Operating Systems (LECTURE)"));
        assertTrue(icsContent.contains("SUMMARY:CS202 - Database Systems Lab (LAB)"));
        assertTrue(icsContent.contains("LOCATION:Room A-209"));
        assertTrue(icsContent.contains("LOCATION:Room A-210"));
        assertTrue(icsContent.contains("END:VCALENDAR"));
    }
}
