package com.reslot.reschedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlanValidationRepository extends JpaRepository<PlanValidation, Long> {
    Optional<PlanValidation> findByPlanId(Long planId);
    Optional<PlanValidation> findByPlanHash(String planHash);
    long countByNewClashesCount(int newClashesCount);
}
