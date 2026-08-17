'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const RAIZ = path.join(__dirname, '..');
const CARPETA_DATOS = path.join(RAIZ, 'data');

if (!fs.existsSync(CARPETA_DATOS)) fs.mkdirSync(CARPETA_DATOS, { recursive: true });

const db = new Database(path.join(CARPETA_DATOS, 'jatelier.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  telefono      TEXT,
  hash          TEXT    NOT NULL,
  rol           TEXT    NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente','admin')),
  activo        INTEGER NOT NULL DEFAULT 1,
  creado        TEXT    NOT NULL DEFAULT (datetime('now')),
  ultimo_acceso TEXT
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo        TEXT    NOT NULL,
  anio_modelo   TEXT,
  tipo          TEXT    NOT NULL DEFAULT 'auto' CHECK (tipo IN ('auto','moto','barco','otro')),
  subtitulo     TEXT,
  descripcion   TEXT,
  escala        TEXT    NOT NULL DEFAULT '1:8',
  largo_mm      INTEGER,
  terminado_en  TEXT,
  materiales    TEXT,
  estado        TEXT    NOT NULL DEFAULT 'disponible'
                CHECK (estado IN ('disponible','reservado','vendido','borrador')),
  precio        REAL,
  moneda        TEXT    NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS','USD','EUR')),
  mostrar_precio INTEGER NOT NULL DEFAULT 0,
  destacado     INTEGER NOT NULL DEFAULT 0,
  orden         INTEGER NOT NULL DEFAULT 0,
  color_placa   TEXT    NOT NULL DEFAULT '#5C161D',
  creado        TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS caracteristicas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  etiqueta    TEXT    NOT NULL,
  valor       TEXT    NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fotos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  archivo     TEXT    NOT NULL,
  alt         TEXT,
  orden       INTEGER NOT NULL DEFAULT 0,
  creado      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consultas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id  INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
  usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre       TEXT    NOT NULL,
  email        TEXT    NOT NULL,
  telefono     TEXT,
  mensaje      TEXT    NOT NULL,
  estado       TEXT    NOT NULL DEFAULT 'nueva'
               CHECK (estado IN ('nueva','leida','contestada','cerrada')),
  nota_interna TEXT,
  origen       TEXT    NOT NULL DEFAULT 'web',
  creado       TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  creado      TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, vehiculo_id)
);

CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_veh_estado   ON vehiculos(estado, orden);
CREATE INDEX IF NOT EXISTS idx_fotos_veh    ON fotos(vehiculo_id, orden);
CREATE INDEX IF NOT EXISTS idx_carac_veh    ON caracteristicas(vehiculo_id, orden);
CREATE INDEX IF NOT EXISTS idx_cons_estado  ON consultas(estado, creado DESC);
`);

// ---- ajustes del sitio (editables desde el panel) -------------------------
const { DEFECTOS } = require('./textos');

const insertarAjuste = db.prepare(
  'INSERT OR IGNORE INTO ajustes (clave, valor) VALUES (?, ?)'
);
for (const [clave, valor] of Object.entries(DEFECTOS)) {
  insertarAjuste.run(clave, valor);
}

/* ---------------------------------------------------------------------------
 * Cambio de nombre: Jatelier -> Jartelier.
 * Se corre solo, una vez, sobre bases que ya existían. No toca contraseñas.
 * ------------------------------------------------------------------------- */
(function renombrarTaller() {
  const yaHecho = db.prepare("SELECT valor FROM ajustes WHERE clave = 'migracion_jartelier'").get();
  if (yaHecho) return;

  const tx = db.transaction(() => {
    // textos viejos que quedaron guardados con el nombre anterior
    db.prepare("UPDATE ajustes SET valor = REPLACE(valor, 'Jatelier', 'Jartelier') WHERE valor LIKE '%Jatelier%'").run();
    db.prepare("UPDATE ajustes SET valor = REPLACE(valor, 'jatelier.com', 'jartelier.com') WHERE valor LIKE '%jatelier.com%'").run();

    // correo del vendedor
    db.prepare(
      "UPDATE usuarios SET email = REPLACE(email, '@jatelier.com.ar', '@jartelier.com.ar') WHERE email LIKE '%@jatelier.com.ar'"
    ).run();
    db.prepare("UPDATE usuarios SET nombre = REPLACE(nombre, 'Jatelier', 'Jartelier') WHERE nombre LIKE '%Jatelier%'").run();

    // claves que dejaron de existir en el esquema nuevo
    db.prepare("DELETE FROM ajustes WHERE clave = 'sitio_bajada'").run();

    // la apertura se rehizo con el diseño nuevo: vuelve al texto actual
    const ponerDefecto = db.prepare('UPDATE ajustes SET valor = ? WHERE clave = ?');
    for (const clave of ['hero_titulo', 'hero_texto']) {
      ponerDefecto.run(DEFECTOS[clave], clave);
    }

    db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('migracion_jartelier', '1')").run();
  });

  try {
    tx();
    console.log('· Nombre actualizado a Jartelier.');
  } catch (err) {
    console.error('· No se pudo renombrar automáticamente:', err.message);
  }
})();

function leerAjustes() {
  const filas = db.prepare('SELECT clave, valor FROM ajustes').all();
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

function guardarAjuste(clave, valor) {
  db.prepare(
    'INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
  ).run(clave, String(valor));
}

module.exports = { db, leerAjustes, guardarAjuste, RAIZ, CARPETA_DATOS };
