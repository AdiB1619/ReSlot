package com.reslot.identity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;
    private Clock fixedClock;

    @BeforeEach
    void setUp() {
        fixedClock = Clock.fixed(Instant.parse("2026-10-21T10:00:00Z"), ZoneId.of("Asia/Kolkata"));
        jwtService = new JwtService(
                "dev-secret-change-in-production-must-be-256-bits-long-and-secure",
                15,
                fixedClock
        );
    }

    @Test
    void testGenerateAndValidateToken() {
        User user = User.builder()
                .id(1L)
                .email("coordinator@rscoe.edu.in")
                .role(User.Role.COORDINATOR)
                .fullName("Prof. Pooja Thakre")
                .build();

        String token = jwtService.generateAccessToken(user);
        assertNotNull(token);

        String email = jwtService.extractEmail(token);
        assertEquals("coordinator@rscoe.edu.in", email);

        assertTrue(jwtService.isTokenValid(token));
        assertFalse(jwtService.isTokenValid("invalid.token.payload"));
    }
}
