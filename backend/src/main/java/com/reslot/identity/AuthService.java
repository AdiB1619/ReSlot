package com.reslot.identity;

import com.reslot.shared.ApiException;
import com.reslot.shared.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

@Service
@Transactional(noRollbackFor = {ApiException.class})
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 15;

    private final UserRepository userRepo;
    private final RefreshTokenRepository refreshTokenRepo;
    private final JwtService jwtService;
    private final AuthenticationManager authManager;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Value("${app.jwt.refresh-token-expiry-days:7}")
    private long refreshTokenExpiryDays;

    public AuthService(UserRepository userRepo, RefreshTokenRepository refreshTokenRepo,
                       JwtService jwtService,
                       AuthenticationManager authManager,
                       PasswordEncoder passwordEncoder,
                       Clock clock) {
        this.userRepo = userRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.jwtService = jwtService;
        this.authManager = authManager;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    public LoginResponse login(String email, String password) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials", HttpStatus.UNAUTHORIZED));

        if (!user.isAccountNonLocked()) {
            throw new ApiException(ErrorCode.ACCOUNT_LOCKED, "Account is temporarily locked. Try again later.", HttpStatus.UNAUTHORIZED);
        }

        if (!user.isEnabled()) {
            throw new ApiException(ErrorCode.USER_DISABLED, "Account is disabled.", HttpStatus.UNAUTHORIZED);
        }

        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
        } catch (BadCredentialsException e) {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(Instant.now(clock).plus(LOCKOUT_MINUTES, ChronoUnit.MINUTES));
            }
            userRepo.save(user);
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }

        // Reset failed attempts
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepo.save(user);

        String accessToken = jwtService.generateAccessToken(user);
        String rawRefresh = UUID.randomUUID().toString();
        String family = UUID.randomUUID().toString();

        RefreshToken rt = RefreshToken.builder()
                .user(user)
                .tokenHash(sha256(rawRefresh))
                .family(family)
                .expiresAt(Instant.now(clock).plus(refreshTokenExpiryDays, ChronoUnit.DAYS))
                .revoked(false)
                .createdAt(Instant.now(clock))
                .build();
        refreshTokenRepo.save(rt);

        return new LoginResponse(accessToken, rawRefresh, user.getRole().name(), user.getMustChangePassword(), user);
    }

    public RefreshResponse refresh(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ApiException(ErrorCode.TOKEN_INVALID, "Missing refresh token", HttpStatus.UNAUTHORIZED);
        }

        String hash = sha256(rawToken);
        RefreshToken rt = refreshTokenRepo.findByTokenHash(hash)
                .orElseThrow(() -> new ApiException(ErrorCode.TOKEN_INVALID, "Invalid refresh token", HttpStatus.UNAUTHORIZED));

        if (rt.isRevoked()) {
            // Reuse detected — revoke entire family
            refreshTokenRepo.revokeFamily(rt.getFamily());
            throw new ApiException(ErrorCode.REFRESH_REUSE_DETECTED, "Token reuse detected. Please log in again.", HttpStatus.UNAUTHORIZED);
        }

        if (rt.getExpiresAt().isBefore(Instant.now(clock))) {
            throw new ApiException(ErrorCode.TOKEN_EXPIRED, "Refresh token has expired", HttpStatus.UNAUTHORIZED);
        }

        if (!rt.getUser().isEnabled()) {
            throw new ApiException(ErrorCode.USER_DISABLED, "User is disabled", HttpStatus.UNAUTHORIZED);
        }

        // Rotate
        rt.setRevoked(true);
        refreshTokenRepo.save(rt);

        String newRaw = UUID.randomUUID().toString();
        RefreshToken newRt = RefreshToken.builder()
                .user(rt.getUser())
                .tokenHash(sha256(newRaw))
                .family(rt.getFamily())
                .expiresAt(Instant.now(clock).plus(refreshTokenExpiryDays, ChronoUnit.DAYS))
                .revoked(false)
                .createdAt(Instant.now(clock))
                .build();
        refreshTokenRepo.save(newRt);

        String newAccess = jwtService.generateAccessToken(rt.getUser());
        return new RefreshResponse(newAccess, newRaw);
    }

    public void logout(String rawToken) {
        if (rawToken != null && !rawToken.isBlank()) {
            refreshTokenRepo.findByTokenHash(sha256(rawToken))
                    .ifPresent(rt -> refreshTokenRepo.revokeFamily(rt.getFamily()));
        }
    }

    public void changePassword(String email, String oldPassword, String newPassword) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "User not found", HttpStatus.NOT_FOUND));

        if (!passwordEncoder.matches(oldPassword, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Current password is incorrect", HttpStatus.BAD_REQUEST);
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "New password must be at least 8 characters", HttpStatus.BAD_REQUEST);
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        userRepo.save(user);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    // Response records
    public record LoginResponse(String accessToken, String refreshToken, String role, boolean mustChangePassword, User user) {}
    public record RefreshResponse(String accessToken, String refreshToken) {}
}
