package com.reslot.shared;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final ErrorCode errorCode;
    private final HttpStatus status;

    public ApiException(ErrorCode errorCode, String message, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public ApiException(ErrorCode errorCode, String message) {
        this(errorCode, message, HttpStatus.BAD_REQUEST);
    }

    public static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
    }

    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
    }

    public static ApiException validationFailed(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
    }

    public static ApiException masterReadOnly() {
        return new ApiException(ErrorCode.MASTER_READ_ONLY, "The active master timetable is read-only. Create a new version.", HttpStatus.FORBIDDEN);
    }

    public ErrorCode getErrorCode() { return errorCode; }
    public HttpStatus getStatus() { return status; }
}
