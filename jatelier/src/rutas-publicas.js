'use strict';

const express = require('express');
const { db, leerAjustes } = require('./db');
const A = require('./auth');
const M = require('./modelos');

const router = express.Router();

/* ------------------------------------------------------------ ajustes web */

const { CLAVES } = require('./textos');

router.get('/ajustes', (req, res) => {
  const guardados = leerAjustes();
  const textos = {};
  for (const clave of CLAVES) {
    if (guardados[clave] !== undefined) textos[clave] = guardados[clave];
  }
  textos.registro_abierto = guardados.registro_abierto === '1';
  res.json(textos);
});

/* ---------------------------------------------------------- catálogo web */

router.get('/vehiculos', (req, res) => {
  const lista = M.listarVehiculos({
    incluirOcultos: false,
    tipo: req.query.tipo,
    estado: req.query.estado,
    busqueda: req.query.q,
  });
  res.json({ vehiculos: lista.map(limpiarParaPublico) });
});

router.get('/vehiculos/:id', (req, res) => {
  const v = M.obtenerVehiculo(req.params.id);
  if (!v || v.estado === 'borrador') {
    return res.status(404).json({ error: 'No encontramos ese vehículo.' });
  }
  res.json({ vehiculo: limpiarParaPublico(v) });
});

/** El público no ve precio si el vendedor no lo marcó como visible. */
function limpiarParaPublico(v) {
  const copia = { ...v };
  if (!copia.mostrar_precio) {
    copia.precio = null;
  }
  return copia;
}

/* ---------------------------------------------------------- consultas web */

router.post('/consultas', (req, res) => {
  const usuario = A.usuarioActual(req);

  const nombre = String(req.body.nombre || (usuario && usuario.nombre) || '').trim();
  const email = A.normalizarEmail(req.body.email || (usuario && usuario.email));
  const telefono = String(req.body.telefono || '').trim();
  const mensaje = String(req.body.mensaje || '').trim();
  const vehiculoId = M.aEntero(req.body.vehiculo_id);

  if (nombre.length < 2) return res.status(400).json({ error: 'Falta tu nombre.' });
  if (!A.emailValido(email)) return res.status(400).json({ error: 'Dejanos un correo válido.' });
  if (mensaje.length < 4) return res.status(400).json({ error: 'Contanos qué estás buscando.' });
  if (mensaje.length > 4000) return res.status(400).json({ error: 'El mensaje es muy largo.' });

  let vehiculoValido = null;
  if (vehiculoId) {
    const v = db.prepare('SELECT id FROM vehiculos WHERE id = ?').get(vehiculoId);
    if (v) vehiculoValido = v.id;
  }

  const id = M.crearConsulta({
    vehiculo_id: vehiculoValido,
    usuario_id: usuario ? usuario.id : null,
    nombre,
    email,
    telefono: telefono || null,
    mensaje,
    origen: vehiculoValido ? 'ficha' : 'web',
  });

  res.status(201).json({ ok: true, id });
});

/* ---------------------------------------- área del cliente (con sesión) */

router.get('/mis-consultas', A.pedirSesion, (req, res) => {
  const filas = db
    .prepare(
      `SELECT c.id, c.mensaje, c.estado, c.creado, v.titulo AS vehiculo_titulo
       FROM consultas c LEFT JOIN vehiculos v ON v.id = c.vehiculo_id
       WHERE c.usuario_id = ? OR c.email = ? COLLATE NOCASE
       ORDER BY c.creado DESC`
    )
    .all(req.usuario.id, req.usuario.email);
  res.json({ consultas: filas });
});

router.get('/favoritos', A.pedirSesion, (req, res) => {
  const ids = db
    .prepare('SELECT vehiculo_id FROM favoritos WHERE usuario_id = ?')
    .all(req.usuario.id)
    .map((f) => f.vehiculo_id);
  const vehiculos = ids
    .map((id) => M.obtenerVehiculo(id))
    .filter((v) => v && v.estado !== 'borrador')
    .map(limpiarParaPublico);
  res.json({ favoritos: ids, vehiculos });
});

router.post('/favoritos/:id', A.pedirSesion, (req, res) => {
  const id = M.aEntero(req.params.id);
  const existe = db.prepare('SELECT id FROM vehiculos WHERE id = ?').get(id);
  if (!existe) return res.status(404).json({ error: 'No existe ese vehículo.' });

  const yaEsta = db
    .prepare('SELECT 1 x FROM favoritos WHERE usuario_id = ? AND vehiculo_id = ?')
    .get(req.usuario.id, id);

  if (yaEsta) {
    db.prepare('DELETE FROM favoritos WHERE usuario_id = ? AND vehiculo_id = ?')
      .run(req.usuario.id, id);
    return res.json({ favorito: false });
  }
  db.prepare('INSERT INTO favoritos (usuario_id, vehiculo_id) VALUES (?, ?)')
    .run(req.usuario.id, id);
  res.json({ favorito: true });
});

module.exports = router;
