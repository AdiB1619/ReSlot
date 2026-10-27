package com.reslot.config;

import com.reslot.shared.ApiException;
import com.reslot.shared.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private void enrichProblemDetail(ProblemDetail pd, HttpServletRequest request) {
        String corrId = MDC.get("correlationId");
        if (corrId != null) {
            pd.setProperty("correlationId", corrId);
        }
        pd.setProperty("timestamp", Instant.now().toString());
        pd.setProperty("path", request.getRequestURI());
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> handleApiException(ApiException ex, HttpServletRequest request) {
        log.warn("API error [{}]: {}", ex.getErrorCode(), ex.getMessage());
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/" + ex.getErrorCode().name().toLowerCase()));
        pd.setProperty("errorCode", ex.getErrorCode().name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(ex.getStatus()).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            errors.put(fe.getField(), fe.getDefaultMessage());
        }
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "Validation failed");
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/validation_failed"));
        pd.setProperty("errorCode", ErrorCode.VALIDATION_FAILED.name());
        pd.setProperty("errors", errors);
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/constraint_violation"));
        pd.setProperty("errorCode", ErrorCode.CONSTRAINT_VIOLATION.name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemDetail> handleNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Malformed JSON request body: " + ex.getMostSpecificCause().getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/bad_request"));
        pd.setProperty("errorCode", "MALFORMED_JSON");
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ProblemDetail> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.METHOD_NOT_ALLOWED, ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/method_not_allowed"));
        pd.setProperty("errorCode", "METHOD_NOT_ALLOWED");
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ProblemDetail> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/unsupported_media_type"));
        pd.setProperty("errorCode", "UNSUPPORTED_MEDIA_TYPE");
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
        log.warn("Database constraint violation at {}: {}", request.getRequestURI(), ex.getMostSpecificCause().getMessage());
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Database constraint violation: " + ex.getMostSpecificCause().getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/conflict"));
        pd.setProperty("errorCode", ErrorCode.CONFLICT.name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.CONFLICT).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/bad_request"));
        pd.setProperty("errorCode", "INVALID_ARGUMENT");
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ProblemDetail> handleIllegalState(IllegalStateException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/conflict"));
        pd.setProperty("errorCode", ErrorCode.ILLEGAL_STATE.name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.CONFLICT).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Access denied");
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/access_denied"));
        pd.setProperty("errorCode", ErrorCode.ACCESS_DENIED.name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ProblemDetail> handleAuthentication(AuthenticationException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Authentication required");
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/token_invalid"));
        pd.setProperty("errorCode", ErrorCode.TOKEN_INVALID.name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ProblemDetail> handleMaxUpload(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE, "File size exceeds the maximum allowed limit of 25 MB");
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/file_too_large"));
        pd.setProperty("errorCode", ErrorCode.FILE_TOO_LARGE.name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    public ResponseEntity<ProblemDetail> handleMissingParam(org.springframework.web.bind.MissingServletRequestParameterException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/missing_parameter"));
        pd.setProperty("errorCode", "MISSING_PARAMETER");
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ProblemDetail> handleNoResource(org.springframework.web.servlet.resource.NoResourceFoundException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Resource not found: " + request.getRequestURI());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/not_found"));
        pd.setProperty("errorCode", "NOT_FOUND");
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneral(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception at {}", request.getRequestURI(), ex);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred: " + ex.getMessage());
        pd.setType(URI.create("https://reslot.rscoe.edu.in/errors/internal_error"));
        pd.setProperty("errorCode", ErrorCode.INTERNAL_ERROR.name());
        enrichProblemDetail(pd, request);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }
}
