/* Jartelier — utilidades compartidas por todas las pantallas */

const API = {
  async pedir(ruta, opciones = {}) {
    const config = { credentials: 'same-origin', headers: {}, ...opciones };
    if (config.cuerpo !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(config.cuerpo);
      delete config.cuerpo;
    }
    const respuesta = await fetch(ruta, config);
    let datos = null;
    const tipo = respuesta.headers.get('content-type') || '';
    if (tipo.includes('application/json')) {
      datos = await respuesta.json().catch(() => null);
    }
    if (!respuesta.ok) {
      const error = new Error((datos && datos.error) || 'No se pudo completar la operación.');
      error.estado = respuesta.status;
      throw error;
    }
    return datos;
  },
  get(ruta) {
    return API.pedir(ruta);
  },
  post(ruta, cuerpo) {
    return API.pedir(ruta, { method: 'POST', cuerpo });
  },
  put(ruta, cuerpo) {
    return API.pedir(ruta, { method: 'PUT', cuerpo });
  },
  patch(ruta, cuerpo) {
    return API.pedir(ruta, { method: 'PATCH', cuerpo });
  },
  borrar(ruta) {
    return API.pedir(ruta, { method: 'DELETE' });
  },
  async subir(ruta, formData) {
    const respuesta = await fetch(ruta, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    });
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw new Error((datos && datos.error) || 'No se pudo subir el archivo.');
    return datos;
  },
};

/** Sesión actual (o null). Se cachea para no pedirla en cada pantalla. */
let _sesion;
async function sesion(forzar = false) {
  if (_sesion === undefined || forzar) {
    try {
      const datos = await API.get('/api/auth/yo');
      _sesion = datos.usuario;
    } catch {
      _sesion = null;
    }
  }
  return _sesion;
}

async function cerrarSesion() {
  await API.post('/api/auth/salida');
  _sesion = null;
  location.href = '/';
}

/* -------------------------------------------------------------- formatos */

function escapar(texto) {
  const d = document.createElement('div');
  d.textContent = texto == null ? '' : String(texto);
  return d.innerHTML;
}

function fecha(iso, conHora = false) {
  if (!iso) return '—';
  // SQLite guarda "YYYY-MM-DD HH:MM:SS" en UTC
  const d = new Date(String(iso).replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  if (isNaN(d)) return iso;
  const opciones = conHora
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return d.toLocaleString('es-AR', opciones);
}

const SIMBOLOS = { ARS: '$', USD: 'US$', EUR: '€' };

function precio(valor, moneda) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return (SIMBOLOS[moneda] || '$') + ' ' + numero;
}

/** Título completo del vehículo, con el año si lo tiene. */
function tituloVehiculo(v) {
  return v.anio_modelo ? v.titulo + ' ' + v.anio_modelo : v.titulo;
}

/** Muestra un aviso en un elemento y lo limpia solo. */
function avisar(elemento, mensaje, tipo = 'ok', segundos = 5) {
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.className = 'aviso ' + tipo;
  elemento.hidden = false;
  clearTimeout(elemento._reloj);
  if (segundos) {
    elemento._reloj = setTimeout(() => {
      elemento.hidden = true;
    }, segundos * 1000);
  }
}

/** Barra superior con el estado de la sesión, común a todas las páginas. */
async function pintarAccionesTop(contenedor, rotuloIngresar) {
  if (!contenedor) return;
  const u = await sesion();
  if (!u) {
    contenedor.innerHTML =
      '<a class="btn ghost chico" href="/ingresar.html">' + escapar(rotuloIngresar || 'Ingresar') + '</a>';
    return;
  }
  const panel =
    u.rol === 'admin' ? '<a class="btn chico" href="/empresa.html">Modo empresa</a>' : '';
  contenedor.innerHTML =
    '<span class="quien">' + escapar(u.nombre.split(' ')[0]) + '</span>' +
    '<a class="btn ghost chico" href="/cuenta.html">Mi cuenta</a>' +
    panel +
    '<button class="btn ghost chico" id="btn-salir">Salir</button>';
  const salir = document.getElementById('btn-salir');
  if (salir) salir.addEventListener('click', cerrarSesion);
}
