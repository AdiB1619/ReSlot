package com.reslot.identity;

import com.reslot.shared.ApiException;
import com.reslot.shared.ErrorCode;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Service
@Transactional
public class UserService implements UserDetailsService {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Value("${app.admin.email:admin@rscoe.edu.in}")
    private String adminEmail;

    @Value("${app.admin.initial-password:ChangeMe123!}")
    private String adminInitialPassword;

    public UserService(UserRepository userRepo, PasswordEncoder passwordEncoder, Clock clock) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @PostConstruct
    public void seedAdminIfAbsent() {
        userRepo.findByEmail(adminEmail).ifPresentOrElse(
                admin -> {
                    admin.setLockedUntil(null);
                    admin.setFailedLoginAttempts(0);
                    admin.setActive(true);
                    userRepo.save(admin);
                },
                () -> {
                    User admin = User.builder()
                            .email(adminEmail)
                            .passwordHash(passwordEncoder.encode(adminInitialPassword))
                            .fullName("System Administrator")
                            .role(User.Role.ADMIN)
                            .active(true)
                            .mustChangePassword(false)
                            .failedLoginAttempts(0)
                            .createdAt(Instant.now(clock))
                            .build();
                    userRepo.save(admin);
                }
        );

        userRepo.findByEmail("coordinator@rscoe.edu.in").ifPresentOrElse(
                coordinator -> {
                    coordinator.setLockedUntil(null);
                    coordinator.setFailedLoginAttempts(0);
                    coordinator.setActive(true);
                    userRepo.save(coordinator);
                },
                () -> {
                    User coordinator = User.builder()
                            .email("coordinator@rscoe.edu.in")
                            .passwordHash(passwordEncoder.encode("ChangeMe123!"))
                            .fullName("Prof. Pooja Thakre (Timetable Coordinator)")
                            .role(User.Role.COORDINATOR)
                            .active(true)
                            .mustChangePassword(false)
                            .failedLoginAttempts(0)
                            .createdAt(Instant.now(clock))
                            .build();
                    userRepo.save(coordinator);
                }
        );

        // Clean up any deprecated accounts
        userRepo.findByEmail("hod@rscoe.edu.in").ifPresent(userRepo::delete);
        userRepo.findByEmail("faculty@rscoe.edu.in").ifPresent(userRepo::delete);
        userRepo.findByEmail("student@rscoe.edu.in").ifPresent(userRepo::delete);
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }

    public List<UserSummary> listUsers() {
        return userRepo.findAll().stream()
                .map(u -> new UserSummary(u.getId(), u.getEmail(), u.getFullName(), u.getRole().name(), u.isActive(), u.getFacultyId(), u.getGroupId()))
                .toList();
    }

    public UserSummary createUser(CreateUserRequest req) {
        if (userRepo.existsByEmail(req.email())) {
            throw new ApiException(ErrorCode.CONFLICT, "A user with that email already exists");
        }
        User user = User.builder()
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.initialPassword()))
                .fullName(req.fullName())
                .role(User.Role.valueOf(req.role()))
                .facultyId(req.facultyId())
                .groupId(req.groupId())
                .active(true)
                .mustChangePassword(false)
                .failedLoginAttempts(0)
                .createdAt(Instant.now(clock))
                .build();
        userRepo.save(user);
        return new UserSummary(user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(), user.isActive(), user.getFacultyId(), user.getGroupId());
    }

    public UserSummary updateUser(Long id, UpdateUserRequest req) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found: " + id));
        if (req.fullName() != null) user.setFullName(req.fullName());
        if (req.role() != null) user.setRole(User.Role.valueOf(req.role()));
        if (req.active() != null) user.setActive(req.active());
        if (req.facultyId() != null) user.setFacultyId(req.facultyId());
        if (req.groupId() != null) user.setGroupId(req.groupId());
        user.setUpdatedAt(Instant.now(clock));
        userRepo.save(user);
        return new UserSummary(user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(), user.isActive(), user.getFacultyId(), user.getGroupId());
    }

    public void deleteUser(Long id) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found: " + id));
        user.setActive(false);
        user.setUpdatedAt(Instant.now(clock));
        userRepo.save(user);
    }

    // DTOs
    public record UserSummary(Long id, String email, String fullName, String role, boolean active, Long facultyId, Long groupId) {}
    public record CreateUserRequest(String email, String initialPassword, String fullName, String role, Long facultyId, Long groupId) {}
    public record UpdateUserRequest(String fullName, String role, Boolean active, Long facultyId, Long groupId) {}
}
