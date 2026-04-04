CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40),
  whatsapp_phone VARCHAR(40),
  email VARCHAR(160),
  password_hash TEXT NOT NULL,
  role_id BIGINT NOT NULL REFERENCES roles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(160);

CREATE TABLE IF NOT EXISTS cities (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_other BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coordinators (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  full_name VARCHAR(160) NOT NULL,
  cedula VARCHAR(30) NOT NULL UNIQUE,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  rating SMALLINT NOT NULL DEFAULT 0,
  photo TEXT,
  city_id BIGINT NOT NULL REFERENCES cities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
  razon_social VARCHAR(180) NOT NULL,
  nit VARCHAR(40),
  contact_full_name VARCHAR(160) NOT NULL,
  contact_role VARCHAR(120),
  phone VARCHAR(40),
  whatsapp_phone VARCHAR(40),
  email VARCHAR(160),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS nit VARCHAR(40);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_role VARCHAR(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(40);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  cedula VARCHAR(30) NOT NULL UNIQUE,
  city_id BIGINT NOT NULL REFERENCES cities(id),
  category VARCHAR(50) NOT NULL,
  photo TEXT,
  clothing_size VARCHAR(10),
  shoe_size VARCHAR(10),
  measurements VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id),
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(40) NOT NULL,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  client VARCHAR(180) NOT NULL,
  client_id BIGINT REFERENCES clients(id),
  client_user_id BIGINT REFERENCES users(id),
  image TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
  reports JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  executive_report JSONB,
  created_by_user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS manual_inactivated_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS manual_inactivation_comment TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS manual_inactivated_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_user_id BIGINT REFERENCES users(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS executive_report JSONB;

CREATE TABLE IF NOT EXISTS event_cities (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  city_id BIGINT REFERENCES cities(id),
  city_name VARCHAR(120) NOT NULL,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_nit_unique ON clients (LOWER(nit)) WHERE nit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_razon_social_lower ON clients (LOWER(razon_social));
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients (user_id);
CREATE INDEX IF NOT EXISTS idx_cities_name_lower ON cities (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_coordinators_city_id ON coordinators (city_id);
CREATE INDEX IF NOT EXISTS idx_staff_city_id ON staff (city_id);
CREATE INDEX IF NOT EXISTS idx_staff_category ON staff (category);
CREATE INDEX IF NOT EXISTS idx_event_cities_event_id ON event_cities (event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);
