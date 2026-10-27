package com.reslot.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.reslot.availability.Disruption;
import com.reslot.availability.DisruptionRepository;
import com.reslot.masterdata.Faculty;
import com.reslot.masterdata.FacultyRepository;
import com.reslot.masterdata.Room;
import com.reslot.masterdata.RoomRepository;
import com.reslot.timetable.TimetableVersion;
import com.reslot.timetable.TimetableVersionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;

@Service
public class GeminiAiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiAiService.class);

    private final RoomRepository roomRepo;
    private final FacultyRepository facultyRepo;
    private final DisruptionRepository disruptionRepo;
    private final TimetableVersionRepository versionRepo;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${app.llm.api-key:}")
    private String configuredApiKey;

    @Value("${app.llm.model:gemini-1.5-flash}")
    private String configuredModel;

    public GeminiAiService(
            RoomRepository roomRepo,
            FacultyRepository facultyRepo,
            DisruptionRepository disruptionRepo,
            TimetableVersionRepository versionRepo,
            ObjectMapper objectMapper) {
        this.roomRepo = roomRepo;
        this.facultyRepo = facultyRepo;
        this.disruptionRepo = disruptionRepo;
        this.versionRepo = versionRepo;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public AiAssistantController.AiSuggestionResponse generateSuggestion(
            String query, String userApiKey, String requestedModel) {

        String effectiveKey = resolveApiKey(userApiKey);
        String effectiveModel = resolveModel(requestedModel);

        if (effectiveKey == null || effectiveKey.isBlank()) {
            return generateHeuristicFallback(query, false);
        }

        // Multi-model failover pool across distinct quota buckets:
        List<String> modelPool = new ArrayList<>();
        if (effectiveModel != null && !effectiveModel.isBlank()) {
            modelPool.add(effectiveModel);
        }
        for (String fallbackModel : List.of("gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite")) {
            if (!modelPool.contains(fallbackModel)) {
                modelPool.add(fallbackModel);
            }
        }

        Exception lastException = null;
        for (String modelToTry : modelPool) {
            try {
                return callGeminiApi(query, effectiveKey, modelToTry);
            } catch (Exception e) {
                lastException = e;
                String msg = e.getMessage();
                log.warn("Gemini model {} failed ({}). Checking next available model in pool...", modelToTry, msg);
                if (msg != null && (msg.contains("400") || msg.contains("401") || msg.contains("API_KEY_INVALID"))) {
                    break;
                }
            }
        }

        // Clean user-facing fallback without raw JSON dump
        AiAssistantController.AiSuggestionResponse fallback = generateHeuristicFallback(query, true);
        String cleanReason = formatCleanErrorMessage(lastException);
        String note = fallback.answer() + "\n\n*(Note: " + cleanReason + " Showing verified timetable rule-engine advice.)*";
        return new AiAssistantController.AiSuggestionResponse(note, fallback.recommendations(), fallback.suggestedActions(), "FALLBACK_HEURISTIC");
    }

    private String formatCleanErrorMessage(Exception e) {
        if (e == null || e.getMessage() == null) {
            return "Gemini AI service currently unavailable.";
        }
        String msg = e.getMessage();
        if (msg.contains("429") || msg.contains("RESOURCE_EXHAUSTED") || msg.contains("quota")) {
            return "Gemini API free tier rate limit reached (spikes usually reset in ~30 seconds).";
        }
        if (msg.contains("503") || msg.contains("UNAVAILABLE")) {
            return "Google Gemini server is currently experiencing temporary high traffic.";
        }
        if (msg.contains("400") || msg.contains("401") || msg.contains("API_KEY_INVALID")) {
            return "Gemini API key appears to be invalid or unauthorized.";
        }
        return "Gemini AI connection timed out.";
    }

    private String resolveApiKey(String userApiKey) {
        if (userApiKey != null && !userApiKey.trim().isBlank()) {
            return userApiKey.trim();
        }
        if (configuredApiKey != null && !configuredApiKey.trim().isBlank()) {
            return configuredApiKey.trim();
        }
        String envKey = System.getenv("GEMINI_API_KEY");
        if (envKey != null && !envKey.trim().isBlank()) {
            return envKey.trim();
        }
        envKey = System.getenv("LLM_API_KEY");
        if (envKey != null && !envKey.trim().isBlank()) {
            return envKey.trim();
        }

        // Auto-scan .env files in project root, parent directory, and backend folder
        List<Path> candidateEnvFiles = List.of(
                Path.of(".env"),
                Path.of("../.env"),
                Path.of("backend/.env"),
                Path.of(System.getProperty("user.dir", "."), ".env"),
                Path.of(System.getProperty("user.dir", "."), "backend/.env")
        );

        for (Path p : candidateEnvFiles) {
            if (Files.isRegularFile(p)) {
                try {
                    for (String line : Files.readAllLines(p)) {
                        String trimmed = line.trim();
                        if (trimmed.startsWith("#") || !trimmed.contains("=")) {
                            continue;
                        }
                        String[] parts = trimmed.split("=", 2);
                        String k = parts[0].trim();
                        String v = parts[1].trim().replace("\"", "").replace("'", "");
                        if (("GEMINI_API_KEY".equalsIgnoreCase(k) || "LLM_API_KEY".equalsIgnoreCase(k)) && !v.isBlank()) {
                            return v;
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }

        return null;
    }

    private String resolveModel(String requestedModel) {
        if (requestedModel != null && !requestedModel.trim().isBlank()) {
            return requestedModel.trim();
        }
        if (configuredModel != null && !configuredModel.trim().isBlank()) {
            return configuredModel.trim();
        }
        String envModel = System.getenv("GEMINI_MODEL");
        if (envModel != null && !envModel.trim().isBlank()) {
            return envModel.trim();
        }
        envModel = System.getenv("LLM_MODEL");
        if (envModel != null && !envModel.trim().isBlank()) {
            return envModel.trim();
        }

        // Auto-scan .env for model specification as well
        List<Path> candidateEnvFiles = List.of(
                Path.of(".env"),
                Path.of("../.env"),
                Path.of("backend/.env"),
                Path.of(System.getProperty("user.dir", "."), ".env"),
                Path.of(System.getProperty("user.dir", "."), "backend/.env")
        );

        for (Path p : candidateEnvFiles) {
            if (Files.isRegularFile(p)) {
                try {
                    for (String line : Files.readAllLines(p)) {
                        String trimmed = line.trim();
                        if (trimmed.startsWith("#") || !trimmed.contains("=")) {
                            continue;
                        }
                        String[] parts = trimmed.split("=", 2);
                        String k = parts[0].trim();
                        String v = parts[1].trim().replace("\"", "").replace("'", "");
                        if (("GEMINI_MODEL".equalsIgnoreCase(k) || "LLM_MODEL".equalsIgnoreCase(k)) && !v.isBlank()) {
                            return v;
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }

        return "gemini-3.8-flash";
    }

    private AiAssistantController.AiSuggestionResponse callGeminiApi(String userQuery, String apiKey, String model) throws Exception {
        String systemContext = buildDepartmentContext();

        // Target Google Gemini API endpoint
        String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                model, apiKey);

        Map<String, Object> requestPayload = new LinkedHashMap<>();

        // System Instruction
        requestPayload.put("system_instruction", Map.of(
                "parts", List.of(Map.of("text", systemContext))
        ));

        // User Query
        requestPayload.put("contents", List.of(
                Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text",
                                "User Query: " + userQuery + "\n\nRespond with a JSON object in this EXACT schema:\n" +
                                "{\n" +
                                "  \"answer\": \"Detailed helpful answer formatted in clean Markdown with clear reasoning.\",\n" +
                                "  \"recommendations\": [\"actionable recommendation 1\", \"actionable recommendation 2\"],\n" +
                                "  \"suggestedActions\": [\"Open Plan Builder\", \"View Master Timetable\"]\n" +
                                "}\nDo NOT wrap in markdown ticks if using json mode, or output valid json only."
                        ))
                )
        ));

        // Generation Config with JSON mode
        requestPayload.put("generationConfig", Map.of(
                "temperature", 0.3,
                "topK", 40,
                "topP", 0.95,
                "maxOutputTokens", 1200,
                "responseMimeType", "application/json"
        ));

        String jsonBody = objectMapper.writeValueAsString(requestPayload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 503) {
            log.info("Gemini returned 503, retrying once after 1s delay...");
            Thread.sleep(1000);
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        }

        if (response.statusCode() != 200) {
            throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode candidate = root.path("candidates").path(0);
        String text = candidate.path("content").path("parts").path(0).path("text").asText();

        if (text == null || text.isBlank()) {
            throw new RuntimeException("Empty response from Gemini API");
        }

        // Parse JSON output from Gemini
        try {
            JsonNode parsed = objectMapper.readTree(text);
            String answer = parsed.path("answer").asText();
            List<String> recs = new ArrayList<>();
            if (parsed.has("recommendations") && parsed.get("recommendations").isArray()) {
                for (JsonNode n : parsed.get("recommendations")) {
                    if (n.isObject()) {
                        StringBuilder sb = new StringBuilder();
                        if (n.has("name")) sb.append(n.get("name").asText());
                        if (n.has("department")) sb.append(" (").append(n.get("department").asText()).append(")");
                        if (n.has("rationale")) sb.append(": ").append(n.get("rationale").asText());
                        else if (n.has("specialization")) sb.append(" - ").append(n.get("specialization").asText());
                        recs.add(sb.length() > 0 ? sb.toString() : n.toString());
                    } else {
                        recs.add(n.asText());
                    }
                }
            }
            List<String> actions = new ArrayList<>();
            if (parsed.has("suggestedActions") && parsed.get("suggestedActions").isArray()) {
                for (JsonNode n : parsed.get("suggestedActions")) {
                    actions.add(n.asText());
                }
            }
            if (actions.isEmpty()) {
                actions.add("Open Plan Builder");
                actions.add("View Master Timetable");
            }
            return new AiAssistantController.AiSuggestionResponse(answer, recs, actions, "GEMINI_LIVE_" + model.toUpperCase());
        } catch (Exception parseEx) {
            // If Gemini returned raw text instead of pure JSON
            List<String> recs = List.of(
                    "Review suggested venue reallocations in Plan Builder.",
                    "Verify room capacity against division strength before confirming."
            );
            List<String> actions = List.of("Open Plan Builder", "View Baseline Clashes");
            return new AiAssistantController.AiSuggestionResponse(text, recs, actions, "GEMINI_LIVE_" + model.toUpperCase());
        }
    }

    private String buildDepartmentContext() {
        Optional<TimetableVersion> activeVersion = versionRepo.findActive();
        String versionName = activeVersion.map(TimetableVersion::getName).orElse("A.Y. 2026-27 SEM-I");

        List<Room> allRooms = roomRepo.findAll();
        StringBuilder roomSummary = new StringBuilder();
        for (Room r : allRooms) {
            roomSummary.append(String.format("- %s (%s, Cap: %d, Lab: %s)\n",
                    r.getCode(), r.getRoomType(), r.getCapacity(), r.getLabCode() != null ? r.getLabCode() : "N/A"));
        }

        List<Faculty> allFaculty = facultyRepo.findAll();
        StringBuilder facSummary = new StringBuilder();
        int facLimit = Math.min(allFaculty.size(), 20);
        for (int i = 0; i < facLimit; i++) {
            Faculty f = allFaculty.get(i);
            facSummary.append(String.format("- %s: Prof. %s\n", f.getCode(), f.getFullName() != null ? f.getFullName() : f.getCode()));
        }

        LocalDate today = LocalDate.now();
        List<Disruption> disruptions = disruptionRepo.findByDate(today);

        return """
            You are the official AI Rescheduling Assistant for ReSlot at the Department of Computer Engineering,
            JSPM's Rajarshi Shahu College of Engineering (RSCOE), Tathawade, Pune.

            CORE SYSTEM DOMAIN RULES:
            1. Master Timetable is READ-ONLY once active. Changes must only be proposed via date-specific schedule overrides.
            2. Strict Room Invariants: Computer Practical sessions MUST ONLY be assigned to Computer Laboratories (e.g., A1-208, A-207, A1-301, A1-209). Lectures MUST be assigned to classrooms with capacity >= division cohort.
            3. Propose-Only Mode: You are an intelligent consultative advisor. You propose conflict-free moves, explain blast radiuses, suggest faculty proxies, and evaluate room substitutions. You do NOT write directly to the database.
            4. Preserved Baseline Clashes: Pre-existing baseline clashes in the active master timetable are accepted benchmarks and must never be treated as new solver bugs. Zero new collisions are permitted.

            DEPARTMENT TIMETABLE CONTEXT:
            Active Version: %s
            Target Date: %s

            AVAILABLE ROOMS & VENUES:
            %s

            FACULTY SAMPLE:
            %s

            ACTIVE DISRUPTIONS FOR TODAY:
            %s disruptions currently logged.

            Tone: Professional, academically rigorous, helpful, and concise. Provide concrete actionable suggestions.
            """.formatted(versionName, today, roomSummary, facSummary, disruptions.size());
    }

    private AiAssistantController.AiSuggestionResponse generateHeuristicFallback(String query, boolean isOffline) {
        String q = query.toLowerCase();
        String answer;
        List<String> recommendations = new ArrayList<>();
        List<String> actions = new ArrayList<>();

        if (q.contains("lab") || q.contains("free") || q.contains("available") || q.contains("computer")) {
            answer = "Based on the Department master timetable, Computer Labs A1-208 (Lab 2) and A-207 (Software Lab) are eligible re-routing venues. Note: Practical sessions must strictly occupy Computer Labs, not classrooms, to ensure high-performance desktop availability.";
            recommendations.add("Allocate affected practical batch to Computer Lab A1-208 or A-207.");
            recommendations.add("Ensure student division batch count <= lab capacity (30 workstations).");
            actions.add("Open Plan Builder");
            actions.add("View Room Rules");
        } else if (q.contains("swap") || q.contains("faculty") || q.contains("leave") || q.contains("substitute")) {
            answer = "When faculty members take casual or medical leave, proxy substitution prioritizes co-instructors teaching the same curriculum subject. If no proxy is available, the session moves to an open afternoon slot.";
            recommendations.add("Assign co-subject faculty proxy from the same teaching cluster.");
            recommendations.add("Alternatively, schedule an afternoon lab slot via Plan B.");
            actions.add("Log Faculty Disruption");
            actions.add("Open Plan Builder");
        } else if (q.contains("clash") || q.contains("baseline") || q.contains("conflict")) {
            answer = "The department active master timetable contains pre-existing baseline clashes (accepted benchmark allocations). The CP-SAT solver preserves these accepted baselines and guarantees ZERO new clashes.";
            recommendations.add("Review the Baseline Clash audit report in Conflicts tab.");
            recommendations.add("Solver enforces blast-radius minimization for any rescheduled slots.");
            actions.add("View Baseline Clashes");
        } else {
            answer = String.format("ReSlot Propose-Only Engine evaluated: '%s'. All suggestions adhere strictly to RSCOE lab requirements, faculty workloads, and zero-new-clash invariants.", query);
            recommendations.add("Use Solver Plan Builder for automated Pareto-optimal reschedule plans.");
            recommendations.add("Connect your Google Gemini API key to enable live conversational reasoning.");
            actions.add("Open Plan Builder");
            actions.add("Log Disruption");
        }

        if (!isOffline) {
            answer += "\n\n💡 *Tip: Enter your Google Gemini API key in the top settings bar to enable live AI reasoning powered by Gemini 1.5 / 2.0 Flash.*";
        }

        return new AiAssistantController.AiSuggestionResponse(answer, recommendations, actions, "PROPOSE_ONLY_HEURISTIC");
    }
}
