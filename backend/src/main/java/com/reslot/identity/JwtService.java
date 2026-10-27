package com.reslot.identity;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Date;

@Component
public class JwtService {

    private final SecretKey key;
    private final long accessTokenExpiryMs;
    private final Clock clock;

    public JwtService(
            @Value("${app.jwt.signing-key}") String signingKey,
            @Value("${app.jwt.access-token-expiry-minutes:15}") long accessTokenExpiryMinutes,
            Clock clock) {
        this.key = Keys.hmacShaKeyFor(signingKey.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiryMs = accessTokenExpiryMinutes * 60 * 1000;
        this.clock = clock;
    }

    public String generateAccessToken(User user) {
        long now = clock.millis();
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("role", user.getRole().name())
                .claim("userId", user.getId())
                .issuedAt(new Date(now))
                .expiration(new Date(now + accessTokenExpiryMs))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .clock(() -> new Date(clock.millis()))
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isTokenValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String extractEmail(String token) {
        return parseToken(token).getSubject();
    }
}
