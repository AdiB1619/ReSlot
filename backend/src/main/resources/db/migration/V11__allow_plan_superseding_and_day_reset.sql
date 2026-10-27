-- V11: Allow Coordinators to supersede published plans and normalize/reset days

-- 1. Replace restrictive approved+published index with published-only uniqueness
DROP INDEX IF EXISTS uq_approved_published_override;
CREATE UNIQUE INDEX IF NOT EXISTS uq_published_override
  ON schedule_overrides (session_id, on_date)
  WHERE status = 'PUBLISHED';

-- 2. Allow transition from PUBLISHED to REJECTED for superseding or normalizing schedule
CREATE OR REPLACE FUNCTION trg_protect_published_overrides() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'PUBLISHED overrides cannot be deleted (session_id %, date %)', OLD.session_id, OLD.on_date;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Allow updating status to REJECTED (when superseded or when day is reset to master timetable)
    IF OLD.status = 'PUBLISHED' AND NEW.status NOT IN ('PUBLISHED', 'REJECTED') THEN
      RAISE EXCEPTION 'PUBLISHED overrides cannot be modified directly (session_id %, date %)', OLD.session_id, OLD.on_date;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
