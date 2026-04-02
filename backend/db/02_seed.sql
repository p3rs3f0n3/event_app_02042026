-- Usuarios demo para entorno local. Cambialos después de correr el seed:
-- admin / ChangeMe.Admin.123
-- ejecutivo / ChangeMe.Ejecutivo.123
-- coord / ChangeMe.Coordinador.123
-- cliente / ChangeMe.Cliente.123

INSERT INTO roles (code, description)
VALUES
  ('ADMIN', 'Acceso total al sistema'),
  ('EJECUTIVO', 'Gestiona eventos y operación comercial'),
  ('COORDINADOR', 'Coordina ejecución local'),
  ('CLIENTE', 'Consulta y seguimiento de eventos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (username, full_name, password_hash, role_id)
VALUES
  ('admin', 'Administrador Base', 'be3a44cd003de13e43dd527ec9eda5d0:dd245a15f49405c515620bba8143134804291a96442638cce0c691d39f4c08671df8e923fcdc1297d6877b379c8b59e8a067f5c998f335e18090751cb26fbf0b', (SELECT id FROM roles WHERE code = 'ADMIN')),
  ('ejecutivo', 'Ejecutivo Base', 'fd1e8a11641b7aa010fa477a7f87814b:38a2864ec0671eaf838feb04e9d8dbc8dfe3d231eed41d705d7400ad90b57ea9e23981cafb251483b29a9c7d26dfede24f7517336b6ed88968db8b573ba26cd9', (SELECT id FROM roles WHERE code = 'EJECUTIVO')),
  ('coord', 'Coordinador Base', '34479858665eb31c843b9ed34cecc141:5fb5f805a24f2a2145a7e6742454f1b9924b1fafb9782fdc9c4ba7cf6418b094b22d78616a5d596a9e042a495f741fb94ebc7df9ad15dc4cc9b0a74e7de2cd6b', (SELECT id FROM roles WHERE code = 'COORDINADOR')),
  ('cliente', 'Cliente Base', '6caf2fdb577cf2d695a85b3b1fc9b1e9:acbc7a43f6fc7a20562c92bf16e7a30230baef0848c771c740286eaf9303e03461e117d0250ec3d3cf5c4f71b1ecd5f1160be73a851509e6d2a5335fc8f8c421', (SELECT id FROM roles WHERE code = 'CLIENTE'))
ON CONFLICT (username) DO NOTHING;

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

INSERT INTO coordinators (full_name, cedula, address, phone, rating, photo, city_id)
VALUES
  ('Isabella Barreiro J.', '31572804', 'Cra 28 No 72', '3116833760', 5, 'https://i.pravatar.cc/150?u=isabella', (SELECT id FROM cities WHERE name = 'Bogotá')),
  ('Alexander Barreiro H.', '12345678', 'Calle 10 No 5', '3001234567', 4, 'https://i.pravatar.cc/150?u=alex', (SELECT id FROM cities WHERE name = 'Bogotá')),
  ('Lucia Mendez', '44556677', 'Av 5 No 12', '3109998877', 5, 'https://i.pravatar.cc/150?u=lucia', (SELECT id FROM cities WHERE name = 'Medellín')),
  ('Roberto Gomez', '77889900', 'Clle 100', '3151112233', 4, 'https://i.pravatar.cc/150?u=robert', (SELECT id FROM cities WHERE name = 'Medellín'))
ON CONFLICT (cedula) DO NOTHING;

INSERT INTO staff (full_name, cedula, city_id, category, photo, clothing_size, shoe_size, measurements)
VALUES
  ('Juan Perez', '10101010', (SELECT id FROM cities WHERE name = 'Bogotá'), 'BARISTAS', 'https://i.pravatar.cc/150?u=juan', 'S', '38', '90-70-90'),
  ('Maria Lopez', '20202020', (SELECT id FROM cities WHERE name = 'Bogotá'), 'IMPULSADORES', 'https://i.pravatar.cc/150?u=maria', 'M', '36', '85-60-85'),
  ('Carlos Ruiz', '30303030', (SELECT id FROM cities WHERE name = 'Bogotá'), 'LOGISTICOS', 'https://i.pravatar.cc/150?u=carlos', 'X', '42', 'N/A'),
  ('Diana Torres', '60606060', (SELECT id FROM cities WHERE name = 'Medellín'), 'BARISTAS', 'https://i.pravatar.cc/150?u=diana', 'XS', '35', '80-55-80'),
  ('Pedro Solo', '70707070', (SELECT id FROM cities WHERE name = 'Medellín'), 'IMPULSADORES', 'https://i.pravatar.cc/150?u=pedro', 'L', '41', 'N/A'),
  ('Elena Nito', '80808080', (SELECT id FROM cities WHERE name = 'Medellín'), 'LOGISTICOS', 'https://i.pravatar.cc/150?u=elena', 'S', '37', '88-62-88')
ON CONFLICT (cedula) DO NOTHING;
