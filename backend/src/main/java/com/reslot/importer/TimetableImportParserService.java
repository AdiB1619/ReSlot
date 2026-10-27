package com.reslot.importer;

import com.reslot.audit.AuditService;
import com.reslot.masterdata.*;
import com.reslot.shared.ApiException;
import com.reslot.shared.ErrorCode;
import com.reslot.timetable.TimetableSession;
import com.reslot.timetable.TimetableSessionRepository;
import com.reslot.timetable.TimetableVersion;
import com.reslot.timetable.TimetableVersionRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TimetableImportParserService {

    private static final Logger log = LoggerFactory.getLogger(TimetableImportParserService.class);

    private final TimetableVersionRepository versionRepo;
    private final TimetableSessionRepository sessionRepo;
    private final SubjectRepository subjectRepo;
    private final RoomRepository roomRepo;
    private final FacultyRepository facultyRepo;
    private final StudentGroupRepository groupRepo;
    private final ImportService importService;
    private final AuditService auditService;

    public TimetableImportParserService(
            TimetableVersionRepository versionRepo,
            TimetableSessionRepository sessionRepo,
            SubjectRepository subjectRepo,
            RoomRepository roomRepo,
            FacultyRepository facultyRepo,
            StudentGroupRepository groupRepo,
            ImportService importService,
            AuditService auditService) {
        this.versionRepo = versionRepo;
        this.sessionRepo = sessionRepo;
        this.subjectRepo = subjectRepo;
        this.roomRepo = roomRepo;
        this.facultyRepo = facultyRepo;
        this.groupRepo = groupRepo;
        this.importService = importService;
        this.auditService = auditService;
    }

    @Transactional
    public TimetableParseReport parseAndImport(
            MultipartFile file,
            String academicYear,
            String semester,
            String versionName,
            boolean activateImmediately,
            String user) {

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "uploaded_timetable";
        String lowerName = fileName.toLowerCase();

        List<RawSessionRecord> rawRecords;
        try {
            if (lowerName.endsWith(".csv")) {
                rawRecords = parseCsv(file);
            } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
                rawRecords = parseExcel(file);
            } else if (lowerName.endsWith(".pdf")) {
                rawRecords = parsePdf(file);
            } else {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "Unsupported file format. Please upload a PDF, Excel (.xlsx/.xls), or CSV timetable file.");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse timetable file: {}", fileName, e);
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to parse timetable file: " + e.getMessage());
        }

        if (rawRecords.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "No valid timetable session lines could be extracted from the file.");
        }

        // Cache reference data for rapid resolution
        List<Room> allRooms = roomRepo.findAll();
        List<Faculty> allFaculty = facultyRepo.findAll();
        List<Subject> allSubjects = subjectRepo.findAll();
        List<StudentGroup> allGroups = groupRepo.findAll();

        String finalName = (versionName != null && !versionName.isBlank())
                ? versionName.trim()
                : String.format("Master Timetable A.Y. %s %s (Uploaded %s)", academicYear != null ? academicYear : "2026-27", semester != null ? semester : "SEM-I", LocalDate.now());

        TimetableVersion version = TimetableVersion.builder()
                .name(finalName)
                .academicYear(academicYear != null && !academicYear.isBlank() ? academicYear.trim() : "2026-27")
                .semester(semester != null && !semester.isBlank() ? semester.trim() : "SEM-I")
                .effectiveFrom(LocalDate.now())
                .status(TimetableVersion.VersionStatus.DRAFT)
                .sourceFile(fileName)
                .createdAt(Instant.now())
                .createdBy(user)
                .build();
        version = versionRepo.save(version);

        int lecturesCount = 0;
        int labsCount = 0;
        int tutorialsCount = 0;
        Set<String> detectedRooms = new HashSet<>();
        Set<String> detectedFaculty = new HashSet<>();
        Set<String> detectedDivisions = new HashSet<>();
        List<SampleSessionDto> sampleSessions = new ArrayList<>();

        for (RawSessionRecord r : rawRecords) {
            // 1. Resolve or create Subject (null-safe matching, RS-AUD-023)
            Subject subject = allSubjects.stream()
                    .filter(s -> s.getCode().equalsIgnoreCase(r.subjectCode()) ||
                            (s.getName() != null && s.getName().equalsIgnoreCase(r.subjectCode())))
                    .findFirst()
                    .orElseGet(() -> {
                        Subject newSub = Subject.builder()
                                .code(r.subjectCode().toUpperCase())
                                .name(r.subjectName() != null ? r.subjectName() : r.subjectCode().toUpperCase())
                                .build();
                        Subject saved = subjectRepo.save(newSub);
                        allSubjects.add(saved);
                        return saved;
                    });

            // 2. Resolve Room
            Room room = null;
            boolean roomMatched = false;
            if (r.roomCode() != null && !r.roomCode().isBlank()) {
                room = allRooms.stream()
                        .filter(rm -> rm.getCode().equalsIgnoreCase(r.roomCode()) || (rm.getLabCode() != null && rm.getLabCode().equalsIgnoreCase(r.roomCode())))
                        .findFirst()
                        .orElse(null);
                if (room != null) {
                    detectedRooms.add(room.getCode());
                    roomMatched = true;
                }
            }

            // 3. Resolve Faculty
            Set<Faculty> assignedFaculty = new HashSet<>();
            boolean facultyMatched = false;
            if (r.facultyCode() != null && !r.facultyCode().isBlank()) {
                for (String code : r.facultyCode().split("[,/&]")) {
                    String clean = code.trim();
                    Faculty fac = allFaculty.stream()
                            .filter(f -> f.getCode().equalsIgnoreCase(clean) || (f.getFullName() != null && f.getFullName().equalsIgnoreCase(clean)))
                            .findFirst()
                            .orElse(null);
                    if (fac != null) {
                        assignedFaculty.add(fac);
                        detectedFaculty.add(fac.getCode());
                        facultyMatched = true;
                    }
                }
            }

            // 4. Resolve Student Groups (Do NOT silently default to allGroups.get(0), RS-AUD-021)
            Set<StudentGroup> assignedGroups = new HashSet<>();
            boolean groupMatched = false;
            if (r.groupName() != null && !r.groupName().isBlank()) {
                for (String gStr : r.groupName().split("[,/&]")) {
                    String clean = gStr.trim();
                    StudentGroup grp = allGroups.stream()
                            .filter(g -> g.getName().equalsIgnoreCase(clean))
                            .findFirst()
                            .orElse(null);
                    if (grp != null) {
                        assignedGroups.add(grp);
                        detectedDivisions.add(grp.getName());
                        groupMatched = true;
                    }
                }
            }

            boolean needsReview = false;
            StringBuilder reviewNote = new StringBuilder();
            if (!groupMatched && r.groupName() != null && !r.groupName().isBlank()) {
                needsReview = true;
                reviewNote.append("Unmatched group: ").append(r.groupName()).append("; ");
            }
            if (!roomMatched && r.roomCode() != null && !r.roomCode().isBlank()) {
                needsReview = true;
                reviewNote.append("Unmatched room: ").append(r.roomCode()).append("; ");
            }
            if (!facultyMatched && r.facultyCode() != null && !r.facultyCode().isBlank()) {
                needsReview = true;
                reviewNote.append("Unmatched faculty: ").append(r.facultyCode()).append("; ");
            }

            // 5. Determine SessionType
            TimetableSession.SessionType sType = TimetableSession.SessionType.LECTURE;
            if (r.sessionType() != null) {
                String st = r.sessionType().toUpperCase();
                if (st.contains("LAB") || st.contains("PRACTICAL")) {
                    sType = TimetableSession.SessionType.LAB;
                    labsCount++;
                } else if (st.contains("TUT")) {
                    sType = TimetableSession.SessionType.TUTORIAL;
                    tutorialsCount++;
                } else {
                    lecturesCount++;
                }
            } else {
                if (r.roomCode() != null && (r.roomCode().contains("LAB") || r.roomCode().contains("CVL") || r.roomCode().contains("MACL") || r.roomCode().contains("MLL") || r.roomCode().contains("PL"))) {
                    sType = TimetableSession.SessionType.LAB;
                    labsCount++;
                } else {
                    lecturesCount++;
                }
            }

            TimetableSession session = TimetableSession.builder()
                    .version(version)
                    .dayOfWeek(r.dayOfWeek() >= 1 && r.dayOfWeek() <= 6 ? r.dayOfWeek() : 1)
                    .startTime(r.startTime() != null ? r.startTime() : LocalTime.of(9, 0))
                    .endTime(r.endTime() != null ? r.endTime() : LocalTime.of(10, 0))
                    .subject(subject)
                    .room(room)
                    .rawRoom(r.roomCode())
                    .rawFaculty(r.facultyCode())
                    .sessionType(sType)
                    .faculty(assignedFaculty)
                    .groups(assignedGroups)
                    .isFixed(false)
                    .needsReview(needsReview)
                    .reviewNote(reviewNote.isEmpty() ? null : reviewNote.toString().trim())
                    .build();

            sessionRepo.save(session);

            if (sampleSessions.size() < 10) {
                sampleSessions.add(new SampleSessionDto(
                        dayName(session.getDayOfWeek()),
                        session.getStartTime().toString() + " - " + session.getEndTime().toString(),
                        subject.getCode(),
                        session.getSessionType().name(),
                        room != null ? room.getCode() : (r.roomCode() != null ? r.roomCode() : "TBD"),
                        assignedFaculty.isEmpty() ? (r.facultyCode() != null ? r.facultyCode() : "TBD") : assignedFaculty.iterator().next().getCode(),
                        assignedGroups.isEmpty() ? "General" : assignedGroups.iterator().next().getName()
                ));
            }
        }

        if (activateImmediately) {
            importService.activateVersion(version.getId(), user);
        }

        auditService.record(user, "TIMETABLE_FILE_UPLOADED", "timetable_versions", version.getId(),
                String.format("Uploaded and classified timetable '%s' with %d sessions", fileName, rawRecords.size()));

        return new TimetableParseReport(
                version.getId(),
                version.getName(),
                activateImmediately ? "ACTIVE" : "DRAFT",
                rawRecords.size(),
                lecturesCount,
                labsCount,
                tutorialsCount,
                detectedRooms.size(),
                detectedFaculty.size(),
                detectedDivisions.size(),
                new ArrayList<>(detectedRooms),
                new ArrayList<>(detectedFaculty),
                new ArrayList<>(detectedDivisions),
                sampleSessions
        );
    }

    private List<RawSessionRecord> parseCsv(MultipartFile file) throws Exception {
        List<RawSessionRecord> records = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean headerSkipped = false;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                if (!headerSkipped && (line.toLowerCase().contains("day") || line.toLowerCase().contains("subject") || line.toLowerCase().contains("time"))) {
                    headerSkipped = true;
                    continue;
                }
                headerSkipped = true;
                if (parts.length >= 4) {
                    records.add(extractFromTokens(parts));
                }
            }
        }
        return records;
    }

    private List<RawSessionRecord> parseExcel(MultipartFile file) throws Exception {
        List<RawSessionRecord> records = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            boolean headerSkipped = false;
            for (Row row : sheet) {
                List<String> cells = new ArrayList<>();
                for (Cell cell : row) {
                    cells.add(formatter.formatCellValue(cell).trim());
                }
                if (cells.isEmpty() || cells.stream().allMatch(String::isEmpty)) continue;
                String joined = String.join(" ", cells).toLowerCase();
                if (!headerSkipped && (joined.contains("day") || joined.contains("subject") || joined.contains("time"))) {
                    headerSkipped = true;
                    continue;
                }
                headerSkipped = true;
                if (cells.size() >= 3) {
                    records.add(extractFromTokens(cells.toArray(new String[0])));
                }
            }
        }
        return records;
    }

    private List<RawSessionRecord> parsePdf(MultipartFile file) throws Exception {
        List<RawSessionRecord> records = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            String[] lines = text.split("\\r?\\n");
            int currentDay = 1;
            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                String lower = trimmed.toLowerCase();
                if (lower.startsWith("monday") || lower.equals("mon")) currentDay = 1;
                else if (lower.startsWith("tuesday") || lower.equals("tue")) currentDay = 2;
                else if (lower.startsWith("wednesday") || lower.equals("wed")) currentDay = 3;
                else if (lower.startsWith("thursday") || lower.equals("thu")) currentDay = 4;
                else if (lower.startsWith("friday") || lower.equals("fri")) currentDay = 5;
                else if (lower.startsWith("saturday") || lower.equals("sat")) currentDay = 6;

                // Pattern match time ranges like 08:45 - 10:45 or 09:00 to 11:00
                Pattern p = Pattern.compile("(\\d{1,2}[:.]\\d{2})\\s*(?:-|to)\\s*(\\d{1,2}[:.]\\d{2})", Pattern.CASE_INSENSITIVE);
                Matcher m = p.matcher(trimmed);
                if (m.find()) {
                    LocalTime st = parseTime(m.group(1));
                    LocalTime et = parseTime(m.group(2));
                    String rest = trimmed.replace(m.group(0), "").trim();
                    records.add(new RawSessionRecord(currentDay, st, et, extractSubject(rest), rest, extractRoom(rest), extractFaculty(rest), "SY-A", rest.contains("LAB") || rest.contains("Lab") ? "LAB" : "LECTURE"));
                }
            }
        }
        return records;
    }

    private RawSessionRecord extractFromTokens(String[] tokens) {
        int day = 1;
        LocalTime st = LocalTime.of(9, 0);
        LocalTime et = LocalTime.of(10, 0);
        String subject = "SUB";
        String room = null;
        String faculty = null;
        String group = "SY-A";
        String type = "LECTURE";

        for (String t : tokens) {
            String clean = t.trim();
            String lower = clean.toLowerCase();
            if (lower.contains("mon")) day = 1;
            else if (lower.contains("tue")) day = 2;
            else if (lower.contains("wed")) day = 3;
            else if (lower.contains("thu")) day = 4;
            else if (lower.contains("fri")) day = 5;
            else if (lower.contains("sat")) day = 6;

            Pattern p = Pattern.compile("(\\d{1,2}[:.]\\d{2})\\s*(?:-|to)\\s*(\\d{1,2}[:.]\\d{2})");
            Matcher m = p.matcher(clean);
            if (m.find()) {
                st = parseTime(m.group(1));
                et = parseTime(m.group(2));
            }

            if (clean.matches("^[A-Z]{2,5}(-[I|V|X]+)?$") || clean.equalsIgnoreCase("CNS") || clean.equalsIgnoreCase("DS") || clean.equalsIgnoreCase("DAA") || clean.equalsIgnoreCase("AI") || clean.equalsIgnoreCase("ML") || clean.equalsIgnoreCase("OS")) {
                subject = clean;
            }

            if (clean.matches("^[A-B][0-9]?-[0-9]{3}$") || clean.contains("CVL") || clean.contains("MACL") || clean.contains("MLL") || clean.contains("PL")) {
                room = clean;
            }

            if (clean.matches("^[A-Z]{2,4}$") && !clean.equals(subject)) {
                faculty = clean;
            }

            if (lower.contains("lab") || lower.contains("practical")) {
                type = "LAB";
            }
            if (clean.matches("^(FY|SY|TY|BE)-?[A-D]?.*")) {
                group = clean;
            }
        }

        if (subject.equals("SUB") && tokens.length > 2) {
            subject = tokens[1].trim();
        }

        return new RawSessionRecord(day, st, et, subject, subject, room, faculty, group, type);
    }

    private LocalTime parseTime(String s) {
        try {
            String norm = s.replace(".", ":").trim();
            if (norm.length() == 4 && norm.charAt(1) == ':') {
                norm = "0" + norm;
            }
            return LocalTime.parse(norm);
        } catch (Exception e) {
            return LocalTime.of(9, 0);
        }
    }

    private String extractSubject(String s) {
        for (String word : s.split("\\s+")) {
            if (word.length() >= 2 && word.toUpperCase().equals(word) && !word.contains("-") && !word.matches("\\d+")) {
                return word;
            }
        }
        return "COURSE";
    }

    private String extractRoom(String s) {
        Pattern p = Pattern.compile("([A-B][0-9]?-[0-9]{3}|CVL|MACL|MLL|PL|DSL|AIL)", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(s);
        return m.find() ? m.group(1).toUpperCase() : null;
    }

    private String extractFaculty(String s) {
        Pattern p = Pattern.compile("\\b([A-Z]{2,4})\\b");
        Matcher m = p.matcher(s);
        while (m.find()) {
            String val = m.group(1);
            if (!val.equals("LAB") && !val.equals("THEORY") && !val.equals("SEM")) {
                return val;
            }
        }
        return null;
    }

    private String dayName(int day) {
        return switch (day) {
            case 1 -> "Monday";
            case 2 -> "Tuesday";
            case 3 -> "Wednesday";
            case 4 -> "Thursday";
            case 5 -> "Friday";
            case 6 -> "Saturday";
            default -> "Monday";
        };
    }

    public record RawSessionRecord(
            int dayOfWeek,
            LocalTime startTime,
            LocalTime endTime,
            String subjectCode,
            String subjectName,
            String roomCode,
            String facultyCode,
            String groupName,
            String sessionType
    ) {}

    public record SampleSessionDto(
            String day,
            String time,
            String subject,
            String type,
            String room,
            String faculty,
            String group
    ) {}

    public record TimetableParseReport(
            Long versionId,
            String versionName,
            String status,
            int totalSessionsParsed,
            int lectureCount,
            int labCount,
            int tutorialCount,
            int roomsMapped,
            int facultyAssigned,
            int divisionsCovered,
            List<String> rooms,
            List<String> faculty,
            List<String> divisions,
            List<SampleSessionDto> sampleSessions
    ) {}
}
