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
  expo_push_token TEXT,
  password_hash TEXT NOT NULL,
  role_id BIGINT NOT NULL REFERENCES roles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS cities (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_other BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS executives (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
  full_name VARCHAR(160) NOT NULL,
  cedula VARCHAR(30) NOT NULL UNIQUE,
  address VARCHAR(255),
  phone VARCHAR(40),
  whatsapp_phone VARCHAR(40),
  email VARCHAR(160),
  city_id BIGINT REFERENCES cities(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE executives ADD COLUMN IF NOT EXISTS address VARCHAR(255);
ALTER TABLE executives ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE executives ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(40);
ALTER TABLE executives ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE executives ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES cities(id);
ALTER TABLE executives ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE executives ADD COLUMN IF NOT EXISTS cedula VARCHAR(30);

UPDATE executives
SET cedula = CONCAT('AUTOE', LPAD(COALESCE(NULLIF(user_id, 0), id)::text, 10, '0'))
WHERE cedula IS NULL OR TRIM(cedula) = '';

INSERT INTO executives (user_id, full_name, cedula, address, phone, whatsapp_phone, email, city_id, is_active)
SELECT u.id, u.full_name, CONCAT('AUTOE', LPAD(u.id::text, 10, '0')), NULL, u.phone, u.whatsapp_phone, u.email, NULL, u.is_active
FROM users u
INNER JOIN roles r ON r.id = u.role_id
LEFT JOIN executives e ON e.user_id = u.id
WHERE r.code = 'EJECUTIVO'
  AND e.user_id IS NULL;

CREATE TABLE IF NOT EXISTS coordinators (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  full_name VARCHAR(160) NOT NULL,
  cedula VARCHAR(30) NOT NULL UNIQUE,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  rating SMALLINT NOT NULL DEFAULT 0,
  photo TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  city_id BIGINT NOT NULL REFERENCES cities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coordinators ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

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
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sex VARCHAR(10),
  shirt_size VARCHAR(10),
  pants_size VARCHAR(10),
  clothing_size VARCHAR(10),
  shoe_size VARCHAR(10),
  measurements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS sex VARCHAR(10);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shirt_size VARCHAR(10);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pants_size VARCHAR(10);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS clothing_size VARCHAR(10);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shoe_size VARCHAR(10);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS height VARCHAR(10);
ALTER TABLE staff ALTER COLUMN measurements TYPE TEXT;

UPDATE staff
SET shirt_size = COALESCE(NULLIF(TRIM(shirt_size), ''), NULLIF(TRIM(clothing_size), '')),
    pants_size = COALESCE(NULLIF(TRIM(pants_size), ''), NULLIF(TRIM(clothing_size), '')),
    clothing_size = COALESCE(NULLIF(TRIM(clothing_size), ''), NULLIF(TRIM(shirt_size), ''), NULLIF(TRIM(pants_size), ''))
WHERE shirt_size IS NULL OR pants_size IS NULL OR clothing_size IS NULL
   OR TRIM(COALESCE(shirt_size, '')) = '' OR TRIM(COALESCE(pants_size, '')) = '' OR TRIM(COALESCE(clothing_size, '')) = '';

CREATE TABLE IF NOT EXISTS staff_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
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
  event_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
  start_real_at TIMESTAMPTZ,
  end_real_at TIMESTAMPTZ,
  start_lat NUMERIC,
  start_lon NUMERIC,
  end_lat NUMERIC,
  end_lon NUMERIC,
  start_photo_url TEXT,
  end_photo_url TEXT,
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
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_status VARCHAR(30) NOT NULL DEFAULT 'not_started';
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_real_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_real_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_lat NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_lon NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_lat NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_lon NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_photo_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_photo_url TEXT;
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
CREATE INDEX IF NOT EXISTS idx_executives_user_id ON executives (user_id);
CREATE INDEX IF NOT EXISTS idx_executives_full_name_lower ON executives (LOWER(full_name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_executives_cedula_unique ON executives (LOWER(cedula));
CREATE INDEX IF NOT EXISTS idx_executives_city_id ON executives (city_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_nit_unique ON clients (LOWER(nit)) WHERE nit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_razon_social_lower ON clients (LOWER(razon_social));
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients (user_id);
CREATE INDEX IF NOT EXISTS idx_cities_name_lower ON cities (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_coordinators_city_id ON coordinators (city_id);
CREATE INDEX IF NOT EXISTS idx_staff_city_id ON staff (city_id);
CREATE INDEX IF NOT EXISTS idx_staff_category ON staff (category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_categories_name_lower ON staff_categories (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_categories_code_lower ON staff_categories (LOWER(code));
CREATE INDEX IF NOT EXISTS idx_event_cities_event_id ON event_cities (event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);
