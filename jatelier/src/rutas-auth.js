'use strict';

const express = require('express');
const { db, leerAjustes } = require('./db');
const A = require('./auth');

const router = express.Router();

/* Freno simple contra fuerza bruta: 8 intentos fallidos por IP cada 10 min. */
const intentos = new Map();
const VENTANA = 10 * 60 * 1000;
const MAX_INTENTOS = 8;

function llave(req) {
  return req.ip || 'desconocida';
}

function demasiadosIntentos(req) {
  const registro = intentos.get(llave(req));
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA) {
    intentos.delete(llave(req));
    return false;
  }
  return registro.cantidad >= MAX_INTENTOS;
}

function sumarIntento(req) {
  const k = llave(req);
  const registro = intentos.get(k);
  if (!registro || Date.now() - registro.desde > VENTANA) {
    intentos.set(k, { cantidad: 1, desde: Date.now() });
  } else {
    registro.cantidad += 1;
  }
}

function limpiarIntentos(req) {
  intentos.delete(llave(req));
}

/* --------------------------------------------------------------- registro */

router.post('/registro', (req, res) => {
  const ajustes = leerAjustes();
  if (ajustes.registro_abierto !== '1') {
    return res.status(403).json({ error: 'El registro de nuevas cuentas está cerrado.' });
  }

  const nombre = String(req.body.nombre || '').trim();
  const email = A.normalizarEmail(req.body.email);
  const telefono = String(req.body.telefono || '').trim();
  const clave = req.body.clave;

  if (nombre.length < 2) return res.status(400).json({ error: 'Poné tu nombre.' });
  if (!A.emailValido(email)) return res.status(400).json({ error: 'Ese correo no parece válido.' });

  const problema = A.problemaDeClave(clave);
  if (problema) return res.status(400).json({ error: problema });

  if (A.buscarPorEmail(email)) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
  }

  // El primer usuario del sistema queda como admin, para poder entrar al panel.
  const hayUsuarios = db.prepare('SELECT COUNT(*) n FROM usuarios').get().n > 0;
  const rol = hayUsuarios ? 'cliente' : 'admin';

  const usuario = A.crearUsuario({ nombre, email, telefono, clave, rol });
  req.session.usuarioId = usuario.id;
  res.status(201).json({ usuario });
});

/* ------------------------------------------------------------------ login */

router.post('/ingreso', (req, res) => {
  if (demasiadosIntentos(req)) {
    return res
      .status(429)
      .json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' });
  }

  const email = A.normalizarEmail(req.body.email);
  const clave = String(req.body.clave || '');
  const usuario = A.buscarPorEmail(email);

  if (!usuario || !A.verificar(clave, usuario.hash)) {
    sumarIntento(req);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  if (!usuario.activo) {
    return res.status(403).json({ error: 'Esta cuenta está desactivada.' });
  }

  limpiarIntentos(req);
  A.marcarAcceso(usuario.id);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo iniciar la sesión.' });
    req.session.usuarioId = usuario.id;
    res.json({ usuario: A.buscarPorId(usuario.id) });
  });
});

/* ----------------------------------------------------------------- salida */

router.post('/salida', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('jartelier.sid');
    res.json({ ok: true });
  });
});

/* ------------------------------------------------------------- quién soy */

router.get('/yo', (req, res) => {
  res.json({ usuario: A.usuarioActual(req) });
});

/* ------------------------------------------------------ editar mi cuenta */

router.patch('/yo', A.pedirSesion, (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const telefono = String(req.body.telefono || '').trim();
  if (nombre && nombre.length < 2) return res.status(400).json({ error: 'Nombre demasiado corto.' });

  db.prepare('UPDATE usuarios SET nombre = COALESCE(NULLIF(?, \'\'), nombre), telefono = ? WHERE id = ?')
    .run(nombre, telefono || null, req.usuario.id);

  res.json({ usuario: A.buscarPorId(req.usuario.id) });
});

/* -------------------------------------------------------- cambiar clave */

router.post('/clave', A.pedirSesion, (req, res) => {
  const actual = String(req.body.actual || '');
  const nueva = req.body.nueva;

  const fila = db.prepare('SELECT hash FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!A.verificar(actual, fila.hash)) {
    return res.status(401).json({ error: 'La contraseña actual no coincide.' });
  }
  const problema = A.problemaDeClave(nueva);
  if (problema) return res.status(400).json({ error: problema });

  db.prepare('UPDATE usuarios SET hash = ? WHERE id = ?').run(A.hashear(nueva), req.usuario.id);
  res.json({ ok: true });
});

module.exports = router;
