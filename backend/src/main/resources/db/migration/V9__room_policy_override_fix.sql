-- V9: Fix room_policy_overrides mapping without weakening schema integrity (RS-AUD-027)

DO $$
BEGIN
  -- 1. Ensure implicit casts exist so standard JDBC array bindings work with room_type[]
  IF NOT EXISTS (SELECT 1 FROM pg_cast WHERE castsource = 'character varying[]'::regtype AND casttarget = 'room_type[]'::regtype) THEN
    CREATE CAST (varchar[] AS room_type[]) WITH INOUT AS IMPLICIT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_cast WHERE castsource = 'text[]'::regtype AND casttarget = 'room_type[]'::regtype) THEN
    CREATE CAST (text[] AS room_type[]) WITH INOUT AS IMPLICIT;
  END IF;
END $$;

-- 2. Add performance index on on_date for room_policy_overrides
CREATE INDEX IF NOT EXISTS idx_room_policy_overrides_date ON room_policy_overrides(on_date);
