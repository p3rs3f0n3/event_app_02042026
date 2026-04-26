CREATE OR REPLACE FUNCTION sync_event_lifecycle_state()
RETURNS TRIGGER AS $$
DECLARE
  previous_start_real_at TIMESTAMPTZ := NULL;
  previous_end_real_at TIMESTAMPTZ := NULL;
  normalized_status TEXT := LOWER(COALESCE(NEW.event_status, 'not_started'));
BEGIN
  IF TG_OP = 'UPDATE' THEN
    previous_start_real_at := OLD.start_real_at;
    previous_end_real_at := OLD.end_real_at;
  END IF;

  IF normalized_status IN ('created', 'not_started') THEN
    normalized_status := 'not_started';
  ELSIF normalized_status IN ('started', 'active') THEN
    normalized_status := 'active';
  ELSIF normalized_status IN ('finished', 'finalized') THEN
    normalized_status := 'finalized';
  ELSE
    normalized_status := 'not_started';
  END IF;

  IF normalized_status = 'active' THEN
    NEW.start_real_at := COALESCE(NEW.start_real_at, previous_start_real_at, NEW.start_date, NOW());
  ELSIF normalized_status = 'finalized' THEN
    NEW.start_real_at := COALESCE(NEW.start_real_at, previous_start_real_at, NEW.start_date, NOW());
    NEW.end_real_at := COALESCE(NEW.end_real_at, previous_end_real_at, NEW.end_date, NOW());
  END IF;

  IF NEW.manual_inactivated_at IS NOT NULL THEN
    normalized_status := 'finalized';
  ELSIF NEW.end_real_at IS NOT NULL THEN
    normalized_status := 'finalized';
  ELSIF NEW.start_real_at IS NOT NULL THEN
    normalized_status := 'active';
  END IF;

  NEW.event_status := normalized_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_event_lifecycle_state ON events;
CREATE TRIGGER trg_sync_event_lifecycle_state
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION sync_event_lifecycle_state();

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_active_requires_start_real_at;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_finalized_requires_milestones;
ALTER TABLE events ADD CONSTRAINT events_active_requires_start_real_at CHECK (event_status <> 'active' OR start_real_at IS NOT NULL);
ALTER TABLE events ADD CONSTRAINT events_finalized_requires_milestones CHECK (event_status <> 'finalized' OR (start_real_at IS NOT NULL AND end_real_at IS NOT NULL));
