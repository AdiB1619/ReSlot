package com.reslot.masterdata;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface StudentGroupRepository extends JpaRepository<StudentGroup, Long> {
    List<StudentGroup> findByKind(StudentGroup.GroupKind kind);
    List<StudentGroup> findByParentId(Long parentId);

    @Query("SELECT g FROM StudentGroup g WHERE g.parent IS NULL")
    List<StudentGroup> findDivisions();

    @Query("SELECT g FROM StudentGroup g WHERE g.level = :level")
    List<StudentGroup> findByLevel(String level);

    java.util.Optional<StudentGroup> findByName(String name);
}
