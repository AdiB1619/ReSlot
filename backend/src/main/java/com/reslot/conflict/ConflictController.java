package com.reslot.conflict;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/conflicts")
@Tag(name = "Conflicts", description = "Pre-existing baseline clashes and plan validation")
public class ConflictController {

    private final ConflictService conflictService;

    public ConflictController(ConflictService conflictService) {
        this.conflictService = conflictService;
    }

    @GetMapping("/baseline")
    @Operation(summary = "Get pre-existing baseline clashes from the active master timetable")
    public List<ConflictService.ClashReport> getBaselineClashes() {
        return conflictService.findBaselineClashes();
    }
}
