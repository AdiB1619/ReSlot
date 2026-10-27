-- V8: Plan lifecycle, state machine, validator storage, identity links, and security hardening

-- 1. Plans table
CREATE TABLE IF NOT EXISTS plans (
    id                bigserial PRIMARY KEY,
    run_id            bigint NOT NULL REFERENCES rescheduling_runs(id) ON DELETE CASCADE,
    label             text NOT NULL,
    status            text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'VALIDATED', 'APPROVED', 'REJECTED', 'PUBLISHED')),
    plan_hash         text,
    master_version_id bigint REFERENCES timetable_versions(id),
    validation_id     bigint,
    metrics           jsonb NOT NULL DEFAULT '{}',
    rejection_reason  text,
    approved_by       text,
    approved_at       timestamptz,
    published_by      text,
    published_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz,
    version           bigint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plans_run_id ON plans(run_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);

-- 2. Plan Validations table
CREATE TABLE IF NOT EXISTS plan_validations (
    id                         bigserial PRIMARY KEY,
    plan_id                    bigint REFERENCES plans(id) ON DELETE CASCADE,
    plan_hash                  text NOT NULL,
    is_valid                   boolean NOT NULL DEFAULT false,
    new_clashes_count          integer NOT NULL DEFAULT 0,
    pre_existing_clashes_count integer NOT NULL DEFAULT 0,
    findings                   jsonb NOT NULL DEFAULT '[]',
    validated_at               timestamptz NOT NULL DEFAULT now(),
    validated_by               text NOT NULL DEFAULT 'SYSTEM_VALIDATOR'
);

CREATE INDEX IF NOT EXISTS idx_plan_validations_plan_id ON plan_validations(plan_id);

-- Link validation_id back to plan_validations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_plans_validation') THEN
    ALTER TABLE plans ADD CONSTRAINT fk_plans_validation FOREIGN KEY (validation_id) REFERENCES plan_validations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Add plan_id to schedule_overrides
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_overrides' AND column_name = 'plan_id') THEN
    ALTER TABLE schedule_overrides ADD COLUMN plan_id bigint REFERENCES plans(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Replace restrictive uq_active_override so multiple candidate plans can coexist as PROPOSED
DROP INDEX IF EXISTS uq_active_override;
CREATE UNIQUE INDEX IF NOT EXISTS uq_approved_published_override
  ON schedule_overrides (session_id, on_date)
  WHERE status IN ('APPROVED', 'PUBLISHED');

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_session_override
  ON schedule_overrides (plan_id, session_id);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_plan_id ON schedule_overrides(plan_id);

-- 5. User to faculty/student-group linkage
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'faculty_id') THEN
    ALTER TABLE users ADD COLUMN faculty_id bigint REFERENCES faculty(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'group_id') THEN
    ALTER TABLE users ADD COLUMN group_id bigint REFERENCES student_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Trigger to prevent modification/deletion of PUBLISHED overrides (RS-AUD-007, RS-AUD-026)
CREATE OR REPLACE FUNCTION trg_protect_published_overrides() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'PUBLISHED overrides cannot be deleted (session_id %, date %)', OLD.session_id, OLD.on_date;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'PUBLISHED' AND NEW.status <> 'PUBLISHED' THEN
      RAISE EXCEPTION 'PUBLISHED overrides cannot be reverted or modified directly (session_id %, date %)', OLD.session_id, OLD.on_date;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_published_overrides ON schedule_overrides;
CREATE TRIGGER protect_published_overrides
  BEFORE UPDATE OR DELETE ON schedule_overrides
  FOR EACH ROW EXECUTE FUNCTION trg_protect_published_overrides();

-- 7. Strengthen master-lock trigger against reparenting bypasses (RS-AUD-026)
CREATE OR REPLACE FUNCTION trg_lock_master() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_id_old     bigint;
  v_id_new     bigint;
  v_status_old version_status;
  v_status_new version_status;
  v_sess_old   bigint;
  v_sess_new   bigint;
BEGIN
  IF TG_TABLE_NAME = 'timetable_sessions' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT status INTO v_status_old FROM timetable_versions WHERE id = OLD.version_id;
      IF v_status_old IS NOT NULL AND v_status_old <> 'DRAFT' THEN
        RAISE EXCEPTION 'master timetable version % is % and read-only', OLD.version_id, v_status_old;
      END IF;
      RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
      SELECT status INTO v_status_new FROM timetable_versions WHERE id = NEW.version_id;
      IF v_status_new IS NOT NULL AND v_status_new <> 'DRAFT' THEN
        RAISE EXCEPTION 'master timetable version % is % and read-only', NEW.version_id, v_status_new;
      END IF;
      RETURN NEW;
    ELSE -- UPDATE
      SELECT status INTO v_status_old FROM timetable_versions WHERE id = OLD.version_id;
      SELECT status INTO v_status_new FROM timetable_versions WHERE id = NEW.version_id;
      IF (v_status_old IS NOT NULL AND v_status_old <> 'DRAFT') OR (v_status_new IS NOT NULL AND v_status_new <> 'DRAFT') THEN
        RAISE EXCEPTION 'master timetable version is read-only (old: %, new: %)', v_status_old, v_status_new;
      END IF;
      RETURN NEW;
    END IF;
  ELSE
    -- Join tables: session_groups or session_faculty
    IF TG_OP = 'DELETE' THEN
      SELECT version_id INTO v_id_old FROM timetable_sessions WHERE id = OLD.session_id;
      SELECT status INTO v_status_old FROM timetable_versions WHERE id = v_id_old;
      IF v_status_old IS NOT NULL AND v_status_old <> 'DRAFT' THEN
        RAISE EXCEPTION 'cannot modify relations on read-only master version %', v_status_old;
      END IF;
      RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
      SELECT version_id INTO v_id_new FROM timetable_sessions WHERE id = NEW.session_id;
      SELECT status INTO v_status_new FROM timetable_versions WHERE id = v_id_new;
      IF v_status_new IS NOT NULL AND v_status_new <> 'DRAFT' THEN
        RAISE EXCEPTION 'cannot add relations to read-only master version %', v_status_new;
      END IF;
      RETURN NEW;
    ELSE -- UPDATE
      SELECT version_id INTO v_id_old FROM timetable_sessions WHERE id = OLD.session_id;
      SELECT version_id INTO v_id_new FROM timetable_sessions WHERE id = NEW.session_id;
      SELECT status INTO v_status_old FROM timetable_versions WHERE id = v_id_old;
      SELECT status INTO v_status_new FROM timetable_versions WHERE id = v_id_new;
      IF (v_status_old IS NOT NULL AND v_status_old <> 'DRAFT') OR (v_status_new IS NOT NULL AND v_status_new <> 'DRAFT') THEN
        RAISE EXCEPTION 'cannot update relations on read-only master';
      END IF;
      RETURN NEW;
    END IF;
  END IF;
END $$;

-- 8. Append-only audit log protection (RS-AUD-026)
CREATE OR REPLACE FUNCTION trg_audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; UPDATE and DELETE are prohibited';
END $$;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION trg_audit_log_append_only();
