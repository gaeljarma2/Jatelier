'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const { db, RAIZ, leerAjustes, guardarAjuste } = require('./db');
const A = require('./auth');
const M = require('./modelos');

const router = express.Router();
router.use(A.pedirAdmin); // todo lo de acá adentro es solo para vendedores

/* ------------------------------------------------------- subida de fotos */

const CARPETA_FOTOS = path.join(RAIZ, 'uploads');
if (!fs.existsSync(CARPETA_FOTOS)) fs.mkdirSync(CARPETA_FOTOS, { recursive: true });

const EXTENSIONES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CARPETA_FOTOS),
  filename: (req, file, cb) => {
    const ext = EXTENSIONES[file.mimetype] || '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
  },
});

const subida = multer({
  storage: almacenamiento,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONES[file.mimetype]) return cb(null, true);
    cb(new Error('Solo se aceptan imágenes JPG, PNG o WEBP.'));
  },
});

function borrarArchivo(nombre) {
  const destino = path.join(CARPETA_FOTOS, path.basename(nombre));
  fs.promises.unlink(destino).catch(() => {});
}

/* --------------------------------------------------------------- resumen */

router.get('/resumen', (req, res) => {
  res.json({ resumen: M.resumen() });
});

/* ------------------------------------------------------------- vehículos */

router.get('/vehiculos', (req, res) => {
  res.json({
    vehiculos: M.listarVehiculos({
      incluirOcultos: true,
      tipo: req.query.tipo,
      estado: req.query.estado,
      busqueda: req.query.q,
    }),
  });
});

router.get('/vehiculos/:id', (req, res) => {
  const v = M.obtenerVehiculo(req.params.id);
  if (!v) return res.status(404).json({ error: 'No existe ese vehículo.' });
  res.json({ vehiculo: v });
});

router.post('/vehiculos', (req, res) => {
  const { datos, error } = M.validarVehiculo(req.body);
  if (error) return res.status(400).json({ error });

  const id = M.crearVehiculo(datos);
  const caracteristicas = M.normalizarCaracteristicas(req.body.caracteristicas);
  if (caracteristicas.length) M.reemplazarCaracteristicas(id, caracteristicas);

  res.status(201).json({ vehiculo: M.obtenerVehiculo(id) });
});

router.put('/vehiculos/:id', (req, res) => {
  const { datos, error } = M.validarVehiculo(req.body);
  if (error) return res.status(400).json({ error });

  const ok = M.actualizarVehiculo(req.params.id, datos);
  if (!ok) return res.status(404).json({ error: 'No existe ese vehículo.' });

  if (req.body.caracteristicas !== undefined) {
    M.reemplazarCaracteristicas(
      req.params.id,
      M.normalizarCaracteristicas(req.body.caracteristicas)
    );
  }
  res.json({ vehiculo: M.obtenerVehiculo(req.params.id) });
});

/** Cambios rápidos desde la tabla: estado, destacado, orden, precio. */
router.patch('/vehiculos/:id', (req, res) => {
  const actual = db.prepare('SELECT * FROM vehiculos WHERE id = ?').get(req.params.id);
  if (!actual) return res.status(404).json({ error: 'No existe ese vehículo.' });

  const cambios = {};
  if (req.body.estado !== undefined) {
    if (!M.ESTADOS.includes(req.body.estado)) {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    cambios.estado = req.body.estado;
  }
  if (req.body.destacado !== undefined) cambios.destacado = M.aBooleano(req.body.destacado);
  if (req.body.orden !== undefined) cambios.orden = M.aEntero(req.body.orden) ?? 0;

  M.actualizarVehiculo(req.params.id, cambios);
  res.json({ vehiculo: M.obtenerVehiculo(req.params.id) });
});

router.delete('/vehiculos/:id', (req, res) => {
  const existe = db.prepare('SELECT id FROM vehiculos WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ error: 'No existe ese vehículo.' });

  const archivos = M.borrarVehiculo(req.params.id);
  archivos.forEach(borrarArchivo);
  res.json({ ok: true });
});

/* ------------------------------------------------------------ fotos */

router.post('/vehiculos/:id/fotos', subida.array('fotos', 12), (req, res) => {
  const vehiculo = db.prepare('SELECT id FROM vehiculos WHERE id = ?').get(req.params.id);
  if (!vehiculo) {
    (req.files || []).forEach((f) => borrarArchivo(f.filename));
    return res.status(404).json({ error: 'No existe ese vehículo.' });
  }
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No llegó ninguna imagen.' });
  }

  const maximo =
    db.prepare('SELECT COALESCE(MAX(orden), -1) m FROM fotos WHERE vehiculo_id = ?')
      .get(req.params.id).m;

  const insertar = db.prepare(
    'INSERT INTO fotos (vehiculo_id, archivo, alt, orden) VALUES (?, ?, ?, ?)'
  );
  req.files.forEach((f, i) => {
    insertar.run(req.params.id, f.filename, M.texto(req.body.alt, 200), maximo + 1 + i);
  });

  res.status(201).json({ fotos: M.fotosDe(req.params.id) });
});

router.patch('/fotos/:id', (req, res) => {
  const foto = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto) return res.status(404).json({ error: 'No existe esa foto.' });

  const alt = req.body.alt !== undefined ? M.texto(req.body.alt, 200) : foto.alt;
  const orden = req.body.orden !== undefined ? M.aEntero(req.body.orden) ?? 0 : foto.orden;

  db.prepare('UPDATE fotos SET alt = ?, orden = ? WHERE id = ?').run(alt, orden, foto.id);
  res.json({ fotos: M.fotosDe(foto.vehiculo_id) });
});

/** Poner una foto como portada = mandarla al primer lugar. */
router.post('/fotos/:id/portada', (req, res) => {
  const foto = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto) return res.status(404).json({ error: 'No existe esa foto.' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE fotos SET orden = orden + 1 WHERE vehiculo_id = ?').run(foto.vehiculo_id);
    db.prepare('UPDATE fotos SET orden = 0 WHERE id = ?').run(foto.id);
  });
  tx();
  res.json({ fotos: M.fotosDe(foto.vehiculo_id) });
});

router.delete('/fotos/:id', (req, res) => {
  const foto = db.prepare('SELECT * FROM fotos WHERE id = ?').get(req.params.id);
  if (!foto) return res.status(404).json({ error: 'No existe esa foto.' });

  db.prepare('DELETE FROM fotos WHERE id = ?').run(foto.id);
  borrarArchivo(foto.archivo);
  res.json({ fotos: M.fotosDe(foto.vehiculo_id) });
});

/* ---------------------------------------------------- consultas (mails) */

router.get('/consultas', (req, res) => {
  res.json({ consultas: M.listarConsultas({ estado: req.query.estado, busqueda: req.query.q }) });
});

router.patch('/consultas/:id', (req, res) => {
  const consulta = db.prepare('SELECT * FROM consultas WHERE id = ?').get(req.params.id);
  if (!consulta) return res.status(404).json({ error: 'No existe esa consulta.' });

  const estado = req.body.estado !== undefined ? String(req.body.estado) : consulta.estado;
  if (!M.ESTADOS_CONSULTA.includes(estado)) {
    return res.status(400).json({ error: 'Estado de consulta inválido.' });
  }
  const nota =
    req.body.nota_interna !== undefined
      ? M.texto(req.body.nota_interna, 4000)
      : consulta.nota_interna;

  db.prepare(
    "UPDATE consultas SET estado = ?, nota_interna = ?, actualizado = datetime('now') WHERE id = ?"
  ).run(estado, nota, consulta.id);

  res.json({ consulta: db.prepare('SELECT * FROM consultas WHERE id = ?').get(consulta.id) });
});

router.delete('/consultas/:id', (req, res) => {
  db.prepare('DELETE FROM consultas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/** Descarga de todos los correos en CSV, para mandar novedades. */
router.get('/consultas.csv', (req, res) => {
  const filas = M.listarConsultas({});
  const escapar = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const cabecera = [
    'id', 'fecha', 'nombre', 'email', 'telefono', 'vehiculo', 'estado', 'mensaje', 'nota_interna',
  ];
  const cuerpo = filas.map((c) =>
    [c.id, c.creado, c.nombre, c.email, c.telefono, c.vehiculo_titulo, c.estado, c.mensaje, c.nota_interna]
      .map(escapar)
      .join(',')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="consultas-jartelier.csv"');
  res.send('﻿' + [cabecera.join(','), ...cuerpo].join('\n'));
});

/* ------------------------------------------------------------- usuarios */

router.get('/usuarios', (req, res) => {
  const usuarios = db
    .prepare(
      `SELECT ${A.CAMPOS_PUBLICOS},
        (SELECT COUNT(*) FROM consultas c WHERE c.usuario_id = usuarios.id) AS consultas
       FROM usuarios ORDER BY creado DESC`
    )
    .all();
  res.json({ usuarios });
});

router.post('/usuarios', (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const email = A.normalizarEmail(req.body.email);
  const rol = req.body.rol === 'admin' ? 'admin' : 'cliente';

  if (nombre.length < 2) return res.status(400).json({ error: 'Falta el nombre.' });
  if (!A.emailValido(email)) return res.status(400).json({ error: 'Correo inválido.' });

  const problema = A.problemaDeClave(req.body.clave);
  if (problema) return res.status(400).json({ error: problema });
  if (A.buscarPorEmail(email)) return res.status(409).json({ error: 'Ese correo ya está usado.' });

  const usuario = A.crearUsuario({
    nombre,
    email,
    telefono: req.body.telefono,
    clave: req.body.clave,
    rol,
  });
  res.status(201).json({ usuario });
});

router.patch('/usuarios/:id', (req, res) => {
  const id = M.aEntero(req.params.id);
  const usuario = A.buscarPorId(id);
  if (!usuario) return res.status(404).json({ error: 'No existe ese usuario.' });

  const esUltimoAdmin =
    usuario.rol === 'admin' &&
    db.prepare("SELECT COUNT(*) n FROM usuarios WHERE rol = 'admin' AND activo = 1").get().n <= 1;

  if (req.body.rol !== undefined) {
    const rol = req.body.rol === 'admin' ? 'admin' : 'cliente';
    if (rol === 'cliente' && esUltimoAdmin) {
      return res.status(400).json({ error: 'Tiene que quedar al menos un vendedor con acceso.' });
    }
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, id);
  }

  if (req.body.activo !== undefined) {
    const activo = M.aBooleano(req.body.activo);
    if (!activo && esUltimoAdmin) {
      return res.status(400).json({ error: 'No podés desactivar al último vendedor.' });
    }
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo, id);
  }

  if (req.body.clave) {
    const problema = A.problemaDeClave(req.body.clave);
    if (problema) return res.status(400).json({ error: problema });
    db.prepare('UPDATE usuarios SET hash = ? WHERE id = ?').run(A.hashear(req.body.clave), id);
  }

  res.json({ usuario: A.buscarPorId(id) });
});

router.delete('/usuarios/:id', (req, res) => {
  const id = M.aEntero(req.params.id);
  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'No podés borrar tu propia cuenta.' });
  }
  const usuario = A.buscarPorId(id);
  if (!usuario) return res.status(404).json({ error: 'No existe ese usuario.' });

  if (usuario.rol === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) n FROM usuarios WHERE rol = 'admin'").get().n;
    if (admins <= 1) return res.status(400).json({ error: 'Tiene que quedar un vendedor.' });
  }
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  res.json({ ok: true });
});

/* ------------------------------------------------------- textos y ajustes */

const { GRUPOS, DEFECTOS, CLAVES } = require('./textos');

/** Devuelve el mapa de secciones + los valores actuales, para armar el editor. */
router.get('/textos', (req, res) => {
  res.json({ grupos: GRUPOS, valores: leerAjustes(), defectos: DEFECTOS });
});

router.put('/textos', (req, res) => {
  const cambios = req.body && typeof req.body === 'object' ? req.body : {};
  const guardadas = [];

  for (const [clave, valorCrudo] of Object.entries(cambios)) {
    if (!CLAVES.includes(clave)) continue;
    const valor =
      clave === 'registro_abierto'
        ? String(M.aBooleano(valorCrudo))
        : String(valorCrudo ?? '').slice(0, 6000);
    guardarAjuste(clave, valor);
    guardadas.push(clave);
  }

  res.json({ guardadas, valores: leerAjustes() });
});

/** Devuelve un texto a como venía de fábrica. */
router.post('/textos/restaurar', (req, res) => {
  const clave = String(req.body.clave || '');
  if (!CLAVES.includes(clave)) return res.status(400).json({ error: 'Ese texto no existe.' });
  guardarAjuste(clave, DEFECTOS[clave]);
  res.json({ clave, valor: DEFECTOS[clave] });
});

// compatibilidad con la versión anterior del panel
router.get('/ajustes', (req, res) => {
  res.json({ ajustes: leerAjustes() });
});

/* --------------------------------------------- errores propios de multer */

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const mensajes = {
      LIMIT_FILE_SIZE: 'Cada imagen tiene que pesar menos de 8 MB.',
      LIMIT_FILE_COUNT: 'Máximo 12 imágenes por vez.',
    };
    return res.status(400).json({ error: mensajes[err.code] || 'No se pudo subir la imagen.' });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;
