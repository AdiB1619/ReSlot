package com.reslot.timetable;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TimetableExportService {

    public void streamToExcel(String title, LocalDate date, List<TimetableController.EffectiveSessionDto> sessions, java.io.OutputStream out) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Effective Timetable");

            // Header Style
            XSSFCellStyle headerStyle = workbook.createCellStyle();
            byte[] crimsonRgb = new byte[]{(byte) 0x9B, (byte) 0x1C, (byte) 0x2E};
            headerStyle.setFillForegroundColor(new XSSFColor(crimsonRgb, null));
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            org.apache.poi.ss.usermodel.Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);

            // Title Row
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue(title + " — " + date);
            org.apache.poi.ss.usermodel.Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            XSSFCellStyle titleStyle = workbook.createCellStyle();
            titleStyle.setFont(titleFont);
            titleCell.setCellStyle(titleStyle);

            // Headers
            String[] headers = {"Time Slot", "Subject Code", "Subject Name", "Type", "Room", "Faculty", "Groups", "Status", "Notes"};
            Row hRow = sheet.createRow(2);
            for (int i = 0; i < headers.length; i++) {
                Cell c = hRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            // Data Rows
            int rowIdx = 3;
            CellStyle normalStyle = workbook.createCellStyle();
            normalStyle.setBorderBottom(BorderStyle.THIN);
            normalStyle.setBorderTop(BorderStyle.THIN);
            normalStyle.setBorderLeft(BorderStyle.THIN);
            normalStyle.setBorderRight(BorderStyle.THIN);

            for (TimetableController.EffectiveSessionDto s : sessions) {
                Row r = sheet.createRow(rowIdx++);
                createCell(r, 0, s.startTime() + " - " + s.endTime(), normalStyle);
                createCell(r, 1, s.subjectCode(), normalStyle);
                createCell(r, 2, s.subjectName(), normalStyle);
                createCell(r, 3, s.sessionType(), normalStyle);
                createCell(r, 4, s.roomCode() != null ? s.roomCode() : "-", normalStyle);
                createCell(r, 5, s.faculty().stream().map(TimetableController.FacultyRef::fullName).collect(Collectors.joining(", ")), normalStyle);
                createCell(r, 6, s.groups().stream().map(TimetableController.GroupRef::name).collect(Collectors.joining(", ")), normalStyle);
                createCell(r, 7, s.status(), normalStyle);
                createCell(r, 8, s.changeReason() != null ? s.changeReason() : "", normalStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
        }
    }

    public byte[] exportToExcel(String title, LocalDate date, List<TimetableController.EffectiveSessionDto> sessions) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            streamToExcel(title, date, sessions, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate Excel export", e);
        }
    }

    private void createCell(Row row, int col, String val, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(val != null ? val : "");
        c.setCellStyle(style);
    }

    public void streamToPdf(String title, LocalDate date, List<TimetableController.EffectiveSessionDto> sessions, java.io.OutputStream out) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream stream = new PDPageContentStream(doc, page)) {
                PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font fontRegular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                float y = 800;
                // Header Banner
                stream.beginText();
                stream.setFont(fontBold, 14);
                stream.newLineAtOffset(50, y);
                stream.showText("JSPM Rajarshi Shahu College of Engineering, Pune");
                stream.endText();

                y -= 18;
                stream.beginText();
                stream.setFont(fontRegular, 10);
                stream.newLineAtOffset(50, y);
                stream.showText("Department of Computer Engineering — ReSlot Timetable Platform");
                stream.endText();

                y -= 22;
                stream.beginText();
                stream.setFont(fontBold, 12);
                stream.newLineAtOffset(50, y);
                stream.showText(title + " (" + date + ")");
                stream.endText();

                y -= 20;
                stream.setLineWidth(1f);
                stream.moveTo(50, y);
                stream.lineTo(545, y);
                stream.stroke();

                y -= 15;
                // Table header
                stream.beginText();
                stream.setFont(fontBold, 9);
                stream.newLineAtOffset(50, y);
                stream.showText(String.format("%-14s %-20s %-8s %-10s %-15s %-10s", "Time", "Subject", "Type", "Room", "Faculty", "Status"));
                stream.endText();

                y -= 10;
                stream.moveTo(50, y);
                stream.lineTo(545, y);
                stream.stroke();

                y -= 14;
                for (TimetableController.EffectiveSessionDto s : sessions) {
                    if (y < 60) {
                        break; // fit single page preview or stop
                    }
                    String timeStr = s.startTime() + "-" + s.endTime();
                    String subStr = truncate(s.subjectCode() + " " + s.subjectName(), 22);
                    String typeStr = s.sessionType();
                    String roomStr = s.roomCode() != null ? s.roomCode() : "-";
                    String facStr = truncate(s.faculty().stream().map(TimetableController.FacultyRef::code).collect(Collectors.joining(",")), 15);
                    String statusStr = s.status();

                    stream.beginText();
                    stream.setFont(fontRegular, 8);
                    stream.newLineAtOffset(50, y);
                    stream.showText(String.format("%-14s %-20s %-8s %-10s %-15s %-10s", timeStr, subStr, typeStr, roomStr, facStr, statusStr));
                    stream.endText();

                    y -= 15;
                }
            }

            doc.save(out);
        }
    }

    public byte[] exportToPdf(String title, LocalDate date, List<TimetableController.EffectiveSessionDto> sessions) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            streamToPdf(title, date, sessions, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate PDF export", e);
        }
    }

    public byte[] exportToIcs(String title, LocalDate date, List<TimetableController.EffectiveSessionDto> sessions) {
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\n");
        sb.append("VERSION:2.0\r\n");
        sb.append("PRODID:-//JSPM RSCOE//ReSlot//EN\r\n");
        sb.append("CALSCALE:GREGORIAN\r\n");
        sb.append("METHOD:PUBLISH\r\n");
        sb.append("X-WR-CALNAME:").append(title).append("\r\n");

        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyyMMdd");
        String dateCompact = date.format(dateFmt);

        for (TimetableController.EffectiveSessionDto s : sessions) {
            sb.append("BEGIN:VEVENT\r\n");
            sb.append("UID:reslot-").append(s.id()).append("-").append(dateCompact).append("@rscoe.reslot\r\n");
            sb.append("DTSTAMP:").append(dateCompact).append("T000000Z\r\n");

            String startClean = s.startTime().replace(":", "") + "00";
            String endClean = s.endTime().replace(":", "") + "00";
            sb.append("DTSTART:").append(dateCompact).append("T").append(startClean).append("\r\n");
            sb.append("DTEND:").append(dateCompact).append("T").append(endClean).append("\r\n");

            sb.append("SUMMARY:").append(escapeIcs(s.subjectCode() + " - " + s.subjectName() + " (" + s.sessionType() + ")")).append("\r\n");
            sb.append("LOCATION:").append(escapeIcs("Room " + (s.roomCode() != null ? s.roomCode() : "TBD"))).append("\r\n");

            String facultyNames = s.faculty().stream().map(TimetableController.FacultyRef::fullName).collect(Collectors.joining(", "));
            String groupNames = s.groups().stream().map(TimetableController.GroupRef::name).collect(Collectors.joining(", "));
            String desc = "Faculty: " + facultyNames + "\\nGroups: " + groupNames + "\\nStatus: " + s.status();
            if (s.changeReason() != null) {
                desc += "\\nNote: " + s.changeReason();
            }
            sb.append("DESCRIPTION:").append(escapeIcs(desc)).append("\r\n");
            sb.append("STATUS:").append("CANCELLED".equalsIgnoreCase(s.status()) ? "CANCELLED" : "CONFIRMED").append("\r\n");
            sb.append("END:VEVENT\r\n");
        }

        sb.append("END:VCALENDAR\r\n");
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String truncate(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max - 2) + "..";
    }

    private String escapeIcs(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\n", "\\n");
    }
}
