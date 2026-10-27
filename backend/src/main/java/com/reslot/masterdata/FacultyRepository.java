package com.reslot.masterdata;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface FacultyRepository extends JpaRepository<Faculty, Long> {
    Optional<Faculty> findByCode(String code);
    List<Faculty> findByIsActiveTrue();

    @Query("SELECT fa.faculty FROM FacultyAlias fa WHERE fa.alias = :alias")
    Optional<Faculty> findByAlias(String alias);

    @Query("SELECT f FROM Faculty f WHERE LOWER(f.code) = LOWER(:code) OR EXISTS (SELECT fa FROM FacultyAlias fa WHERE fa.faculty = f AND LOWER(fa.alias) = LOWER(:code))")
    Optional<Faculty> findByCodeOrAlias(String code);
}
