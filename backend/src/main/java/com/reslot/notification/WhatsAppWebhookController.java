package com.reslot.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/notifications/webhook")
@Tag(name = "WhatsApp Webhooks", description = "Meta WhatsApp Cloud API delivery callbacks and verification")
public class WhatsAppWebhookController {

    private final NotificationJobRepository jobRepo;
    private final ObjectMapper objectMapper;

    @Value("${app.whatsapp.verify-token:reslot_verify_token}")
    private String verifyToken;

    public WhatsAppWebhookController(NotificationJobRepository jobRepo, ObjectMapper objectMapper) {
        this.jobRepo = jobRepo;
        this.objectMapper = objectMapper;
    }

    /**
     * Webhook verification challenge from Meta
     */
    @GetMapping
    @Operation(summary = "Verify WhatsApp Cloud API webhook subscription")
    public ResponseEntity<String> verifyWebhook(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.challenge") String challenge,
            @RequestParam("hub.verify_token") String token) {

        if ("subscribe".equals(mode) && verifyToken.equals(token)) {
            log.info("WhatsApp Cloud API webhook verified successfully");
            return ResponseEntity.ok(challenge);
        }
        log.warn("WhatsApp Cloud API webhook verification failed. Received token: {}", token);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Verification token mismatch");
    }

    /**
     * Webhook event receiver for status updates: sent, delivered, read, failed
     */
    @PostMapping
    @Transactional
    @Operation(summary = "Receive delivery status updates from Meta WhatsApp Cloud API")
    public ResponseEntity<Void> receiveStatusUpdate(@RequestBody String rawPayload) {
        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            JsonNode entryNode = root.path("entry");
            if (entryNode.isArray()) {
                for (JsonNode entry : entryNode) {
                    JsonNode changes = entry.path("changes");
                    if (changes.isArray()) {
                        for (JsonNode change : changes) {
                            JsonNode statuses = change.path("value").path("statuses");
                            if (statuses.isArray()) {
                                for (JsonNode statusObj : statuses) {
                                    String messageId = statusObj.path("id").asText();
                                    String statusStr = statusObj.path("status").asText();

                                    if (messageId != null && !messageId.isBlank()) {
                                        updateJobStatus(messageId, statusStr);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse WhatsApp Cloud API webhook payload", e);
        }
        return ResponseEntity.ok().build();
    }

    private void updateJobStatus(String messageId, String statusStr) {
        jobRepo.findByProviderMessageId(messageId).ifPresent(job -> {
            switch (statusStr.toLowerCase()) {
                case "delivered" -> job.setStatus(NotificationJob.Status.DELIVERED);
                case "read" -> job.setStatus(NotificationJob.Status.READ);
                case "failed" -> job.setStatus(NotificationJob.Status.FAILED);
                case "sent" -> job.setStatus(NotificationJob.Status.SENT);
            }
            jobRepo.save(job);
            log.info("Updated notification job id={} status to {} via Meta webhook", job.getId(), job.getStatus());
        });
    }
}
