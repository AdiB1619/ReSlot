-- V5: Add created_by to timetable_versions
ALTER TABLE timetable_versions ADD COLUMN IF NOT EXISTS created_by text;
