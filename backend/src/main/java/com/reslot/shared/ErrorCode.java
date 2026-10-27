package com.reslot.shared;

/**
 * Stable error codes for problem+json responses.
 * Keep codes stable across versions; never reuse a deleted code.
 */
public enum ErrorCode {
    // Auth
    INVALID_CREDENTIALS,
    ACCOUNT_LOCKED,
    TOKEN_EXPIRED,
    TOKEN_INVALID,
    REFRESH_REUSE_DETECTED,
    // Authorization
    ACCESS_DENIED,
    FORBIDDEN,
    // Validation
    VALIDATION_FAILED,
    CONSTRAINT_VIOLATION,
    // Resources
    NOT_FOUND,
    CONFLICT,
    // Master timetable domain
    MASTER_READ_ONLY,
    VERSION_NOT_ACTIVE,
    IMPORT_ALREADY_EXISTS,
    BLOCKING_FLAGS_OPEN,
    CLASH_BLOCKS_APPROVAL,
    // Runs / plans
    RUN_ALREADY_ACTIVE,
    PLAN_INFEASIBLE,
    PLAN_INVALID,
    PLAN_NOT_SUBMITTED,
    // Notifications
    NOTIFICATION_FAILED,
    // Uploads
    UNSUPPORTED_FILE_TYPE,
    FILE_TOO_LARGE,
    // General
    INTERNAL_ERROR,
    NOT_IMPLEMENTED,
    USER_DISABLED,
    ILLEGAL_STATE,
}
