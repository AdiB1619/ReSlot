package com.reslot.timetable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TimetableSessionRepository extends JpaRepository<TimetableSession, Long> {

    List<TimetableSession> findByVersionId(Long versionId);

    @Query("SELECT s FROM TimetableSession s WHERE s.version.id = :versionId AND s.dayOfWeek = :day")
    List<TimetableSession> findByVersionAndDay(Long versionId, int day);

    @Query("""
        SELECT s FROM TimetableSession s 
        JOIN s.groups g 
        WHERE s.version.id = :versionId AND g.id = :groupId
    """)
    List<TimetableSession> findByVersionAndGroup(Long versionId, Long groupId);

    @Query("""
        SELECT s FROM TimetableSession s 
        JOIN s.faculty f 
        WHERE s.version.id = :versionId AND f.id = :facultyId
    """)
    List<TimetableSession> findByVersionAndFaculty(Long versionId, Long facultyId);

    @Query("SELECT s FROM TimetableSession s WHERE s.version.id = :versionId AND s.room.id = :roomId")
    List<TimetableSession> findByVersionAndRoom(Long versionId, Long roomId);
}
