'use strict';

const bcrypt = require('bcryptjs');
const { db } = require('./db');

const RONDAS = 12;

const CAMPOS_PUBLICOS =
  'id, nombre, email, telefono, rol, activo, creado, ultimo_acceso';

function hashear(clave) {
  return bcrypt.hashSync(clave, RONDAS);
}

function verificar(clave, hash) {
  return bcrypt.compareSync(clave, hash);
}

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Devuelve un texto con el problema, o null si la clave sirve. */
function problemaDeClave(clave) {
  if (typeof clave !== 'string' || clave.length < 8) {
    return 'La contraseña tiene que tener al menos 8 caracteres.';
  }
  if (clave.length > 200) return 'La contraseña es demasiado larga.';
  if (!/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) {
    return 'La contraseña tiene que combinar letras y números.';
  }
  return null;
}

function buscarPorEmail(email) {
  return db
    .prepare('SELECT * FROM usuarios WHERE email = ? COLLATE NOCASE')
    .get(normalizarEmail(email));
}

function buscarPorId(id) {
  return db.prepare(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`).get(id);
}

function crearUsuario({ nombre, email, telefono, clave, rol = 'cliente' }) {
  const info = db
    .prepare(
      'INSERT INTO usuarios (nombre, email, telefono, hash, rol) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      String(nombre).trim(),
      normalizarEmail(email),
      telefono ? String(telefono).trim() : null,
      hashear(clave),
      rol
    );
  return buscarPorId(info.lastInsertRowid);
}

function marcarAcceso(id) {
  db.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").run(id);
}

/** Usuario de la sesión actual, o null. Relee de la base para respetar cambios de rol. */
function usuarioActual(req) {
  if (!req.session || !req.session.usuarioId) return null;
  const u = buscarPorId(req.session.usuarioId);
  if (!u || !u.activo) return null;
  return u;
}

function pedirSesion(req, res, next) {
  const u = usuarioActual(req);
  if (!u) return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  req.usuario = u;
  next();
}

function pedirAdmin(req, res, next) {
  const u = usuarioActual(req);
  if (!u) return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  if (u.rol !== 'admin') {
    return res.status(403).json({ error: 'Esta sección es solo para vendedores.' });
  }
  req.usuario = u;
  next();
}

/** Para páginas HTML: si no es admin, lo manda al login en vez de devolver JSON. */
function paginaSoloAdmin(req, res, next) {
  const u = usuarioActual(req);
  if (!u) return res.redirect('/ingresar.html?destino=/empresa.html');
  if (u.rol !== 'admin') return res.redirect('/cuenta.html?aviso=sin-permiso');
  req.usuario = u;
  next();
}

module.exports = {
  hashear,
  verificar,
  normalizarEmail,
  emailValido,
  problemaDeClave,
  buscarPorEmail,
  buscarPorId,
  crearUsuario,
  marcarAcceso,
  usuarioActual,
  pedirSesion,
  pedirAdmin,
  paginaSoloAdmin,
  CAMPOS_PUBLICOS,
};
