const INITIAL_DB = {
  users: [
    { id: 1, username: 'admin', password: 'Admin.EventApp.2026', fullName: 'Administrador Base', phone: '3005550101', whatsappPhone: '3005550101', email: 'admin@eventapp.local', role: 'ADMIN' },
    { id: 2, username: 'ejecutivo.ana', password: 'Funcional.EventApp.2026', fullName: 'Ana Torres', phone: '3005550202', whatsappPhone: '3005550202', email: 'ana.torres@eventapp.local', role: 'EJECUTIVO' },
    { id: 3, username: 'ejecutivo.bruno', password: 'Funcional.EventApp.2026', fullName: 'Bruno Diaz', phone: '3005550203', whatsappPhone: '3005550203', email: 'bruno.diaz@eventapp.local', role: 'EJECUTIVO' },
    { id: 4, username: 'coord', password: 'Funcional.EventApp.2026', fullName: 'Lucia Mendez', phone: '3005550303', whatsappPhone: '3005550303', email: 'lucia.mendez@eventapp.local', role: 'COORDINADOR' },
    { id: 5, username: 'cliente', password: 'Funcional.EventApp.2026', fullName: 'Cliente Base QA', phone: '3005550404', whatsappPhone: '3005550404', email: 'cliente.base@eventapp.local', role: 'CLIENTE' },
    { id: 6, username: 'cliente.alpina', password: 'Funcional.EventApp.2026', fullName: 'Alpina QA', phone: '3005550405', whatsappPhone: '3005550405', email: 'alpina.qa@eventapp.local', role: 'CLIENTE' },
    { id: 7, username: 'cliente.colcafe', password: 'Funcional.EventApp.2026', fullName: 'Colcafe QA', phone: '3005550406', whatsappPhone: '3005550406', email: 'colcafe.qa@eventapp.local', role: 'CLIENTE' },
    { id: 8, username: 'cliente.nutresa', password: 'Funcional.EventApp.2026', fullName: 'Nutresa QA', phone: '3005550407', whatsappPhone: '3005550407', email: 'nutresa.qa@eventapp.local', role: 'CLIENTE' },
  ],
  coordinators: [
    { id: 1, name: 'Isabella Barreiro J.', cedula: '31572804', address: 'Cra 28 No 72', phone: '3116833760', rating: 5, photo: 'https://i.pravatar.cc/150?u=isabella', city: 'Bogotá' },
    { id: 2, name: 'Alexander Barreiro H.', cedula: '12345678', address: 'Calle 10 No 5', phone: '3001234567', rating: 4, photo: 'https://i.pravatar.cc/150?u=alex', city: 'Bogotá' },
    { id: 3, userId: 4, name: 'Lucia Mendez', cedula: '44556677', address: 'Av 5 No 12', phone: '3109998877', rating: 5, photo: 'https://i.pravatar.cc/150?u=lucia', city: 'Medellín' },
    { id: 4, name: 'Roberto Gomez', cedula: '77889900', address: 'Clle 100', phone: '3151112233', rating: 4, photo: 'https://i.pravatar.cc/150?u=robert', city: 'Medellín' },
  ],
  staff: [
    { id: 101, name: 'Juan Perez', cedula: '10101010', city: 'Bogotá', category: 'BARISTAS', photo: 'https://i.pravatar.cc/150?u=juan', clothingSize: 'S', shoeSize: '38', measurements: '90-70-90' },
    { id: 102, name: 'Maria Lopez', cedula: '20202020', city: 'Bogotá', category: 'IMPULSADORES', photo: 'https://i.pravatar.cc/150?u=maria', clothingSize: 'M', shoeSize: '36', measurements: '85-60-85' },
    { id: 103, name: 'Carlos Ruiz', cedula: '30303030', city: 'Bogotá', category: 'LOGISTICOS', photo: 'https://i.pravatar.cc/150?u=carlos', clothingSize: 'X', shoeSize: '42', measurements: 'N/A' },
    { id: 106, name: 'Diana Torres', cedula: '60606060', city: 'Medellín', category: 'BARISTAS', photo: 'https://i.pravatar.cc/150?u=diana', clothingSize: 'XS', shoeSize: '35', measurements: '80-55-80' },
    { id: 107, name: 'Pedro Solo', cedula: '70707070', city: 'Medellín', category: 'IMPULSADORES', photo: 'https://i.pravatar.cc/150?u=pedro', clothingSize: 'L', shoeSize: '41', measurements: 'N/A' },
    { id: 108, name: 'Elena Nito', cedula: '80808080', city: 'Medellín', category: 'LOGISTICOS', photo: 'https://i.pravatar.cc/150?u=elena', clothingSize: 'S', shoeSize: '37', measurements: '88-62-88' },
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
  events: []
};

module.exports = { INITIAL_DB };
