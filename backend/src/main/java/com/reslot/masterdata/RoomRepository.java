package com.reslot.masterdata;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByCode(String code);
    List<Room> findByRoomType(Room.RoomType roomType);
    List<Room> findByIsActiveTrue();

    @Query("SELECT ra.room FROM RoomAlias ra WHERE ra.alias = :alias")
    Optional<Room> findByAlias(String alias);

    @Query("SELECT r FROM Room r WHERE LOWER(r.code) = LOWER(:code) OR EXISTS (SELECT ra FROM RoomAlias ra WHERE ra.room = r AND LOWER(ra.alias) = LOWER(:code))")
    Optional<Room> findByCodeOrAlias(String code);
}
