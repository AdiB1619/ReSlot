package com.reslot.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
public class WhatsAppCloudApiClient {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${app.whatsapp.phone-number-id:}")
    private String phoneNumberId;

    @Value("${app.whatsapp.access-token:}")
    private String accessToken;

    @Value("${app.whatsapp.sandbox:true}")
    private boolean sandboxMode;

    public WhatsAppCloudApiClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean isSandbox() {
        return sandboxMode || phoneNumberId == null || phoneNumberId.isBlank() || accessToken == null || accessToken.isBlank();
    }

    /**
     * Dispatches a WhatsApp text message. If running in sandbox mode or if credentials
     * are unconfigured, generates a simulated sandbox delivery message ID.
     * When configured in live cloud_api mode, calls Meta Graph API v19.0.
     */
    public String sendTextMessage(String recipientPhone, String messageText) {
        if (isSandbox()) {
            String simulatedId = "sandbox_simulated_" + UUID.randomUUID();
            log.info("WhatsApp Cloud API in SANDBOX mode. Simulated message dispatch to recipient={}, providerId={}",
                    recipientPhone != null ? recipientPhone : "BROADCAST_COHORT", simulatedId);
            return simulatedId;
        }

        if (recipientPhone == null || recipientPhone.isBlank()) {
            throw new IllegalArgumentException("Recipient phone number is missing for live WhatsApp dispatch");
        }

        // Clean phone number to E.164 without leading plus
        String cleanPhone = recipientPhone.replaceAll("[^0-9]", "");

        try {
            String url = "https://graph.facebook.com/v19.0/" + phoneNumberId + "/messages";
            Map<String, Object> payload = Map.of(
                    "messaging_product", "whatsapp",
                    "recipient_type", "individual",
                    "to", cleanPhone,
                    "type", "text",
                    "text", Map.of("preview_url", false, "body", messageText)
            );

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode messages = root.path("messages");
                if (messages.isArray() && !messages.isEmpty()) {
                    String metaMessageId = messages.get(0).path("id").asText();
                    log.info("Successfully dispatched WhatsApp message via Meta Cloud API. metaMessageId={}", metaMessageId);
                    return metaMessageId;
                }
                return "wamid_ok_" + UUID.randomUUID();
            } else {
                log.error("Meta WhatsApp Cloud API error: HTTP {} - Body: {}", response.statusCode(), response.body());
                throw new RuntimeException("Meta API error: HTTP " + response.statusCode() + " - " + response.body());
            }
        } catch (Exception e) {
            log.error("Failed to send WhatsApp message via Meta Cloud API to {}", recipientPhone, e);
            throw new RuntimeException("Failed to dispatch WhatsApp message: " + e.getMessage(), e);
        }
    }
}
