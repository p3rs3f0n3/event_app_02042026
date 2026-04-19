CREATE TABLE IF NOT EXISTS event_photos (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  milestone_type VARCHAR(30) NOT NULL,
  photo_url TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_name VARCHAR(255),
  file_size BIGINT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, milestone_type)
);

CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON event_photos (event_id);
