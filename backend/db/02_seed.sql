-- Usuarios base para pruebas funcionales:
-- admin / Admin.EventApp.2026
-- ejecutivo.ana / Funcional.EventApp.2026
-- ejecutivo.bruno / Funcional.EventApp.2026
-- coord / Funcional.EventApp.2026
-- cliente, cliente.alpina, cliente.colcafe, cliente.nutresa / Funcional.EventApp.2026

TRUNCATE TABLE event_cities, events RESTART IDENTITY CASCADE;

INSERT INTO roles (code, description)
VALUES
  ('ADMIN', 'Acceso total al sistema'),
  ('EJECUTIVO', 'Gestiona eventos y operación comercial'),
  ('COORDINADOR', 'Coordina ejecución local'),
  ('CLIENTE', 'Consulta y seguimiento de eventos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (username, full_name, phone, whatsapp_phone, email, password_hash, role_id)
VALUES
  ('admin', 'Administrador Base', '3005550101', '3005550101', 'admin@eventapp.local', 'c34c4006901ce07458681f7fe14c4ea3:6c040633789a8fe1c01e3035aaa16c79d31ea8ecf1d89139b9984303d27a2a5722f51d62c90ccc5d940b65e5e51bff9565cb6e91f5a532f17b5f91d2eaa6ce76', (SELECT id FROM roles WHERE code = 'ADMIN')),
  ('ejecutivo.ana', 'Ana Torres', '3005550202', '3005550202', 'ana.torres@eventapp.local', 'e02469dc87840ce2afc5a478ac8588ca:5ad8c10ab98ed9e458c91a84a411eeb1c803f13b0434e14e6229ea04f33ecbc9467a172ecece29a415370cfec8bdfacca6e05df13c523d5b54a19a75fe00f22c', (SELECT id FROM roles WHERE code = 'EJECUTIVO')),
  ('ejecutivo.bruno', 'Bruno Diaz', '3005550203', '3005550203', 'bruno.diaz@eventapp.local', 'e02469dc87840ce2afc5a478ac8588ca:5ad8c10ab98ed9e458c91a84a411eeb1c803f13b0434e14e6229ea04f33ecbc9467a172ecece29a415370cfec8bdfacca6e05df13c523d5b54a19a75fe00f22c', (SELECT id FROM roles WHERE code = 'EJECUTIVO')),
  ('coord', 'Lucia Mendez', '3005550303', '3005550303', 'lucia.mendez@eventapp.local', 'e02469dc87840ce2afc5a478ac8588ca:5ad8c10ab98ed9e458c91a84a411eeb1c803f13b0434e14e6229ea04f33ecbc9467a172ecece29a415370cfec8bdfacca6e05df13c523d5b54a19a75fe00f22c', (SELECT id FROM roles WHERE code = 'COORDINADOR')),
  ('cliente', 'Cliente Base QA', '3005550404', '3005550404', 'cliente.base@eventapp.local', 'e02469dc87840ce2afc5a478ac8588ca:5ad8c10ab98ed9e458c91a84a411eeb1c803f13b0434e14e6229ea04f33ecbc9467a172ecece29a415370cfec8bdfacca6e05df13c523d5b54a19a75fe00f22c', (SELECT id FROM roles WHERE code = 'CLIENTE')),
  ('cliente.alpina', 'Alpina QA', '3005550405', '3005550405', 'alpina.qa@eventapp.local', 'e02469dc87840ce2afc5a478ac8588ca:5ad8c10ab98ed9e458c91a84a411eeb1c803f13b0434e14e6229ea04f33ecbc9467a172ecece29a415370cfec8bdfacca6e05df13c523d5b54a19a75fe00f22c', (SELECT id FROM roles WHERE code = 'CLIENTE')),
  ('cliente.colcafe', 'Colcafe QA', '3005550406', '3005550406', 'colcafe.qa@eventapp.local', 'e02469dc87840ce2afc5a478ac8588ca:5ad8c10ab98ed9e458c91a84a411eeb1c803f13b0434e14e6229ea04f33ecbc9467a172ecece29a415370cfec8bdfacca6e05df13c523d5b54a19a75fe00f22c', (SELECT id FROM roles WHERE code = 'CLIENTE')),
  ('cliente.nutresa', 'Nutresa QA', '3005550407', '3005550407', 'nutresa.qa@eventapp.local', 'e02469dc87840ce2afc5a478ac8588ca:5ad8c10ab98ed9e458c91a84a411eeb1c803f13b0434e14e6229ea04f33ecbc9467a172ecece29a415370cfec8bdfacca6e05df13c523d5b54a19a75fe00f22c', (SELECT id FROM roles WHERE code = 'CLIENTE'))
ON CONFLICT (username) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  whatsapp_phone = EXCLUDED.whatsapp_phone,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role_id = EXCLUDED.role_id,
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

INSERT INTO staff (full_name, cedula, city_id, category, photo, clothing_size, shoe_size, measurements)
VALUES
  ('Juan Perez', '10101010', (SELECT id FROM cities WHERE name = 'Bogotá'), 'BARISTAS', 'https://i.pravatar.cc/150?u=juan', 'S', '38', '90-70-90'),
  ('Maria Lopez', '20202020', (SELECT id FROM cities WHERE name = 'Bogotá'), 'IMPULSADORES', 'https://i.pravatar.cc/150?u=maria', 'M', '36', '85-60-85'),
  ('Carlos Ruiz', '30303030', (SELECT id FROM cities WHERE name = 'Bogotá'), 'LOGISTICOS', 'https://i.pravatar.cc/150?u=carlos', 'X', '42', 'N/A'),
  ('Diana Torres', '60606060', (SELECT id FROM cities WHERE name = 'Medellín'), 'BARISTAS', 'https://i.pravatar.cc/150?u=diana', 'XS', '35', '80-55-80'),
  ('Pedro Solo', '70707070', (SELECT id FROM cities WHERE name = 'Medellín'), 'IMPULSADORES', 'https://i.pravatar.cc/150?u=pedro', 'L', '41', 'N/A'),
  ('Elena Nito', '80808080', (SELECT id FROM cities WHERE name = 'Medellín'), 'LOGISTICOS', 'https://i.pravatar.cc/150?u=elena', 'S', '37', '88-62-88')
ON CONFLICT (cedula) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  city_id = EXCLUDED.city_id,
  category = EXCLUDED.category,
  photo = EXCLUDED.photo,
  clothing_size = EXCLUDED.clothing_size,
  shoe_size = EXCLUDED.shoe_size,
  measurements = EXCLUDED.measurements,
  updated_at = NOW();
