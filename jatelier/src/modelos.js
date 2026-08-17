'use strict';

const { db } = require('./db');

const TIPOS = ['auto', 'moto', 'barco', 'otro'];
const ESTADOS = ['disponible', 'reservado', 'vendido', 'borrador'];
const MONEDAS = ['ARS', 'USD', 'EUR'];
const ESTADOS_CONSULTA = ['nueva', 'leida', 'contestada', 'cerrada'];

/* ----------------------------------------------------------- utilidades */

function aEntero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function aDecimal(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function aBooleano(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0;
}

function texto(v, max = 4000) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function colorValido(v) {
  const s = texto(v, 20);
  return s && /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#5C161D';
}

/* ------------------------------------------------------------ vehiculos */

/** Valida el cuerpo de un alta/edición. Devuelve { datos } o { error }. */
function validarVehiculo(cuerpo, { parcial = false } = {}) {
  const titulo = texto(cuerpo.titulo, 120);
  if (!parcial && !titulo) return { error: 'El vehículo necesita un título.' };

  const tipo = texto(cuerpo.tipo, 10);
  if (tipo && !TIPOS.includes(tipo)) return { error: 'Tipo de vehículo inválido.' };

  const estado = texto(cuerpo.estado, 12);
  if (estado && !ESTADOS.includes(estado)) return { error: 'Estado inválido.' };

  const moneda = texto(cuerpo.moneda, 3);
  if (moneda && !MONEDAS.includes(moneda)) return { error: 'Moneda inválida.' };

  return {
    datos: {
      titulo,
      anio_modelo: texto(cuerpo.anio_modelo, 20),
      tipo: tipo || 'auto',
      subtitulo: texto(cuerpo.subtitulo, 160),
      descripcion: texto(cuerpo.descripcion, 6000),
      escala: texto(cuerpo.escala, 20) || '1:8',
      largo_mm: aEntero(cuerpo.largo_mm),
      terminado_en: texto(cuerpo.terminado_en, 20),
      materiales: texto(cuerpo.materiales, 300),
      estado: estado || 'disponible',
      precio: aDecimal(cuerpo.precio),
      moneda: moneda || 'ARS',
      mostrar_precio: aBooleano(cuerpo.mostrar_precio),
      destacado: aBooleano(cuerpo.destacado),
      orden: aEntero(cuerpo.orden) ?? 0,
      color_placa: colorValido(cuerpo.color_placa),
    },
  };
}

/** Las características llegan como array [{etiqueta, valor}] o como JSON string. */
function normalizarCaracteristicas(entrada) {
  let lista = entrada;
  if (typeof lista === 'string') {
    try {
      lista = JSON.parse(lista);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(lista)) return [];
  return lista
    .map((c, i) => ({
      etiqueta: texto(c && c.etiqueta, 60),
      valor: texto(c && c.valor, 200),
      orden: aEntero(c && c.orden) ?? i,
    }))
    .filter((c) => c.etiqueta && c.valor)
    .slice(0, 40);
}

function reemplazarCaracteristicas(vehiculoId, lista) {
  const borrar = db.prepare('DELETE FROM caracteristicas WHERE vehiculo_id = ?');
  const insertar = db.prepare(
    'INSERT INTO caracteristicas (vehiculo_id, etiqueta, valor, orden) VALUES (?, ?, ?, ?)'
  );
  const tx = db.transaction((id, items) => {
    borrar.run(id);
    items.forEach((c, i) => insertar.run(id, c.etiqueta, c.valor, c.orden ?? i));
  });
  tx(vehiculoId, lista);
}

function crearVehiculo(datos) {
  const info = db
    .prepare(
      `INSERT INTO vehiculos
        (titulo, anio_modelo, tipo, subtitulo, descripcion, escala, largo_mm,
         terminado_en, materiales, estado, precio, moneda, mostrar_precio,
         destacado, orden, color_placa)
       VALUES
        (@titulo, @anio_modelo, @tipo, @subtitulo, @descripcion, @escala, @largo_mm,
         @terminado_en, @materiales, @estado, @precio, @moneda, @mostrar_precio,
         @destacado, @orden, @color_placa)`
    )
    .run(datos);
  return info.lastInsertRowid;
}

function actualizarVehiculo(id, datos) {
  const actual = db.prepare('SELECT * FROM vehiculos WHERE id = ?').get(id);
  if (!actual) return false;
  const mezcla = { ...actual, ...datos, id };
  db.prepare(
    `UPDATE vehiculos SET
       titulo = @titulo, anio_modelo = @anio_modelo, tipo = @tipo,
       subtitulo = @subtitulo, descripcion = @descripcion, escala = @escala,
       largo_mm = @largo_mm, terminado_en = @terminado_en, materiales = @materiales,
       estado = @estado, precio = @precio, moneda = @moneda,
       mostrar_precio = @mostrar_precio, destacado = @destacado, orden = @orden,
       color_placa = @color_placa, actualizado = datetime('now')
     WHERE id = @id`
  ).run(mezcla);
  return true;
}

function fotosDe(vehiculoId) {
  return db
    .prepare('SELECT id, archivo, alt, orden FROM fotos WHERE vehiculo_id = ? ORDER BY orden, id')
    .all(vehiculoId)
    .map((f) => ({ ...f, url: '/fotos/' + f.archivo }));
}

function caracteristicasDe(vehiculoId) {
  return db
    .prepare(
      'SELECT id, etiqueta, valor, orden FROM caracteristicas WHERE vehiculo_id = ? ORDER BY orden, id'
    )
    .all(vehiculoId);
}

function armarVehiculo(fila) {
  if (!fila) return null;
  return {
    ...fila,
    mostrar_precio: !!fila.mostrar_precio,
    destacado: !!fila.destacado,
    fotos: fotosDe(fila.id),
    caracteristicas: caracteristicasDe(fila.id),
  };
}

function obtenerVehiculo(id) {
  return armarVehiculo(db.prepare('SELECT * FROM vehiculos WHERE id = ?').get(id));
}

/**
 * @param {object} opciones
 * @param {boolean} opciones.incluirOcultos  true solo para el panel de empresa
 * @param {string}  opciones.tipo
 * @param {string}  opciones.estado
 * @param {string}  opciones.busqueda
 */
function listarVehiculos(opciones = {}) {
  const { incluirOcultos = false, tipo, estado, busqueda } = opciones;
  const condiciones = [];
  const params = {};

  if (!incluirOcultos) condiciones.push("estado <> 'borrador'");
  if (tipo && TIPOS.includes(tipo)) {
    condiciones.push('tipo = @tipo');
    params.tipo = tipo;
  }
  if (estado && ESTADOS.includes(estado)) {
    condiciones.push('estado = @estado');
    params.estado = estado;
  }
  if (busqueda) {
    condiciones.push(
      '(titulo LIKE @q OR subtitulo LIKE @q OR descripcion LIKE @q OR materiales LIKE @q)'
    );
    params.q = '%' + String(busqueda).trim() + '%';
  }

  const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const filas = db
    .prepare(
      `SELECT * FROM vehiculos ${where}
       ORDER BY destacado DESC, orden ASC, id DESC`
    )
    .all(params);
  return filas.map(armarVehiculo);
}

function borrarVehiculo(id) {
  const fotos = db.prepare('SELECT archivo FROM fotos WHERE vehiculo_id = ?').all(id);
  db.prepare('DELETE FROM vehiculos WHERE id = ?').run(id);
  return fotos.map((f) => f.archivo);
}

/* ------------------------------------------------------------- consultas */

function crearConsulta(datos) {
  const info = db
    .prepare(
      `INSERT INTO consultas (vehiculo_id, usuario_id, nombre, email, telefono, mensaje, origen)
       VALUES (@vehiculo_id, @usuario_id, @nombre, @email, @telefono, @mensaje, @origen)`
    )
    .run(datos);
  return info.lastInsertRowid;
}

function listarConsultas({ estado, busqueda } = {}) {
  const condiciones = [];
  const params = {};
  if (estado && ESTADOS_CONSULTA.includes(estado)) {
    condiciones.push('c.estado = @estado');
    params.estado = estado;
  }
  if (busqueda) {
    condiciones.push('(c.nombre LIKE @q OR c.email LIKE @q OR c.mensaje LIKE @q)');
    params.q = '%' + String(busqueda).trim() + '%';
  }
  const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  return db
    .prepare(
      `SELECT c.*, v.titulo AS vehiculo_titulo, u.nombre AS usuario_nombre
       FROM consultas c
       LEFT JOIN vehiculos v ON v.id = c.vehiculo_id
       LEFT JOIN usuarios  u ON u.id = c.usuario_id
       ${where}
       ORDER BY c.creado DESC`
    )
    .all(params);
}

/* ---------------------------------------------------------------- resumen */

function resumen() {
  const uno = (sql) => db.prepare(sql).get().n;
  return {
    vehiculos: uno('SELECT COUNT(*) n FROM vehiculos'),
    disponibles: uno("SELECT COUNT(*) n FROM vehiculos WHERE estado = 'disponible'"),
    reservados: uno("SELECT COUNT(*) n FROM vehiculos WHERE estado = 'reservado'"),
    vendidos: uno("SELECT COUNT(*) n FROM vehiculos WHERE estado = 'vendido'"),
    borradores: uno("SELECT COUNT(*) n FROM vehiculos WHERE estado = 'borrador'"),
    consultas: uno('SELECT COUNT(*) n FROM consultas'),
    consultas_nuevas: uno("SELECT COUNT(*) n FROM consultas WHERE estado = 'nueva'"),
    clientes: uno("SELECT COUNT(*) n FROM usuarios WHERE rol = 'cliente'"),
    vendedores: uno("SELECT COUNT(*) n FROM usuarios WHERE rol = 'admin'"),
    fotos: uno('SELECT COUNT(*) n FROM fotos'),
  };
}

module.exports = {
  TIPOS,
  ESTADOS,
  MONEDAS,
  ESTADOS_CONSULTA,
  texto,
  aEntero,
  aBooleano,
  validarVehiculo,
  normalizarCaracteristicas,
  reemplazarCaracteristicas,
  crearVehiculo,
  actualizarVehiculo,
  obtenerVehiculo,
  listarVehiculos,
  borrarVehiculo,
  fotosDe,
  crearConsulta,
  listarConsultas,
  resumen,
};
