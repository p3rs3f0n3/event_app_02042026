-- Usuarios base para pruebas funcionales:
-- admin / 123
-- ejecutivo.ana / 123
-- ejecutivo.bruno / 123
-- coord / 123
-- cliente, cliente.alpina, cliente.colcafe, cliente.nutresa / 123

TRUNCATE TABLE audit_logs, event_cities, events, clients RESTART IDENTITY CASCADE;

INSERT INTO roles (code, description)
VALUES
  ('ADMIN', 'Acceso total al sistema'),
  ('EJECUTIVO', 'Gestiona eventos y operación comercial'),
  ('COORDINADOR', 'Coordina ejecución local'),
  ('CLIENTE', 'Consulta y seguimiento de eventos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (username, full_name, phone, whatsapp_phone, email, password_hash, role_id)
VALUES
  ('admin', 'Administrador Base', '3005550101', '3005550101', 'admin@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'ADMIN')),
  ('ejecutivo.ana', 'Ana Torres', '3005550202', '3005550202', 'ana.torres@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'EJECUTIVO')),
  ('ejecutivo.bruno', 'Bruno Diaz', '3005550203', '3005550203', 'bruno.diaz@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'EJECUTIVO')),
  ('coord', 'Lucia Mendez', '3005550303', '3005550303', 'lucia.mendez@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'COORDINADOR')),
  ('cliente', 'Laura Gómez', '3005550404', '3005550404', 'cliente.base@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'CLIENTE')),
  ('cliente.alpina', 'Mariana Vélez', '3005550405', '3005550405', 'alpina.qa@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'CLIENTE')),
  ('cliente.colcafe', 'Santiago Ruiz', '3005550406', '3005550406', 'colcafe.qa@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'CLIENTE')),
  ('cliente.nutresa', 'Valentina Pérez', '3005550407', '3005550407', 'nutresa.qa@eventapp.local', 'fe519609843f3fdfe71bb95f5f4fc453:74113be106ac017037c0795f8d027776f2554662d93b1f6d8105ecfe0387d0e5c990cd364824f7ccf44a62b6d46956ff0897c87a258d040b8b477e509bf28f84', (SELECT id FROM roles WHERE code = 'CLIENTE'))
ON CONFLICT (username) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  whatsapp_phone = EXCLUDED.whatsapp_phone,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role_id = EXCLUDED.role_id,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO clients (user_id, razon_social, nit, contact_full_name, contact_role, phone, whatsapp_phone, email, is_active)
VALUES
  ((SELECT id FROM users WHERE username = 'cliente'), 'Cliente Base QA SAS', '900100001-1', 'Laura Gómez', 'Brand Manager', '3005550404', '3005550404', 'cliente.base@eventapp.local', TRUE),
  ((SELECT id FROM users WHERE username = 'cliente.alpina'), 'Alpina QA SAS', '900100002-2', 'Mariana Vélez', 'Trade Marketing Lead', '3005550405', '3005550405', 'alpina.qa@eventapp.local', TRUE),
  ((SELECT id FROM users WHERE username = 'cliente.colcafe'), 'Colcafé QA SAS', '900100003-3', 'Santiago Ruiz', 'Coordinador de Marca', '3005550406', '3005550406', 'colcafe.qa@eventapp.local', TRUE),
  ((SELECT id FROM users WHERE username = 'cliente.nutresa'), 'Nutresa QA SAS', '900100004-4', 'Valentina Pérez', 'Jefe de Cuenta', '3005550407', '3005550407', 'nutresa.qa@eventapp.local', TRUE)
ON CONFLICT (user_id) DO UPDATE SET
  razon_social = EXCLUDED.razon_social,
  nit = EXCLUDED.nit,
  contact_full_name = EXCLUDED.contact_full_name,
  contact_role = EXCLUDED.contact_role,
  phone = EXCLUDED.phone,
  whatsapp_phone = EXCLUDED.whatsapp_phone,
  email = EXCLUDED.email,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO cities (id, name, is_other)
VALUES
  (1, 'Arauca', FALSE),
  (2, 'Armenia', FALSE),
  (3, 'Barranquilla', FALSE),
  (4, 'Bogotá', FALSE),
  (5, 'Bucaramanga', FALSE),
  (6, 'Cali', FALSE),
  (7, 'Cartagena', FALSE),
  (8, 'Cúcuta', FALSE),
  (9, 'Florencia', FALSE),
  (10, 'Ibagué', FALSE),
  (11, 'Inírida', FALSE),
  (12, 'Leticia', FALSE),
  (13, 'Manizales', FALSE),
  (14, 'Medellín', FALSE),
  (15, 'Mitú', FALSE),
  (16, 'Mocoa', FALSE),
  (17, 'Montería', FALSE),
  (18, 'Neiva', FALSE),
  (19, 'Pasto', FALSE),
  (20, 'Pereira', FALSE),
  (21, 'Popayán', FALSE),
  (22, 'Puerto Carreño', FALSE),
  (23, 'Quibdó', FALSE),
  (24, 'Riohacha', FALSE),
  (25, 'San Andrés', FALSE),
  (26, 'San José del Guaviare', FALSE),
  (27, 'Santa Marta', FALSE),
  (28, 'Sincelejo', FALSE),
  (29, 'Tunja', FALSE),
  (30, 'Valledupar', FALSE),
  (31, 'Villavicencio', FALSE),
  (32, 'Yopal', FALSE),
  (33, 'OTRO', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval('cities_id_seq', (SELECT MAX(id) FROM cities));

INSERT INTO coordinators (user_id, full_name, cedula, address, phone, rating, photo, city_id)
VALUES
  (NULL, 'Isabella Barreiro J.', '31572804', 'Cra 28 No 72', '3116833760', 5, 'https://i.pravatar.cc/150?u=isabella', (SELECT id FROM cities WHERE name = 'Bogotá')),
  (NULL, 'Alexander Barreiro H.', '12345678', 'Calle 10 No 5', '3001234567', 4, 'https://i.pravatar.cc/150?u=alex', (SELECT id FROM cities WHERE name = 'Bogotá')),
  ((SELECT id FROM users WHERE username = 'coord'), 'Lucia Mendez', '44556677', 'Av 5 No 12', '3109998877', 5, 'https://i.pravatar.cc/150?u=lucia', (SELECT id FROM cities WHERE name = 'Medellín')),
  (NULL, 'Roberto Gomez', '77889900', 'Clle 100', '3151112233', 4, 'https://i.pravatar.cc/150?u=robert', (SELECT id FROM cities WHERE name = 'Medellín'))
ON CONFLICT (cedula) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  full_name = EXCLUDED.full_name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  rating = EXCLUDED.rating,
  photo = EXCLUDED.photo,
  city_id = EXCLUDED.city_id,
  updated_at = NOW();

INSERT INTO staff (full_name, cedula, city_id, category, photo, shirt_size, pants_size, clothing_size, shoe_size, measurements)
VALUES
  ('Juan Perez', '10101010', (SELECT id FROM cities WHERE name = 'Bogotá'), 'BARISTAS', 'https://i.pravatar.cc/150?u=juan', 'S', 'S', 'S', '38', '90-70-90'),
  ('Maria Lopez', '20202020', (SELECT id FROM cities WHERE name = 'Bogotá'), 'IMPULSADORES', 'https://i.pravatar.cc/150?u=maria', 'M', 'M', 'M', '36', '85-60-85'),
  ('Carlos Ruiz', '30303030', (SELECT id FROM cities WHERE name = 'Bogotá'), 'LOGISTICOS', 'https://i.pravatar.cc/150?u=carlos', 'X', 'X', 'X', '42', 'N/A'),
  ('Diana Torres', '60606060', (SELECT id FROM cities WHERE name = 'Medellín'), 'BARISTAS', 'https://i.pravatar.cc/150?u=diana', 'XS', 'XS', 'XS', '35', '80-55-80'),
  ('Pedro Solo', '70707070', (SELECT id FROM cities WHERE name = 'Medellín'), 'IMPULSADORES', 'https://i.pravatar.cc/150?u=pedro', 'L', 'L', 'L', '41', 'N/A'),
  ('Elena Nito', '80808080', (SELECT id FROM cities WHERE name = 'Medellín'), 'LOGISTICOS', 'https://i.pravatar.cc/150?u=elena', 'S', 'S', 'S', '37', '88-62-88')
ON CONFLICT (cedula) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  city_id = EXCLUDED.city_id,
  category = EXCLUDED.category,
  photo = EXCLUDED.photo,
  shirt_size = EXCLUDED.shirt_size,
  pants_size = EXCLUDED.pants_size,
  clothing_size = EXCLUDED.clothing_size,
  shoe_size = EXCLUDED.shoe_size,
  measurements = EXCLUDED.measurements,
  updated_at = NOW();

INSERT INTO staff_categories (name, code, is_active)
VALUES
  ('ANFITRIONES', 'ANFITRIONES', TRUE),
  ('BARISTAS', 'BARISTAS', TRUE),
  ('DEGUSTADORES', 'DEGUSTADORES', TRUE),
  ('DEMOSTRADORAS', 'DEMOSTRADORAS', TRUE),
  ('IMPULSADORES', 'IMPULSADORES', TRUE),
  ('LOGISTICOS', 'LOGISTICOS', TRUE),
  ('MERCADERISTAS', 'MERCADERISTAS', TRUE),
  ('MODELOS', 'MODELOS', TRUE),
  ('PROTOCOLO', 'PROTOCOLO', TRUE),
  ('SUPERVISORES', 'SUPERVISORES', TRUE)
ON CONFLICT DO NOTHING;
