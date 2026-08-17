'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const AlmacenSQLite = require('connect-sqlite3')(session);

const { RAIZ, CARPETA_DATOS } = require('./db');
const A = require('./auth');

const app = express();
const PUERTO = process.env.PORT || 3000;
const EN_PRODUCCION = process.env.NODE_ENV === 'production';

if (EN_PRODUCCION) app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(
  session({
    name: 'jartelier.sid',
    secret: process.env.SESSION_SECRET || 'jartelier-cambiar-esta-clave-en-produccion',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new AlmacenSQLite({ db: 'sesiones.db', dir: CARPETA_DATOS }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: EN_PRODUCCION,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 días
    },
  })
);

/* ------------------------------------------------------------------ API */

app.use('/api/auth', require('./rutas-auth'));
app.use('/api', require('./rutas-publicas'));
app.use('/api/admin', require('./rutas-admin'));

/* -------------------------------------------------------------- estático */

// Las fotos subidas se sirven desde /fotos/archivo.jpg
app.use(
  '/fotos',
  express.static(path.join(RAIZ, 'uploads'), { maxAge: '30d', index: false })
);

// El panel de empresa se protege antes de servir el HTML.
app.get('/empresa.html', A.paginaSoloAdmin, (req, res) => {
  res.sendFile(path.join(RAIZ, 'public', 'empresa.html'));
});

app.get('/cuenta.html', (req, res, next) => {
  if (!A.usuarioActual(req)) return res.redirect('/ingresar.html?destino=/cuenta.html');
  next();
});

app.use(express.static(path.join(RAIZ, 'public'), { extensions: ['html'] }));

/* ---------------------------------------------------------------- cierre */

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Ese endpoint no existe.' });
  }
  res.status(404).sendFile(path.join(RAIZ, 'public', '404.html'));
});

app.use((err, req, res, next) => {
  console.error('[jartelier]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Algo se rompió del lado del servidor.' });
});

app.listen(PUERTO, () => {
  console.log('');
  console.log('  Jartelier andando');
  console.log('  Sitio    http://localhost:' + PUERTO);
  console.log('  Ingreso  http://localhost:' + PUERTO + '/ingresar.html');
  console.log('  Empresa  http://localhost:' + PUERTO + '/empresa.html');
  console.log('');
});
