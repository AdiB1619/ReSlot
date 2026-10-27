package com.reslot.importer;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/imports")
@Tag(name = "Master Import", description = "Canonical JSON and Master Timetable upload pipeline")
@PreAuthorize("hasAnyRole('COORDINATOR', 'ADMIN')")
public class ImportController {

    private final ImportService importService;
    private final TimetableImportParserService parserService;

    public ImportController(ImportService importService, TimetableImportParserService parserService) {
        this.importService = importService;
        this.parserService = parserService;
    }

    @PostMapping(value = "/timetable-file", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload and parse timetable file (PDF, Excel, CSV)")
    public ResponseEntity<TimetableImportParserService.TimetableParseReport> uploadTimetable(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(value = "academicYear", defaultValue = "2026-27") String academicYear,
            @RequestParam(value = "semester", defaultValue = "SEM-I") String semester,
            @RequestParam(value = "versionName", required = false) String versionName,
            @RequestParam(value = "activateImmediately", defaultValue = "true") boolean activateImmediately,
            @AuthenticationPrincipal UserDetails user) {
        String actor = user != null ? user.getUsername() : "coordinator@rscoe.edu.in";
        var report = parserService.parseAndImport(file, academicYear, semester, versionName, activateImmediately, actor);
        return ResponseEntity.ok(report);
    }

    @PostMapping("/canonical-json")
    @Operation(summary = "Import canonical input JSON (disruptions, extra rooms, room rules)")
    public ResponseEntity<ImportService.IngestionResult> importCanonical(
            @RequestBody String jsonContent,
            @AuthenticationPrincipal UserDetails user) {
        String actor = user != null ? user.getUsername() : "coordinator";
        var result = importService.importCanonicalJson(jsonContent, actor);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/versions/{versionId}/activate")
    @Operation(summary = "Activate a timetable version (makes it active master)")
    public ResponseEntity<Void> activateVersion(
            @PathVariable Long versionId,
            @AuthenticationPrincipal UserDetails user) {
        String actor = user != null ? user.getUsername() : "coordinator";
        importService.activateVersion(versionId, actor);
        return ResponseEntity.ok().build();
    }
}
