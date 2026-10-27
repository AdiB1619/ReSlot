package com.reslot.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI Assistant", description = "Propose-only AI assistant for timetable queries and swap recommendations")
public class AiAssistantController {

    private final GeminiAiService geminiAiService;

    public AiAssistantController(GeminiAiService geminiAiService) {
        this.geminiAiService = geminiAiService;
    }

    @PostMapping("/suggest")
    @Operation(summary = "Ask AI Assistant for propose-only recommendations (read-only; does not write timetable)")
    public AiSuggestionResponse suggest(@Valid @RequestBody AiQueryRequest req) {
        return geminiAiService.generateSuggestion(req.query(), req.apiKey(), req.model());
    }

    public record AiQueryRequest(@NotBlank String query, String apiKey, String model) {}
    public record AiSuggestionResponse(String answer, List<String> recommendations, List<String> suggestedActions, String mode) {}
}
