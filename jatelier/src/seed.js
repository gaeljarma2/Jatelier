'use strict';

/**
 * Carga inicial: crea el usuario vendedor y los seis vehículos que ya estaban
 * en la página. Se ejecuta con `npm run seed`.
 * Con `npm run reset` borra todo antes de volver a cargar.
 */

const { db } = require('./db');
const A = require('./auth');
const M = require('./modelos');

const RESETEAR = process.argv.includes('--reset');

const ADMIN = {
  nombre: process.env.ADMIN_NOMBRE || 'Vendedor Jartelier',
  email: process.env.ADMIN_EMAIL || 'admin@jartelier.com.ar',
  clave: process.env.ADMIN_CLAVE || 'jartelier2026',
};

const VEHICULOS = [
  {
    titulo: 'Cupé italiano',
    anio_modelo: '1962',
    tipo: 'auto',
    subtitulo: 'Chapa batida · laca bordó',
    descripcion:
      'Carrocería batida a mano sobre bolsa de arena, con laca aplicada en ocho manos y pulida a mano. Puertas, capot y baúl abren con bisagras hechas una por una.',
    largo_mm: 567,
    terminado_en: '1994',
    materiales: 'Chapa, bronce, cuero',
    estado: 'disponible',
    color_placa: '#7C1218',
    orden: 1,
    destacado: 1,
    caracteristicas: [
      { etiqueta: 'Largo', valor: '567 mm' },
      { etiqueta: 'Terminado en', valor: '1994' },
      { etiqueta: 'Puertas y capot', valor: 'abren' },
      { etiqueta: 'Motor', valor: 'armado a la vista' },
    ],
  },
  {
    titulo: 'Bicilíndrica',
    anio_modelo: '1958',
    tipo: 'moto',
    subtitulo: 'Radios tejidos uno por uno',
    descripcion:
      'Las dos ruedas llevan 36 rayos tejidos y tensados a mano. El motor tiene aletas fresadas una por una y el caballete sostiene la moto de verdad.',
    largo_mm: 268,
    terminado_en: '2001',
    materiales: 'Bronce, acero, aluminio',
    estado: 'disponible',
    color_placa: '#B22119',
    orden: 2,
    caracteristicas: [
      { etiqueta: 'Largo', valor: '268 mm' },
      { etiqueta: 'Terminado en', valor: '2001' },
      { etiqueta: 'Rayos por rueda', valor: '36' },
      { etiqueta: 'Caballete', valor: 'funciona' },
    ],
  },
  {
    titulo: 'Coupé de carrera',
    anio_modelo: '1949',
    tipo: 'auto',
    subtitulo: 'Aluminio pulido sin pintar',
    descripcion:
      'Sin una gota de pintura: el aluminio quedó a la vista, pulido a mano hasta el brillo. Butacas de cuero cosidas con hilo encerado y número grabado al chasis.',
    largo_mm: 540,
    terminado_en: '1987',
    materiales: 'Aluminio, cuero',
    estado: 'disponible',
    color_placa: '#3B0D12',
    orden: 3,
    caracteristicas: [
      { etiqueta: 'Largo', valor: '540 mm' },
      { etiqueta: 'Terminado en', valor: '1987' },
      { etiqueta: 'Butacas', valor: 'cuero cosido' },
      { etiqueta: 'Número', valor: 'grabado al chasis' },
    ],
  },
  {
    titulo: 'Moto con sidecar',
    anio_modelo: '1943',
    tipo: 'moto',
    subtitulo: 'Verde militar · lona cosida',
    descripcion:
      'El sidecar se desmonta con dos pasadores, igual que el original. La lona está cosida a máquina de pedal y las herramientas van adentro de la valija.',
    largo_mm: 291,
    terminado_en: '2009',
    materiales: 'Chapa, lona, madera',
    estado: 'disponible',
    color_placa: '#5C161D',
    orden: 4,
    caracteristicas: [
      { etiqueta: 'Largo', valor: '291 mm' },
      { etiqueta: 'Terminado en', valor: '2009' },
      { etiqueta: 'Sidecar', valor: 'desmontable' },
      { etiqueta: 'Herramientas', valor: 'en la valija' },
    ],
  },
  {
    titulo: 'Camioneta de reparto',
    anio_modelo: '1951',
    tipo: 'auto',
    subtitulo: 'Caja de madera y bronce',
    descripcion:
      'La caja está armada con listones de madera cortados a medida y herrajes de bronce. La dirección gira de verdad desde el volante.',
    largo_mm: 612,
    terminado_en: '1979',
    materiales: 'Madera, bronce, chapa',
    estado: 'disponible',
    color_placa: '#8E1A16',
    orden: 5,
    caracteristicas: [
      { etiqueta: 'Largo', valor: '612 mm' },
      { etiqueta: 'Terminado en', valor: '1979' },
      { etiqueta: 'Caja', valor: 'listones a medida' },
      { etiqueta: 'Dirección', valor: 'gira con el volante' },
    ],
  },
  {
    titulo: 'Monocilíndrica',
    anio_modelo: '1936',
    tipo: 'moto',
    subtitulo: 'La primera que hizo',
    descripcion:
      'La primera de todas, hecha a los veinte años. La cadena está armada eslabón por eslabón y nunca se retocó: está tal como salió del banco de trabajo.',
    largo_mm: 254,
    terminado_en: '1971',
    materiales: 'Acero, bronce',
    estado: 'disponible',
    color_placa: '#6E2A18',
    orden: 6,
    caracteristicas: [
      { etiqueta: 'Largo', valor: '254 mm' },
      { etiqueta: 'Terminado en', valor: '1971' },
      { etiqueta: 'Cadena', valor: 'eslabón por eslabón' },
      { etiqueta: 'Estado', valor: 'original, sin retocar' },
    ],
  },
];

function principal() {
  if (RESETEAR) {
    db.exec(
      'DELETE FROM favoritos; DELETE FROM consultas; DELETE FROM fotos; DELETE FROM caracteristicas; DELETE FROM vehiculos; DELETE FROM usuarios;'
    );
    console.log('· Base vaciada.');
  }

  let admin = A.buscarPorEmail(ADMIN.email);
  if (!admin) {
    admin = A.crearUsuario({ ...ADMIN, rol: 'admin' });
    console.log('· Vendedor creado:', ADMIN.email, '/', ADMIN.clave);
  } else {
    console.log('· El vendedor ya existía:', ADMIN.email);
  }

  const yaHay = db.prepare('SELECT COUNT(*) n FROM vehiculos').get().n;
  if (yaHay > 0) {
    console.log('· Ya hay', yaHay, 'vehículos cargados, no toco nada.');
  } else {
    for (const v of VEHICULOS) {
      const { datos, error } = M.validarVehiculo(v);
      if (error) throw new Error(error);
      const id = M.crearVehiculo({ ...datos, destacado: v.destacado ? 1 : 0, orden: v.orden });
      M.reemplazarCaracteristicas(id, M.normalizarCaracteristicas(v.caracteristicas));
    }
    console.log('· Cargados', VEHICULOS.length, 'vehículos.');
  }

  console.log('\nListo. Arrancá con: npm start\n');
}

principal();
