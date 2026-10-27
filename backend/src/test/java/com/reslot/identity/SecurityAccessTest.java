package com.reslot.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityAccessTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String coordinatorToken;
    private String adminToken;

    @BeforeEach
    void obtainTokens() throws Exception {
        coordinatorToken = loginAndGetToken("coordinator@rscoe.edu.in", "ChangeMe123!");
        adminToken = loginAndGetToken("admin@rscoe.edu.in", "ChangeMe123!");
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        String body = String.format("{\"email\":\"%s\",\"password\":\"%s\"}", email, password);
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        return json.get("accessToken").asText();
    }

    @Test
    @DisplayName("RS-AUD-001: Unauthenticated GET /api/v1/plans returns 401 Unauthorized")
    void testUnauthenticatedPlansReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/plans"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("RS-AUD-001/002: Unauthenticated POST /api/v1/plans/1/publish returns 401 (not 500)")
    void testUnauthenticatedPublishReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/plans/1/publish"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Role RBAC: Coordinator can view plans")
    void testCoordinatorCanAccessPlans() throws Exception {
        mockMvc.perform(get("/api/v1/plans")
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Role RBAC: Coordinator has full authority to publish plans (not 403 Forbidden)")
    void testCoordinatorHasPublishAuthority() throws Exception {
        mockMvc.perform(post("/api/v1/plans/999999/publish")
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(result -> assertTrue(
                        result.getResponse().getStatus() == 404 || result.getResponse().getStatus() == 409,
                        "Coordinator must have publish authority, so request proceeds past security (status not 403)"));
    }

    @Test
    @DisplayName("Role RBAC: Admin has full authority to publish plans (not 403 Forbidden)")
    void testAdminHasPublishAuthority() throws Exception {
        mockMvc.perform(post("/api/v1/plans/999999/publish")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(result -> assertTrue(
                        result.getResponse().getStatus() == 404 || result.getResponse().getStatus() == 409,
                        "Admin must have publish authority, so request proceeds past security (status not 403)"));
    }

    @Test
    @DisplayName("Role RBAC: Coordinator can access notification dispatch status")
    void testCoordinatorCanAccessNotifications() throws Exception {
        mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", "Bearer " + coordinatorToken))
                .andExpect(status().isOk());
    }
}
