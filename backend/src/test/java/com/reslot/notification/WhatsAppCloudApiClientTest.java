package com.reslot.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppCloudApiClientTest {

    @Test
    @DisplayName("In default unconfigured sandbox mode, sendTextMessage generates transparent simulated message ID")
    void testSandboxModeDispatch() {
        ObjectMapper mapper = new ObjectMapper();
        WhatsAppCloudApiClient client = new WhatsAppCloudApiClient(mapper);

        assertThat(client.isSandbox()).isTrue();

        String providerId = client.sendTextMessage("+919876543210", "Test broadcast message");
        assertThat(providerId).startsWith("sandbox_simulated_");
    }
}
