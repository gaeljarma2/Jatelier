/* Jartelier — sitio público */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const estado = {
    vehiculos: [],
    filtro: 'todo',
    favoritos: [],
    usuario: null,
    abierto: null,
    textos: {},
  };

  const VIEWBOX = { auto: '120 165 905 260', moto: '20 30 350 210', barco: '15 35 325 140', otro: '120 165 905 260' };
  const SIMBOLO = { auto: 'coupe', moto: 'moto', barco: 'barco', otro: 'coupe' };
  const GROSOR = { auto: 10, moto: 4, barco: 5, otro: 10 };
  const TIPO = { auto: 'Auto', moto: 'Moto', barco: 'Barco', otro: 'Pieza' };
  const ESTADO = { disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido' };

  function silueta(v, grosor) {
    return (
      '<svg viewBox="' + VIEWBOX[v.tipo] + '" aria-hidden="true">' +
      '<use href="#' + SIMBOLO[v.tipo] + '" stroke-width="' + (grosor || GROSOR[v.tipo]) + '"/></svg>'
    );
  }

  /* -------------------------------------------------------------- textos */

  /** *palabra* -> resaltada; el resto va escapado. */
  function resaltar(texto) {
    return escapar(texto).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  /** Para títulos: cada renglón es un <br>. */
  function comoTitulo(texto) {
    return resaltar(texto).split('\n').join('<br>');
  }

  function pintarTextos(textos) {
    estado.textos = textos;

    document.querySelectorAll('[data-txt]').forEach((el) => {
      const valor = textos[el.dataset.txt];
      if (valor !== undefined && String(valor).trim() !== '') el.textContent = valor;
    });

    document.querySelectorAll('[data-txt-titulo]').forEach((el) => {
      const valor = textos[el.dataset.txtTitulo];
      if (valor && String(valor).trim() !== '') el.innerHTML = comoTitulo(valor);
    });

    document.querySelectorAll('[data-txt-parrafos]').forEach((el) => {
      const valor = textos[el.dataset.txtParrafos];
      if (!valor) return;
      el.innerHTML = String(valor)
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => '<p>' + resaltar(p).split('\n').join('<br>') + '</p>')
        .join('');
    });

    if (textos.sitio_titular) {
      document.title = textos.sitio_titular + ' — Autos y motos a escala 1:8, hechos a mano en la Patagonia';
    }

    pintarContacto(textos);
    pintarInventario(textos);
  }

  function pintarContacto(t) {
    const enlaces = [];
    if (t.contacto_email) {
      enlaces.push(['mailto:' + t.contacto_email, t.contacto_email]);
    }
    if (t.contacto_whatsapp) {
      const numero = String(t.contacto_whatsapp).replace(/[^0-9]/g, '');
      if (numero) enlaces.push(['https://wa.me/' + numero, 'WhatsApp']);
    }
    if (t.contacto_instagram) {
      const usuario = String(t.contacto_instagram).replace('@', '').trim();
      if (usuario) enlaces.push(['https://instagram.com/' + usuario, 'Instagram']);
    }
    $('pie-contacto').innerHTML = enlaces
      .map(([url, texto]) => '<a href="' + escapar(url) + '" target="_blank" rel="noopener">' + escapar(texto) + '</a>')
      .join('');
  }

  /* La grilla de siluetas: la cantidad se configura desde el panel. */
  function pintarInventario(t) {
    const entero = (valor, porDefecto) => {
      const n = parseInt(valor, 10);
      return Number.isFinite(n) && n >= 0 ? Math.min(n, 120) : porDefecto;
    };
    const plan = [
      ['auto', entero(t.coleccion_autos, 20), 'Autos'],
      ['moto', entero(t.coleccion_motos, 10), 'Motos'],
      ['barco', entero(t.coleccion_barcos, 2), 'Barcos'],
    ];

    let html = '';
    plan.forEach(([tipo, cantidad, rotulo]) => {
      for (let i = 0; i < cantidad; i++) {
        html +=
          '<div class="tile ' + tipo + '">' +
          '<svg viewBox="' + VIEWBOX[tipo] + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
          '<use href="#' + SIMBOLO[tipo] + '" fill="none" stroke="currentColor" stroke-width="' +
          (tipo === 'auto' ? 14 : 5) + '"/></svg><b>' + rotulo + '</b></div>';
      }
    });
    $('tally').innerHTML = html;
  }

  /* ------------------------------------------------------------ catálogo */

  async function cargarVehiculos() {
    try {
      const { vehiculos } = await API.get('/api/vehiculos');
      estado.vehiculos = vehiculos;
    } catch {
      estado.vehiculos = [];
    }
    $('cargando').hidden = true;
    pintarModelos();
    llenarSelector();

    $('actualizado').textContent =
      'Actualizado en ' + new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  function tarjeta(v) {
    const foto = v.fotos[0];
    const placa = foto
      ? '<div class="plate con-foto" style="background:' + escapar(v.color_placa) + '">' +
        '<span class="tag">' + TIPO[v.tipo] + ' · ' + escapar(v.escala) + '</span>' +
        '<img src="' + foto.url + '" alt="' + escapar(foto.alt || tituloVehiculo(v)) + '" loading="lazy"></div>'
      : '<div class="plate sin-foto" style="background:' + escapar(v.color_placa) + '">' +
        '<span class="tag">' + TIPO[v.tipo] + ' · ' + escapar(v.escala) + '</span>' + silueta(v) + '</div>';

    const specs = (v.caracteristicas || [])
      .slice(0, 4)
      .map((c) => '<div><dt>' + escapar(c.etiqueta) + '</dt><dd>' + escapar(c.valor) + '</dd></div>')
      .join('');

    const valor = v.mostrar_precio && v.precio ? precio(v.precio, v.moneda) : '';

    return (
      '<button class="card reveal in" type="button" data-t="' + v.tipo + '" data-id="' + v.id + '">' +
      placa +
      '<div class="card-body">' +
        '<h3>' + escapar(v.titulo) + (v.anio_modelo ? '<br>' + escapar(v.anio_modelo) : '') + '</h3>' +
        (v.subtitulo ? '<p class="sub">' + escapar(v.subtitulo) + '</p>' : '') +
        (specs ? '<dl class="specs">' + specs + '</dl>' : '<div style="margin:16px 0 20px"></div>') +
        '<div class="foot">' +
          '<span class="estado ' + v.estado + '">' + (ESTADO[v.estado] || v.estado) + '</span>' +
          (valor ? '<span class="valor">' + valor + '</span>' : '<span class="link">Ver ficha</span>') +
        '</div>' +
      '</div></button>'
    );
  }

  function pintarModelos() {
    const lista = estado.vehiculos.filter((v) => estado.filtro === 'todo' || v.tipo === estado.filtro);
    $('models').innerHTML = lista.length
      ? lista.map(tarjeta).join('')
      : '<p class="vacio" style="grid-column:1/-1">' +
        escapar(estado.textos.catalogo_vacio || 'Por ahora no hay nada en esta categoría') + '</p>';

    if (estado.vehiculos.some((v) => v.tipo === 'barco')) {
      const chip = document.querySelector('[data-f="barco"]');
      if (chip) chip.hidden = false;
    }
  }

  function llenarSelector() {
    const disponibles = estado.vehiculos.filter((v) => v.estado !== 'vendido');
    $('v').innerHTML =
      '<option value="">Un encargo nuevo / todavía no sé</option>' +
      disponibles.map((v) => '<option value="' + v.id + '">' + escapar(tituloVehiculo(v)) + '</option>').join('');
  }

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) =>
        c.setAttribute('aria-pressed', c === chip ? 'true' : 'false')
      );
      estado.filtro = chip.dataset.f;
      pintarModelos();
    });
  });

  $('models').addEventListener('click', (e) => {
    const tarjeta = e.target.closest('[data-id]');
    if (tarjeta) abrirFicha(Number(tarjeta.dataset.id));
  });

  /* --------------------------------------------------------------- ficha */

  const ficha = $('ficha');

  function abrirFicha(id) {
    const v = estado.vehiculos.find((x) => x.id === id);
    if (!v) return;
    estado.abierto = v;

    $('ficha-titulo').textContent = tituloVehiculo(v);
    $('ficha-sub').textContent = [TIPO[v.tipo], 'escala ' + v.escala, v.subtitulo, ESTADO[v.estado]]
      .filter(Boolean)
      .join(' · ');

    const valor = v.mostrar_precio && v.precio ? precio(v.precio, v.moneda) : null;
    $('ficha-precio').textContent = valor || '';
    $('ficha-precio').hidden = !valor;

    $('ficha-descripcion').textContent = v.descripcion || '';

    const yaEstan = new Set((v.caracteristicas || []).map((c) => c.etiqueta.trim().toLowerCase()));
    const filas = (v.caracteristicas || []).map((c) => [c.etiqueta, c.valor]);
    if (v.largo_mm && !yaEstan.has('largo')) filas.push(['Largo', v.largo_mm + ' mm']);
    if (v.terminado_en && !yaEstan.has('terminado en')) filas.push(['Terminado en', v.terminado_en]);
    if (v.materiales && !yaEstan.has('materiales')) filas.push(['Materiales', v.materiales]);

    $('ficha-specs').innerHTML = filas
      .map(([a, b]) => '<div><dt>' + escapar(a) + '</dt><dd>' + escapar(b) + '</dd></div>')
      .join('');

    pintarVisor(v, 0);
    $('ficha-favorito').hidden = !estado.usuario;
    marcarFavorito(v.id);

    ficha.hidden = false;
    document.body.style.overflow = 'hidden';
    $('cerrar-ficha').focus();
  }

  function pintarVisor(v, indice) {
    if (v.fotos.length) {
      const f = v.fotos[indice] || v.fotos[0];
      $('visor').style.background = v.color_placa;
      $('visor').innerHTML = '<img src="' + f.url + '" alt="' + escapar(f.alt || tituloVehiculo(v)) + '">';
      $('tiras').innerHTML =
        v.fotos.length > 1
          ? v.fotos
              .map((foto, i) =>
                '<img src="' + foto.url + '" alt="" data-i="' + i + '"' + (i === indice ? ' class="activa"' : '') + '>'
              )
              .join('')
          : '';
    } else {
      $('visor').style.background = v.color_placa;
      $('visor').innerHTML = silueta(v, v.tipo === 'auto' ? 8 : 4);
      $('tiras').innerHTML = '';
    }
  }

  $('tiras').addEventListener('click', (e) => {
    const mini = e.target.closest('[data-i]');
    if (mini && estado.abierto) pintarVisor(estado.abierto, Number(mini.dataset.i));
  });

  function cerrarFicha() {
    ficha.hidden = true;
    estado.abierto = null;
    document.body.style.overflow = '';
  }

  $('cerrar-ficha').addEventListener('click', cerrarFicha);
  ficha.addEventListener('click', (e) => {
    if (e.target === ficha) cerrarFicha();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ficha.hidden) cerrarFicha();
  });

  $('ficha-consultar').addEventListener('click', () => {
    const v = estado.abierto;
    cerrarFicha();
    if (v) {
      $('v').value = String(v.id);
      $('a').value = 'Quiero saber más sobre ' + tituloVehiculo(v) + '. ';
    }
    $('encargo').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('a').focus(), 500);
  });

  /* ----------------------------------------------------------- favoritos */

  function marcarFavorito(id) {
    const boton = $('ficha-favorito');
    const guardado = estado.favoritos.includes(id);
    boton.textContent = guardado ? '♥ Guardado' : '♥ Guardar';
    boton.classList.toggle('ghost', !guardado);
  }

  $('ficha-favorito').addEventListener('click', async () => {
    if (!estado.abierto) return;
    try {
      const { favorito } = await API.post('/api/favoritos/' + estado.abierto.id);
      if (favorito) estado.favoritos.push(estado.abierto.id);
      else estado.favoritos = estado.favoritos.filter((x) => x !== estado.abierto.id);
      marcarFavorito(estado.abierto.id);
    } catch (err) {
      alert(err.message);
    }
  });

  /* ------------------------------------------------------------ consulta */

  $('form-consulta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = $('enviar');
    const respuesta = $('respuesta');
    const cuerpo = {
      nombre: $('n').value.trim(),
      email: $('e').value.trim(),
      telefono: $('t').value.trim(),
      mensaje: $('a').value.trim(),
      vehiculo_id: $('v').value || null,
    };

    const fallar = (mensaje) => {
      respuesta.className = 'reply mal';
      respuesta.textContent = mensaje;
    };

    if (!cuerpo.nombre || !cuerpo.email) return fallar('Falta el nombre o el correo');
    if (cuerpo.mensaje.length < 4) return fallar('Contanos qué estás buscando');

    const rotulo = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      await API.post('/api/consultas', cuerpo);
      respuesta.className = 'reply';
      respuesta.textContent = estado.textos.encargo_gracias || 'Consulta enviada · te contestamos en unos días';
      $('a').value = '';
      $('v').value = '';
    } catch (err) {
      fallar(err.message);
    } finally {
      boton.disabled = false;
      boton.textContent = rotulo;
    }
  });

  /* ----------------------------------------------------------- revelados */

  function revelar() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = document.querySelectorAll('.reveal:not(.in)');
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('in');
            io.unobserve(entrada.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    items.forEach((el, i) => {
      el.style.transitionDelay = (i % 3) * 70 + 'ms';
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------ arranque */

  (async function arrancar() {
    try {
      pintarTextos(await API.get('/api/ajustes'));
    } catch {
      pintarContacto({});
      pintarInventario({});
    }

    await cargarVehiculos();
    revelar();

    const u = await sesion();
    estado.usuario = u;
    await pintarAccionesTop($('top-acciones'), estado.textos.btn_ingresar);

    if (u) {
      $('n').value = u.nombre;
      $('e').value = u.email;
      if (u.telefono) $('t').value = u.telefono;
      try {
        const { favoritos } = await API.get('/api/favoritos');
        estado.favoritos = favoritos;
      } catch {
        /* sin favoritos */
      }
    }

    const pedido = new URLSearchParams(location.search).get('vehiculo');
    if (pedido) abrirFicha(Number(pedido));
  })();
})();
