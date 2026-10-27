package com.reslot.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Authentication", description = "Login, refresh, logout and profile")
public class AuthController {

    private static final String REFRESH_COOKIE = "refresh_token";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/auth/login")
    @Operation(summary = "Login with email and password")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req, HttpServletResponse res) {
        AuthService.LoginResponse result = authService.login(req.email(), req.password());
        setRefreshCookie(res, result.refreshToken());
        UserProfileResponse profile = new UserProfileResponse(
                result.user().getId(), result.user().getEmail(), result.user().getFullName(),
                result.user().getRole().name(), result.user().getMustChangePassword(),
                result.user().getFacultyId(), result.user().getGroupId()
        );
        return ResponseEntity.ok(new LoginResponse(
                result.accessToken(),
                result.accessToken(),
                result.role(),
                result.mustChangePassword(),
                profile
        ));
    }

    @PostMapping("/auth/refresh")
    @Operation(summary = "Rotate the refresh token")
    public ResponseEntity<Map<String, String>> refresh(HttpServletRequest req, HttpServletResponse res) {
        String raw = extractRefreshCookie(req);
        AuthService.RefreshResponse result = authService.refresh(raw);
        setRefreshCookie(res, result.refreshToken());
        return ResponseEntity.ok(Map.of("accessToken", result.accessToken()));
    }

    @PostMapping("/auth/logout")
    @Operation(summary = "Revoke refresh token family and clear cookie")
    public ResponseEntity<Void> logout(HttpServletRequest req, HttpServletResponse res) {
        String raw = extractRefreshCookie(req);
        authService.logout(raw);
        clearRefreshCookie(res);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/auth/change-password")
    @Operation(summary = "Change password for authenticated user")
    public ResponseEntity<Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest req,
            @AuthenticationPrincipal User user) {
        authService.changePassword(user.getEmail(), req.oldPassword(), req.newPassword());
        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }

    @GetMapping({"/me", "/auth/me"})
    @Operation(summary = "Get current user profile")
    public ResponseEntity<UserProfileResponse> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(new UserProfileResponse(
                user.getId(), user.getEmail(), user.getFullName(),
                user.getRole().name(), user.getMustChangePassword(),
                user.getFacultyId(), user.getGroupId()
        ));
    }

    // DTO records
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record LoginResponse(
            String accessToken,
            String token,
            String role,
            boolean mustChangePassword,
            UserProfileResponse user
    ) {
        public LoginResponse(String accessToken, String role, boolean mustChangePassword) {
            this(accessToken, accessToken, role, mustChangePassword, null);
        }
    }
    public record ChangePasswordRequest(@NotBlank String oldPassword, @NotBlank String newPassword) {}
    public record UserProfileResponse(Long id, String email, String fullName, String role, boolean mustChangePassword, Long facultyId, Long groupId) {}

    private void setRefreshCookie(HttpServletResponse res, String token) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, token);
        cookie.setHttpOnly(true);
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge((int) (7 * 24 * 3600));
        cookie.setAttribute("SameSite", "Strict");
        res.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse res) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, "");
        cookie.setHttpOnly(true);
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge(0);
        res.addCookie(cookie);
    }

    private String extractRefreshCookie(HttpServletRequest req) {
        if (req.getCookies() == null) return null;
        return Arrays.stream(req.getCookies())
                .filter(c -> REFRESH_COOKIE.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
