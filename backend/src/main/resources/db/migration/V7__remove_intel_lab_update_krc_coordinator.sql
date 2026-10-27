-- V7: Remove Intel Lab, update KRC as LAB Knowledge Resource Centre, set Timetable Coordinator name

-- 1. Update KRC to be Knowledge Resource Centre and a dedicated LAB
UPDATE rooms
SET name = 'Knowledge Resource Centre',
    room_type = 'LAB',
    lab_code = 'KRC'
WHERE code = 'KRC';

-- 2. Remove Intel Lab (A-207 / AIL) as it is not part of Computer Department
DELETE FROM room_aliases WHERE room_id = 17 OR alias IN ('A-207', 'AIL');
UPDATE timetable_sessions SET room_id = 7 WHERE room_id = 17;
DELETE FROM notification_jobs WHERE override_id IN (SELECT id FROM schedule_overrides WHERE orig_room_id = 17 OR new_room_id = 17);
DELETE FROM schedule_overrides WHERE orig_room_id = 17 OR new_room_id = 17;
DELETE FROM disruptions WHERE room_id = 17;
DELETE FROM rooms WHERE id = 17 OR code = 'A-207';

-- 3. Update Timetable Coordinator name to Prof. Pooja Thakre in users table
UPDATE users
SET full_name = 'Prof. Pooja Thakre'
WHERE email = 'coordinator@rscoe.edu.in' OR role = 'COORDINATOR';
