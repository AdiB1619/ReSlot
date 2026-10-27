package com.reslot.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User Management", description = "Admin endpoints for user administration")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @Operation(summary = "List all system users")
    public ResponseEntity<List<UserService.UserSummary>> listUsers() {
        return ResponseEntity.ok(userService.listUsers());
    }

    @PostMapping
    @Operation(summary = "Create a new user")
    public ResponseEntity<UserService.UserSummary> createUser(@Valid @RequestBody UserService.CreateUserRequest req) {
        return ResponseEntity.ok(userService.createUser(req));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an existing user")
    public ResponseEntity<UserService.UserSummary> updateUser(@PathVariable Long id, @RequestBody UserService.UpdateUserRequest req) {
        return ResponseEntity.ok(userService.updateUser(id, req));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Deactivate a user")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
