const INITIAL_DB = {
  staffCategories: [
    { id: 1, name: 'ANFITRIONES', code: 'ANFITRIONES' },
    { id: 2, name: 'BARISTAS', code: 'BARISTAS' },
    { id: 3, name: 'DEGUSTADORES', code: 'DEGUSTADORES' },
    { id: 4, name: 'DEMOSTRADORAS', code: 'DEMOSTRADORAS' },
    { id: 5, name: 'IMPULSADORES', code: 'IMPULSADORES' },
    { id: 6, name: 'LOGISTICOS', code: 'LOGISTICOS' },
    { id: 7, name: 'MERCADERISTAS', code: 'MERCADERISTAS' },
    { id: 8, name: 'MODELOS', code: 'MODELOS' },
    { id: 9, name: 'PROTOCOLO', code: 'PROTOCOLO' },
    { id: 10, name: 'SUPERVISORES', code: 'SUPERVISORES' },
  ],
  users: [
    { id: 1, username: 'admin', password: 'Admin.EventApp.2026', fullName: 'Administrador Base', phone: '3005550101', whatsappPhone: '3005550101', email: 'admin@eventapp.local', role: 'ADMIN' },
    { id: 2, username: 'ejecutivo.ana', password: 'Funcional.EventApp.2026', fullName: 'Ana Torres', phone: '3005550202', whatsappPhone: '3005550202', email: 'ana.torres@eventapp.local', role: 'EJECUTIVO' },
    { id: 3, username: 'ejecutivo.bruno', password: 'Funcional.EventApp.2026', fullName: 'Bruno Diaz', phone: '3005550203', whatsappPhone: '3005550203', email: 'bruno.diaz@eventapp.local', role: 'EJECUTIVO' },
    { id: 4, username: 'coord', password: 'Funcional.EventApp.2026', fullName: 'Lucia Mendez', phone: '3005550303', whatsappPhone: '3005550303', email: 'lucia.mendez@eventapp.local', role: 'COORDINADOR' },
    { id: 5, username: 'cliente', password: 'Funcional.EventApp.2026', fullName: 'Laura Gómez', phone: '3005550404', whatsappPhone: '3005550404', email: 'cliente.base@eventapp.local', role: 'CLIENTE' },
    { id: 6, username: 'cliente.alpina', password: 'Funcional.EventApp.2026', fullName: 'Mariana Vélez', phone: '3005550405', whatsappPhone: '3005550405', email: 'alpina.qa@eventapp.local', role: 'CLIENTE' },
    { id: 7, username: 'cliente.colcafe', password: 'Funcional.EventApp.2026', fullName: 'Santiago Ruiz', phone: '3005550406', whatsappPhone: '3005550406', email: 'colcafe.qa@eventapp.local', role: 'CLIENTE' },
    { id: 8, username: 'cliente.nutresa', password: 'Funcional.EventApp.2026', fullName: 'Valentina Pérez', phone: '3005550407', whatsappPhone: '3005550407', email: 'nutresa.qa@eventapp.local', role: 'CLIENTE' },
  ],
  executives: [
    { id: 1, userId: 2, cedula: '1010101010', fullName: 'Ana Torres', address: 'Cra 11 No 93-21', phone: '3005550202', whatsappPhone: '3005550202', email: 'ana.torres@eventapp.local', city: 'Bogotá', isActive: true },
    { id: 2, userId: 3, cedula: '2020202020', fullName: 'Bruno Diaz', address: 'Calle 7 No 45-18', phone: '3005550203', whatsappPhone: '3005550203', email: 'bruno.diaz@eventapp.local', city: 'Medellín', isActive: true },
  ],
  clients: [
    { id: 1, userId: 5, razonSocial: 'Cliente Base QA SAS', nit: '900100001-1', contactFullName: 'Laura Gómez', contactRole: 'Brand Manager', phone: '3005550404', whatsappPhone: '3005550404', email: 'cliente.base@eventapp.local', isActive: true },
    { id: 2, userId: 6, razonSocial: 'Alpina QA SAS', nit: '900100002-2', contactFullName: 'Mariana Vélez', contactRole: 'Trade Marketing Lead', phone: '3005550405', whatsappPhone: '3005550405', email: 'alpina.qa@eventapp.local', isActive: true },
    { id: 3, userId: 7, razonSocial: 'Colcafé QA SAS', nit: '900100003-3', contactFullName: 'Santiago Ruiz', contactRole: 'Coordinador de Marca', phone: '3005550406', whatsappPhone: '3005550406', email: 'colcafe.qa@eventapp.local', isActive: true },
    { id: 4, userId: 8, razonSocial: 'Nutresa QA SAS', nit: '900100004-4', contactFullName: 'Valentina Pérez', contactRole: 'Jefe de Cuenta', phone: '3005550407', whatsappPhone: '3005550407', email: 'nutresa.qa@eventapp.local', isActive: true },
  ],
  coordinators: [
    { id: 1, name: 'Isabella Barreiro J.', cedula: '31572804', address: 'Cra 28 No 72', phone: '3116833760', rating: 5, photo: 'https://i.pravatar.cc/150?u=isabella', city: 'Bogotá' },
    { id: 2, name: 'Alexander Barreiro H.', cedula: '12345678', address: 'Calle 10 No 5', phone: '3001234567', rating: 4, photo: 'https://i.pravatar.cc/150?u=alex', city: 'Bogotá' },
    { id: 3, userId: 4, name: 'Lucia Mendez', cedula: '44556677', address: 'Av 5 No 12', phone: '3109998877', rating: 5, photo: 'https://i.pravatar.cc/150?u=lucia', city: 'Medellín' },
    { id: 4, name: 'Roberto Gomez', cedula: '77889900', address: 'Clle 100', phone: '3151112233', rating: 4, photo: 'https://i.pravatar.cc/150?u=robert', city: 'Medellín' },
  ],
  staff: [
    { id: 101, name: 'Juan Perez', cedula: '10101010', city: 'Bogotá', category: 'BARISTAS', sexo: 'hombre', photo: 'https://i.pravatar.cc/150?u=juan', shirtSize: 'S', pantsSize: 'S', clothingSize: 'S', shoeSize: '38', measurements: null },
    { id: 102, name: 'Maria Lopez', cedula: '20202020', city: 'Bogotá', category: 'IMPULSADORES', sexo: 'mujer', photo: 'https://i.pravatar.cc/150?u=maria', shirtSize: 'M', pantsSize: 'M', clothingSize: 'M', shoeSize: '36', measurements: '{"version":2,"busto":"85","cintura":"60","cadera":"85"}' },
    { id: 103, name: 'Carlos Ruiz', cedula: '30303030', city: 'Bogotá', category: 'LOGISTICOS', sexo: 'hombre', photo: 'https://i.pravatar.cc/150?u=carlos', shirtSize: 'X', pantsSize: 'X', clothingSize: 'X', shoeSize: '42', measurements: null },
    { id: 106, name: 'Diana Torres', cedula: '60606060', city: 'Medellín', category: 'BARISTAS', sexo: 'mujer', photo: 'https://i.pravatar.cc/150?u=diana', shirtSize: 'XS', pantsSize: 'XS', clothingSize: 'XS', shoeSize: '35', measurements: '{"version":2,"busto":"80","cintura":"55","cadera":"80"}' },
    { id: 107, name: 'Pedro Solo', cedula: '70707070', city: 'Medellín', category: 'IMPULSADORES', sexo: 'hombre', photo: 'https://i.pravatar.cc/150?u=pedro', shirtSize: 'L', pantsSize: 'L', clothingSize: 'L', shoeSize: '41', measurements: null },
    { id: 108, name: 'Elena Nito', cedula: '80808080', city: 'Medellín', category: 'LOGISTICOS', sexo: 'mujer', photo: 'https://i.pravatar.cc/150?u=elena', shirtSize: 'S', pantsSize: 'S', clothingSize: 'S', shoeSize: '37', measurements: '{"version":2,"busto":"88","cintura":"62","cadera":"88"}' },
  ],
  cities: [
    { id: 1, name: 'Arauca', isOther: false }, { id: 2, name: 'Armenia', isOther: false }, { id: 3, name: 'Barranquilla', isOther: false },
    { id: 4, name: 'Bogotá', isOther: false }, { id: 5, name: 'Bucaramanga', isOther: false }, { id: 6, name: 'Cali', isOther: false },
    { id: 7, name: 'Cartagena', isOther: false }, { id: 8, name: 'Cúcuta', isOther: false }, { id: 9, name: 'Florencia', isOther: false },
    { id: 10, name: 'Ibagué', isOther: false }, { id: 11, name: 'Inírida', isOther: false }, { id: 12, name: 'Leticia', isOther: false },
    { id: 13, name: 'Manizales', isOther: false }, { id: 14, name: 'Medellín', isOther: false }, { id: 15, name: 'Mitú', isOther: false },
    { id: 16, name: 'Mocoa', isOther: false }, { id: 17, name: 'Montería', isOther: false }, { id: 18, name: 'Neiva', isOther: false },
    { id: 19, name: 'Pasto', isOther: false }, { id: 20, name: 'Pereira', isOther: false }, { id: 21, name: 'Popayán', isOther: false },
    { id: 22, name: 'Puerto Carreño', isOther: false }, { id: 23, name: 'Quibdó', isOther: false }, { id: 24, name: 'Riohacha', isOther: false },
    { id: 25, name: 'San Andrés', isOther: false }, { id: 26, name: 'San José del Guaviare', isOther: false }, { id: 27, name: 'Santa Marta', isOther: false },
    { id: 28, name: 'Sincelejo', isOther: false }, { id: 29, name: 'Tunja', isOther: false }, { id: 30, name: 'Valledupar', isOther: false },
    { id: 31, name: 'Villavicencio', isOther: false }, { id: 32, name: 'Yopal', isOther: false }, { id: 33, name: 'OTRO', isOther: true }
  ],
  auditLogs: [],
  events: []
};

module.exports = { INITIAL_DB };
