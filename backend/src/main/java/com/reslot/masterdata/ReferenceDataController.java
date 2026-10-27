package com.reslot.masterdata;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Reference Data", description = "Rooms, Faculty, Groups, Subjects, Periods, Lab Blocks")
public class ReferenceDataController {

    private final RoomRepository roomRepo;
    private final FacultyRepository facultyRepo;
    private final StudentGroupRepository groupRepo;
    private final SubjectRepository subjectRepo;
    private final PeriodRepository periodRepo;
    private final LabBlockRepository labBlockRepo;

    public ReferenceDataController(RoomRepository roomRepo, FacultyRepository facultyRepo,
                                   StudentGroupRepository groupRepo, SubjectRepository subjectRepo,
                                   PeriodRepository periodRepo, LabBlockRepository labBlockRepo) {
        this.roomRepo = roomRepo;
        this.facultyRepo = facultyRepo;
        this.groupRepo = groupRepo;
        this.subjectRepo = subjectRepo;
        this.periodRepo = periodRepo;
        this.labBlockRepo = labBlockRepo;
    }

    // ===== ROOMS =====
    @GetMapping("/rooms")
    @Operation(summary = "List all rooms, optionally filtered by type")
    public List<RoomDto> listRooms(@RequestParam(required = false) String type) {
        List<Room> rooms = type != null
                ? roomRepo.findByRoomType(Room.RoomType.valueOf(type.toUpperCase()))
                : roomRepo.findAll();
        return rooms.stream().map(this::toDto).toList();
    }

    @GetMapping("/rooms/{id}")
    public RoomDto getRoom(@PathVariable Long id) {
        return roomRepo.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> com.reslot.shared.ApiException.notFound("Room not found: " + id));
    }

    @PostMapping("/rooms")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomDto createRoom(@Valid @RequestBody CreateRoomRequest req) {
        String cleanCode = req.code().trim().toUpperCase();
        java.util.Optional<Room> existing = roomRepo.findByCode(cleanCode);
        Room room;
        Room.RoomType type;
        try {
            type = Room.RoomType.valueOf(req.roomType().trim().toUpperCase());
        } catch (Exception e) {
            type = Room.RoomType.OTHER;
        }
        int cap = (req.capacity() != null && req.capacity() > 0) ? req.capacity() : 60;

        if (existing.isPresent()) {
            room = existing.get();
            room.setName(req.name());
            room.setRoomType(type);
            room.setCapacity(cap);
            room.setTemporary(req.isTemporary());
            room.setActive(true);
            if (req.labCode() != null && !req.labCode().isBlank()) {
                room.setLabCode(req.labCode());
            }
        } else {
            room = Room.builder()
                    .code(cleanCode)
                    .name(req.name())
                    .roomType(type)
                    .labCode(req.labCode())
                    .capacity(cap)
                    .isTemporary(req.isTemporary())
                    .isActive(true)
                    .build();
        }
        return toDto(roomRepo.save(room));
    }

    @PatchMapping("/rooms/{id}")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    public RoomDto updateRoom(@PathVariable Long id, @RequestBody UpdateRoomRequest req) {
        Room room = roomRepo.findById(id)
                .orElseThrow(() -> com.reslot.shared.ApiException.notFound("Room not found: " + id));
        if (req.name() != null) room.setName(req.name());
        if (req.capacity() != null) room.setCapacity(req.capacity());
        if (req.isActive() != null) room.setActive(req.isActive());
        return toDto(roomRepo.save(room));
    }

    // ===== FACULTY =====
    @GetMapping("/faculty")
    public List<FacultyDto> listFaculty() {
        return facultyRepo.findAll().stream().map(this::toDto).toList();
    }

    @PostMapping("/faculty")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public FacultyDto createFaculty(@Valid @RequestBody CreateFacultyRequest req) {
        Faculty f = Faculty.builder()
                .code(req.code())
                .fullName(req.fullName())
                .email(req.email())
                .whatsappE164(req.whatsappE164())
                .isActive(true)
                .build();
        return toDto(facultyRepo.save(f));
    }

    @PatchMapping("/faculty/{id}")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
    public FacultyDto updateFaculty(@PathVariable Long id, @RequestBody UpdateFacultyRequest req) {
        Faculty f = facultyRepo.findById(id)
                .orElseThrow(() -> com.reslot.shared.ApiException.notFound("Faculty not found: " + id));
        if (req.fullName() != null) f.setFullName(req.fullName());
        if (req.email() != null) f.setEmail(req.email());
        if (req.whatsappE164() != null) f.setWhatsappE164(req.whatsappE164());
        if (req.isActive() != null) f.setActive(req.isActive());
        return toDto(facultyRepo.save(f));
    }

    // ===== STUDENT GROUPS =====
    @GetMapping("/student-groups")
    public List<StudentGroupDto> listGroups(@RequestParam(required = false) String level) {
        List<StudentGroup> groups = level != null ? groupRepo.findByLevel(level) : groupRepo.findAll();
        return groups.stream().map(this::toGroupDto).toList();
    }

    // ===== SUBJECTS =====
    @GetMapping("/subjects")
    public List<SubjectDto> listSubjects() {
        return subjectRepo.findAll().stream()
                .map(s -> new SubjectDto(s.getId(), s.getCode(), s.getName())).toList();
    }

    // ===== PERIODS =====
    @GetMapping("/periods")
    public List<PeriodDto> listPeriods() {
        return periodRepo.findAll().stream()
                .map(p -> new PeriodDto(p.getCode(), p.getStartTime().toString(), p.getEndTime().toString(), p.getLabel())).toList();
    }

    // ===== LAB BLOCKS =====
    @GetMapping("/lab-blocks")
    public List<LabBlockDto> listLabBlocks() {
        return labBlockRepo.findAll().stream()
                .map(lb -> new LabBlockDto(lb.getCode(), lb.getStartTime().toString(), lb.getEndTime().toString(), lb.getNote())).toList();
    }

    // ===== DTO MAPPERS =====
    private RoomDto toDto(Room r) {
        return new RoomDto(r.getId(), r.getCode(), r.getName(), r.getRoomType().name(), r.getLabCode(),
                r.getCapacity(), r.isTemporary(), r.isActive(),
                r.getAliases().stream().map(RoomAlias::getAlias).toList());
    }

    private boolean isStaff() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_COORDINATOR") ||
                a.getAuthority().equals("ROLE_ADMIN")
        );
    }

    private FacultyDto toDto(Faculty f) {
        boolean staff = isStaff();
        return new FacultyDto(f.getId(), f.getCode(), f.getFullName(),
                staff ? f.getEmail() : null,
                staff ? f.getWhatsappE164() : null,
                f.isActive(), f.getAliases().stream().map(FacultyAlias::getAlias).toList());
    }

    private StudentGroupDto toGroupDto(StudentGroup g) {
        return new StudentGroupDto(g.getId(), g.getName(), g.getLevel(), g.getKind().name(),
                g.getParent() != null ? g.getParent().getId() : null, g.getPartitionKey(), g.getStrength());
    }

    // ===== DTOs =====
    public record RoomDto(Long id, String code, String name, String roomType, String labCode,
                          Integer capacity, boolean isTemporary, boolean isActive, List<String> aliases) {}
    public record CreateRoomRequest(@NotBlank String code, @NotBlank String name, @NotBlank String roomType,
                                    String labCode, Integer capacity, boolean isTemporary) {}
    public record UpdateRoomRequest(String name, Integer capacity, Boolean isActive) {}
    public record FacultyDto(Long id, String code, String fullName, String email, String whatsappE164,
                             boolean isActive, List<String> aliases) {}
    public record CreateFacultyRequest(@NotBlank String code, String fullName, String email,
                                       @Pattern(regexp = "^\\+[1-9][0-9]{7,14}$", message = "Must be E.164 format (+CountryCode...)") String whatsappE164) {}
    public record UpdateFacultyRequest(String fullName, String email, String whatsappE164, Boolean isActive) {}
    public record StudentGroupDto(Long id, String name, String level, String kind, Long parentId, String partitionKey, Integer strength) {}
    public record SubjectDto(Long id, String code, String name) {}
    public record PeriodDto(String code, String startTime, String endTime, String label) {}
    public record LabBlockDto(String code, String startTime, String endTime, String note) {}
}
