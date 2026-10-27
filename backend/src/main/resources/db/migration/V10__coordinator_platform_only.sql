-- V10: ReSlot platform dedicated exclusively to Timetable Coordinator and Administrator.
-- Removes legacy HOD, Faculty, and Student user accounts.

-- 1. Remove refresh tokens and user records for deprecated roles
DELETE FROM refresh_tokens WHERE user_id IN (
    SELECT id FROM users WHERE role IN ('HOD', 'FACULTY', 'STUDENT')
);

DELETE FROM users WHERE role IN ('HOD', 'FACULTY', 'STUDENT');

-- 2. Update role constraint on users table to only permit COORDINATOR and ADMIN
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('COORDINATOR', 'ADMIN'));
