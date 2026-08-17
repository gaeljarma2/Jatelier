/* Jartelier — modo empresa */

(function () {
  'use strict';

  const estado = {
    usuario: null,
    vehiculos: [],
    consultas: [],
    usuarios: [],
    filtroVehiculos: 'todo',
    filtroConsultas: 'todo',
    buscaVehiculos: '',
    buscaConsultas: '',
    editando: null, // vehículo abierto en el cajón
  };

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------ mensajito */
  const brindis = $('brindis');
  let relojBrindis;
  function decir(texto, mal = false) {
    brindis.textContent = texto;
    brindis.className = 'brindis ver' + (mal ? ' mal' : '');
    clearTimeout(relojBrindis);
    relojBrindis = setTimeout(() => (brindis.className = 'brindis'), 3200);
  }

  /* ------------------------------------------------------------ navegación */
  const vistas = ['resumen', 'vehiculos', 'consultas', 'usuarios', 'textos', 'ajustes'];

  function irA(vista) {
    vistas.forEach((v) => {
      $('vista-' + v).hidden = v !== vista;
    });
    document.querySelectorAll('#menu button').forEach((b) => {
      b.setAttribute('aria-current', b.dataset.vista === vista ? 'true' : 'false');
    });
    location.hash = vista;
    if (vista === 'consultas') cargarConsultas();
    if (vista === 'usuarios') cargarUsuarios();
    if (vista === 'textos') cargarTextos();
    if (vista === 'ajustes') cargarAjustes();
  }

  document.querySelectorAll('#menu button').forEach((b) => {
    b.addEventListener('click', () => irA(b.dataset.vista));
  });

  /* --------------------------------------------------------------- resumen */

  async function cargarResumen() {
    const { resumen } = await API.get('/api/admin/resumen');
    const fichas = [
      ['Vehículos', resumen.vehiculos],
      ['Disponibles', resumen.disponibles],
      ['Reservados', resumen.reservados],
      ['Vendidos', resumen.vendidos],
      ['Consultas nuevas', resumen.consultas_nuevas, resumen.consultas_nuevas > 0],
      ['Clientes', resumen.clientes],
    ];
    $('fichas').innerHTML = fichas
      .map(
        ([titulo, valor, alerta]) =>
          '<div class="ficha' + (alerta ? ' alerta' : '') + '"><dt>' + titulo + '</dt><dd>' + valor + '</dd></div>'
      )
      .join('');

    const globoC = $('globo-consultas');
    globoC.textContent = resumen.consultas_nuevas;
    globoC.hidden = resumen.consultas_nuevas === 0;

    const globoV = $('globo-vehiculos');
    globoV.textContent = resumen.vehiculos;
    globoV.hidden = false;

    const { consultas } = await API.get('/api/admin/consultas');
    estado.consultas = consultas;
    const ultimas = consultas.slice(0, 4);
    $('ultimas').innerHTML = ultimas.length
      ? ultimas.map(pintarConsulta).join('')
      : '<p class="vacio">Todavía no dejó su correo nadie</p>';
  }

  /* ------------------------------------------------------------- vehículos */

  const ETIQUETA_TIPO = { auto: 'Auto', moto: 'Moto', barco: 'Barco', otro: 'Otro' };

  async function cargarVehiculos() {
    $('cargando-vehiculos').hidden = false;
    const { vehiculos } = await API.get('/api/admin/vehiculos');
    estado.vehiculos = vehiculos;
    $('cargando-vehiculos').hidden = true;
    pintarVehiculos();
  }

  function vehiculosFiltrados() {
    const q = estado.buscaVehiculos.toLowerCase().trim();
    return estado.vehiculos.filter((v) => {
      if (estado.filtroVehiculos !== 'todo' && v.estado !== estado.filtroVehiculos) return false;
      if (!q) return true;
      return [v.titulo, v.subtitulo, v.descripcion, v.materiales, v.anio_modelo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }

  function pintarVehiculos() {
    const lista = vehiculosFiltrados();
    const cuerpo = $('tabla-vehiculos');

    if (!lista.length) {
      cuerpo.innerHTML =
        '<tr><td colspan="8"><p class="vacio" style="border:none">No hay vehículos que coincidan</p></td></tr>';
      return;
    }

    cuerpo.innerHTML = lista
      .map((v) => {
        const portada = v.fotos[0];
        const miniatura = portada
          ? '<img class="miniatura" src="' + portada.url + '" alt="">'
          : '<div class="miniatura vacia" style="background:' + escapar(v.color_placa) + '">sin foto</div>';
        const valor = v.precio ? precio(v.precio, v.moneda) : '—';
        return (
          '<tr data-id="' + v.id + '">' +
          '<td>' + miniatura + '</td>' +
          '<td class="celda-titulo"><b>' + escapar(tituloVehiculo(v)) + '</b>' +
            '<span>' + escapar(v.subtitulo || v.materiales || '') + '</span></td>' +
          '<td><span class="pill">' + (ETIQUETA_TIPO[v.tipo] || v.tipo) + '</span></td>' +
          '<td>' + selectorEstado(v) + '</td>' +
          '<td>' + valor + (v.precio && !v.mostrar_precio ? ' <span class="pill" style="opacity:.6">oculto</span>' : '') + '</td>' +
          '<td>' + v.fotos.length + '</td>' +
          '<td>' + v.orden + (v.destacado ? ' ★' : '') + '</td>' +
          '<td class="acciones-celda">' +
            '<button class="btn ghost chico" data-editar="' + v.id + '">Editar</button>' +
            '<button class="btn peligro chico" data-borrar="' + v.id + '">Borrar</button>' +
          '</td></tr>'
        );
      })
      .join('');
  }

  function selectorEstado(v) {
    const opciones = ['disponible', 'reservado', 'vendido', 'borrador'];
    return (
      '<select class="mini" data-estado="' + v.id + '">' +
      opciones
        .map(
          (o) =>
            '<option value="' + o + '"' + (o === v.estado ? ' selected' : '') + '>' + o + '</option>'
        )
        .join('') +
      '</select>'
    );
  }

  $('tabla-vehiculos').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar]');
    const borrar = e.target.closest('[data-borrar]');

    if (editar) {
      const v = estado.vehiculos.find((x) => x.id === Number(editar.dataset.editar));
      abrirCajon(v);
    }
    if (borrar) {
      const id = Number(borrar.dataset.borrar);
      const v = estado.vehiculos.find((x) => x.id === id);
      if (!confirm('¿Borrar «' + tituloVehiculo(v) + '»? Se van también sus fotos.')) return;
      try {
        await API.borrar('/api/admin/vehiculos/' + id);
        decir('Vehículo borrado');
        await cargarVehiculos();
        cargarResumen();
      } catch (err) {
        decir(err.message, true);
      }
    }
  });

  $('tabla-vehiculos').addEventListener('change', async (e) => {
    const selector = e.target.closest('[data-estado]');
    if (!selector) return;
    try {
      const { vehiculo } = await API.patch('/api/admin/vehiculos/' + selector.dataset.estado, {
        estado: selector.value,
      });
      const i = estado.vehiculos.findIndex((v) => v.id === vehiculo.id);
      if (i >= 0) estado.vehiculos[i] = vehiculo;
      decir('Estado actualizado');
      cargarResumen();
    } catch (err) {
      decir(err.message, true);
      cargarVehiculos();
    }
  });

  $('buscar-vehiculos').addEventListener('input', (e) => {
    estado.buscaVehiculos = e.target.value;
    pintarVehiculos();
  });

  document.querySelectorAll('[data-filtro-v]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filtro-v]').forEach((c) =>
        c.setAttribute('aria-pressed', c === chip ? 'true' : 'false')
      );
      estado.filtroVehiculos = chip.dataset.filtroV;
      pintarVehiculos();
    });
  });

  /* ------------------------------------------------- cajón de vehículo */

  const cajon = $('cajon');
  const avisoCajon = $('aviso-cajon');

  function limpiarFormulario() {
    ['v-id', 'v-titulo', 'v-anio', 'v-subtitulo', 'v-descripcion', 'v-largo', 'v-terminado', 'v-materiales', 'v-precio']
      .forEach((id) => ($(id).value = ''));
    $('v-escala').value = '1:8';
    $('v-tipo').value = 'auto';
    $('v-estado').value = 'disponible';
    $('v-moneda').value = 'ARS';
    $('v-orden').value = 0;
    $('v-color').value = '#5C161D';
    $('v-mostrar-precio').checked = false;
    $('v-destacado').checked = false;
    $('lista-caracteristicas').innerHTML = '';
    $('galeria').innerHTML = '';
    avisoCajon.hidden = true;
  }

  function abrirCajon(v) {
    limpiarFormulario();
    estado.editando = v || null;

    $('cajon-titulo').textContent = v ? 'Editar vehículo' : 'Nuevo vehículo';
    $('borrar-vehiculo').hidden = !v;
    $('nota-fotos').hidden = !!v;
    $('zona-fotos').style.display = v ? '' : 'none';

    if (v) {
      $('v-id').value = v.id;
      $('v-titulo').value = v.titulo || '';
      $('v-anio').value = v.anio_modelo || '';
      $('v-subtitulo').value = v.subtitulo || '';
      $('v-descripcion').value = v.descripcion || '';
      $('v-tipo').value = v.tipo;
      $('v-escala').value = v.escala || '1:8';
      $('v-largo').value = v.largo_mm ?? '';
      $('v-terminado').value = v.terminado_en || '';
      $('v-materiales').value = v.materiales || '';
      $('v-estado').value = v.estado;
      $('v-moneda').value = v.moneda;
      $('v-precio').value = v.precio ?? '';
      $('v-orden').value = v.orden;
      $('v-color').value = v.color_placa || '#5C161D';
      $('v-mostrar-precio').checked = !!v.mostrar_precio;
      $('v-destacado').checked = !!v.destacado;
      (v.caracteristicas || []).forEach((c) => agregarCaracteristica(c.etiqueta, c.valor));
      pintarGaleria(v.fotos);
    } else {
      // arranque cómodo: dos filas vacías
      agregarCaracteristica('Largo', '');
      agregarCaracteristica('Terminado en', '');
    }

    cajon.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('v-titulo').focus(), 60);
  }

  function cerrarCajon() {
    cajon.hidden = true;
    estado.editando = null;
    document.body.style.overflow = '';
  }

  $('btn-nuevo').addEventListener('click', () => abrirCajon(null));
  $('btn-nuevo-atajo').addEventListener('click', () => {
    irA('vehiculos');
    abrirCajon(null);
  });
  $('cerrar-cajon').addEventListener('click', cerrarCajon);
  $('cancelar-cajon').addEventListener('click', cerrarCajon);
  cajon.addEventListener('click', (e) => {
    if (e.target === cajon) cerrarCajon();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!cajon.hidden) cerrarCajon();
      if (!$('cajon-usuario').hidden) $('cajon-usuario').hidden = true;
    }
  });

  /* ------------------------------------------------ características libres */

  function agregarCaracteristica(etiqueta = '', valor = '') {
    const fila = document.createElement('div');
    fila.className = 'caracteristica';
    fila.innerHTML =
      '<input type="text" placeholder="Nombre (ej. Puertas)" value="' + escapar(etiqueta) + '">' +
      '<input type="text" placeholder="Valor (ej. abren)" value="' + escapar(valor) + '">' +
      '<button type="button" class="quitar" aria-label="Quitar">✕</button>';
    fila.querySelector('.quitar').addEventListener('click', () => fila.remove());
    $('lista-caracteristicas').appendChild(fila);
  }

  $('agregar-caracteristica').addEventListener('click', () => agregarCaracteristica());

  function leerCaracteristicas() {
    return Array.from($('lista-caracteristicas').children)
      .map((fila) => {
        const campos = fila.querySelectorAll('input');
        return { etiqueta: campos[0].value.trim(), valor: campos[1].value.trim() };
      })
      .filter((c) => c.etiqueta && c.valor);
  }

  /* -------------------------------------------------------- guardar ficha */

  $('guardar-vehiculo').addEventListener('click', async () => {
    const boton = $('guardar-vehiculo');
    const cuerpo = {
      titulo: $('v-titulo').value.trim(),
      anio_modelo: $('v-anio').value.trim(),
      subtitulo: $('v-subtitulo').value.trim(),
      descripcion: $('v-descripcion').value.trim(),
      tipo: $('v-tipo').value,
      escala: $('v-escala').value.trim(),
      largo_mm: $('v-largo').value,
      terminado_en: $('v-terminado').value.trim(),
      materiales: $('v-materiales').value.trim(),
      estado: $('v-estado').value,
      moneda: $('v-moneda').value,
      precio: $('v-precio').value,
      orden: $('v-orden').value,
      color_placa: $('v-color').value,
      mostrar_precio: $('v-mostrar-precio').checked,
      destacado: $('v-destacado').checked,
      caracteristicas: leerCaracteristicas(),
    };

    if (!cuerpo.titulo) {
      return avisar(avisoCajon, 'El vehículo necesita un título.', 'error');
    }

    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      const id = $('v-id').value;
      const datos = id
        ? await API.put('/api/admin/vehiculos/' + id, cuerpo)
        : await API.post('/api/admin/vehiculos', cuerpo);

      estado.editando = datos.vehiculo;
      $('v-id').value = datos.vehiculo.id;
      $('cajon-titulo').textContent = 'Editar vehículo';
      $('borrar-vehiculo').hidden = false;
      $('nota-fotos').hidden = true;
      $('zona-fotos').style.display = '';
      pintarGaleria(datos.vehiculo.fotos);

      await cargarVehiculos();
      cargarResumen();

      if (id) {
        decir('Cambios guardados');
        cerrarCajon();
      } else {
        avisar(avisoCajon, 'Vehículo creado. Ahora podés cargarle las fotos.', 'ok', 0);
        decir('Vehículo creado');
      }
    } catch (err) {
      avisar(avisoCajon, err.message, 'error', 0);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Guardar';
    }
  });

  $('borrar-vehiculo').addEventListener('click', async () => {
    const id = $('v-id').value;
    if (!id) return;
    if (!confirm('¿Borrar este vehículo y todas sus fotos?')) return;
    try {
      await API.borrar('/api/admin/vehiculos/' + id);
      cerrarCajon();
      decir('Vehículo borrado');
      await cargarVehiculos();
      cargarResumen();
    } catch (err) {
      decir(err.message, true);
    }
  });

  /* ---------------------------------------------------------------- fotos */

  function pintarGaleria(fotos) {
    const galeria = $('galeria');
    if (!fotos || !fotos.length) {
      galeria.innerHTML = '';
      return;
    }
    galeria.innerHTML = fotos
      .map(
        (f, i) =>
          '<figure>' +
          (i === 0 ? '<span class="portada">Portada</span>' : '') +
          '<img src="' + f.url + '" alt="' + escapar(f.alt || '') + '">' +
          '<figcaption>' +
          (i === 0 ? '' : '<button type="button" data-portada="' + f.id + '">Portada</button>') +
          '<button type="button" class="borrar" data-foto="' + f.id + '">Borrar</button>' +
          '</figcaption></figure>'
      )
      .join('');
  }

  $('galeria').addEventListener('click', async (e) => {
    const portada = e.target.closest('[data-portada]');
    const borrar = e.target.closest('[data-foto]');
    try {
      if (portada) {
        const { fotos } = await API.post('/api/admin/fotos/' + portada.dataset.portada + '/portada');
        pintarGaleria(fotos);
        decir('Portada cambiada');
        cargarVehiculos();
      }
      if (borrar) {
        if (!confirm('¿Borrar esta foto?')) return;
        const { fotos } = await API.borrar('/api/admin/fotos/' + borrar.dataset.foto);
        pintarGaleria(fotos);
        decir('Foto borrada');
        cargarVehiculos();
      }
    } catch (err) {
      decir(err.message, true);
    }
  });

  const zona = $('zona-fotos');
  const inputFotos = $('input-fotos');

  zona.addEventListener('click', () => inputFotos.click());
  zona.addEventListener('dragover', (e) => {
    e.preventDefault();
    zona.classList.add('encima');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('encima');
    subirFotos(e.dataTransfer.files);
  });
  inputFotos.addEventListener('change', () => {
    subirFotos(inputFotos.files);
    inputFotos.value = '';
  });

  async function subirFotos(archivos) {
    const id = $('v-id').value;
    if (!id) return avisar(avisoCajon, 'Guardá el vehículo antes de subir fotos.', 'error');
    if (!archivos || !archivos.length) return;

    const formulario = new FormData();
    Array.from(archivos).slice(0, 12).forEach((a) => formulario.append('fotos', a));

    zona.textContent = 'Subiendo…';
    try {
      const { fotos } = await API.subir('/api/admin/vehiculos/' + id + '/fotos', formulario);
      pintarGaleria(fotos);
      decir(archivos.length > 1 ? 'Fotos subidas' : 'Foto subida');
      cargarVehiculos();
    } catch (err) {
      avisar(avisoCajon, err.message, 'error', 0);
    } finally {
      zona.innerHTML =
        'Arrastrá las fotos acá o hacé clic para elegirlas<br><span style="opacity:.6">JPG, PNG o WEBP · hasta 8 MB cada una</span>';
    }
  }

  /* ------------------------------------------------------------ consultas */

  async function cargarConsultas() {
    const { consultas } = await API.get('/api/admin/consultas');
    estado.consultas = consultas;
    pintarConsultas();
  }

  function consultasFiltradas() {
    const q = estado.buscaConsultas.toLowerCase().trim();
    return estado.consultas.filter((c) => {
      if (estado.filtroConsultas !== 'todo' && c.estado !== estado.filtroConsultas) return false;
      if (!q) return true;
      return [c.nombre, c.email, c.mensaje, c.telefono, c.vehiculo_titulo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }

  function pintarConsulta(c) {
    const asunto = encodeURIComponent(
      'Jartelier · tu consulta' + (c.vehiculo_titulo ? ' por ' + c.vehiculo_titulo : '')
    );
    return (
      '<article class="consulta ' + c.estado + '" data-consulta="' + c.id + '">' +
      '<div class="consulta-top">' +
        '<div class="consulta-quien">' +
          '<b>' + escapar(c.nombre) + '</b>' +
          '<a href="mailto:' + escapar(c.email) + '?subject=' + asunto + '">' + escapar(c.email) + '</a>' +
          '<div class="meta">' + fecha(c.creado, true) +
            (c.telefono ? ' · ' + escapar(c.telefono) : '') +
            (c.vehiculo_titulo ? ' · por ' + escapar(c.vehiculo_titulo) : '') +
            (c.usuario_nombre ? ' · cuenta registrada' : '') +
          '</div>' +
        '</div>' +
        '<span class="pill ' + c.estado + '">' + c.estado + '</span>' +
      '</div>' +
      '<p class="consulta-mensaje">' + escapar(c.mensaje) + '</p>' +
      '<div class="consulta-pie">' +
        '<textarea placeholder="Nota interna (solo la ven ustedes)" data-nota="' + c.id + '">' +
          escapar(c.nota_interna || '') + '</textarea>' +
        '<select class="mini" data-estado-consulta="' + c.id + '">' +
          ['nueva', 'leida', 'contestada', 'cerrada']
            .map((e) => '<option value="' + e + '"' + (e === c.estado ? ' selected' : '') + '>' + e + '</option>')
            .join('') +
        '</select>' +
        '<button class="btn ghost chico" data-guardar-nota="' + c.id + '">Guardar nota</button>' +
        '<button class="btn peligro chico" data-borrar-consulta="' + c.id + '">Borrar</button>' +
      '</div></article>'
    );
  }

  function pintarConsultas() {
    const lista = consultasFiltradas();
    $('lista-consultas').innerHTML = lista.length
      ? lista.map(pintarConsulta).join('')
      : '<p class="vacio">No hay consultas que coincidan</p>';
  }

  $('buscar-consultas').addEventListener('input', (e) => {
    estado.buscaConsultas = e.target.value;
    pintarConsultas();
  });

  document.querySelectorAll('[data-filtro-c]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filtro-c]').forEach((c) =>
        c.setAttribute('aria-pressed', c === chip ? 'true' : 'false')
      );
      estado.filtroConsultas = chip.dataset.filtroC;
      pintarConsultas();
    });
  });

  async function actualizarConsulta(id, cambios) {
    const { consulta } = await API.patch('/api/admin/consultas/' + id, cambios);
    const i = estado.consultas.findIndex((c) => c.id === consulta.id);
    if (i >= 0) estado.consultas[i] = { ...estado.consultas[i], ...consulta };
    return consulta;
  }

  document.addEventListener('click', async (e) => {
    const guardar = e.target.closest('[data-guardar-nota]');
    const borrar = e.target.closest('[data-borrar-consulta]');

    if (guardar) {
      const id = guardar.dataset.guardarNota;
      const nota = document.querySelector('[data-nota="' + id + '"]').value;
      try {
        await actualizarConsulta(id, { nota_interna: nota });
        decir('Nota guardada');
      } catch (err) {
        decir(err.message, true);
      }
    }

    if (borrar) {
      if (!confirm('¿Borrar esta consulta?')) return;
      try {
        await API.borrar('/api/admin/consultas/' + borrar.dataset.borrarConsulta);
        estado.consultas = estado.consultas.filter(
          (c) => c.id !== Number(borrar.dataset.borrarConsulta)
        );
        pintarConsultas();
        cargarResumen();
        decir('Consulta borrada');
      } catch (err) {
        decir(err.message, true);
      }
    }
  });

  document.addEventListener('change', async (e) => {
    const selector = e.target.closest('[data-estado-consulta]');
    if (!selector) return;
    try {
      await actualizarConsulta(selector.dataset.estadoConsulta, { estado: selector.value });
      const tarjeta = selector.closest('.consulta');
      if (tarjeta) {
        tarjeta.className = 'consulta ' + selector.value;
        const pill = tarjeta.querySelector('.pill');
        if (pill) {
          pill.className = 'pill ' + selector.value;
          pill.textContent = selector.value;
        }
      }
      decir('Consulta marcada como ' + selector.value);
      cargarResumen();
    } catch (err) {
      decir(err.message, true);
    }
  });

  $('copiar-mails').addEventListener('click', async () => {
    const mails = [...new Set(consultasFiltradas().map((c) => c.email))].join(', ');
    if (!mails) return decir('No hay correos para copiar', true);
    try {
      await navigator.clipboard.writeText(mails);
      decir('Copiados ' + mails.split(',').length + ' correos');
    } catch {
      prompt('Copiá los correos a mano:', mails);
    }
  });

  /* ------------------------------------------------------------- usuarios */

  async function cargarUsuarios() {
    const { usuarios } = await API.get('/api/admin/usuarios');
    estado.usuarios = usuarios;
    $('tabla-usuarios').innerHTML = usuarios
      .map(
        (u) =>
          '<tr>' +
          '<td><b style="font-weight:600">' + escapar(u.nombre) + '</b>' +
            (u.activo ? '' : ' <span class="pill" style="color:var(--rojo)">inactivo</span>') + '</td>' +
          '<td><a href="mailto:' + escapar(u.email) + '" style="color:var(--rojo)">' + escapar(u.email) + '</a></td>' +
          '<td>' + escapar(u.telefono || '—') + '</td>' +
          '<td><select class="mini" data-rol="' + u.id + '">' +
            '<option value="cliente"' + (u.rol === 'cliente' ? ' selected' : '') + '>cliente</option>' +
            '<option value="admin"' + (u.rol === 'admin' ? ' selected' : '') + '>vendedor</option>' +
          '</select></td>' +
          '<td>' + u.consultas + '</td>' +
          '<td>' + fecha(u.creado) + '</td>' +
          '<td class="acciones-celda">' +
            '<button class="btn ghost chico" data-clave-usuario="' + u.id + '">Clave</button>' +
            (u.id === estado.usuario.id
              ? ''
              : '<button class="btn peligro chico" data-borrar-usuario="' + u.id + '">Borrar</button>') +
          '</td></tr>'
      )
      .join('');
  }

  $('tabla-usuarios').addEventListener('change', async (e) => {
    const rol = e.target.closest('[data-rol]');
    if (!rol) return;
    try {
      await API.patch('/api/admin/usuarios/' + rol.dataset.rol, { rol: rol.value });
      decir('Rol actualizado');
      cargarUsuarios();
      cargarResumen();
    } catch (err) {
      decir(err.message, true);
      cargarUsuarios();
    }
  });

  $('tabla-usuarios').addEventListener('click', async (e) => {
    const clave = e.target.closest('[data-clave-usuario]');
    const borrar = e.target.closest('[data-borrar-usuario]');

    if (clave) {
      const nueva = prompt('Contraseña nueva (mínimo 8 caracteres, con letras y números):');
      if (!nueva) return;
      try {
        await API.patch('/api/admin/usuarios/' + clave.dataset.claveUsuario, { clave: nueva });
        decir('Contraseña cambiada');
      } catch (err) {
        decir(err.message, true);
      }
    }

    if (borrar) {
      if (!confirm('¿Borrar esta cuenta? Las consultas que dejó quedan guardadas.')) return;
      try {
        await API.borrar('/api/admin/usuarios/' + borrar.dataset.borrarUsuario);
        decir('Cuenta borrada');
        cargarUsuarios();
        cargarResumen();
      } catch (err) {
        decir(err.message, true);
      }
    }
  });

  const cajonUsuario = $('cajon-usuario');
  $('btn-nuevo-usuario').addEventListener('click', () => {
    ['u-nombre', 'u-email', 'u-telefono', 'u-clave'].forEach((id) => ($(id).value = ''));
    $('u-rol').value = 'admin';
    $('aviso-usuario').hidden = true;
    cajonUsuario.hidden = false;
  });
  $('cerrar-usuario').addEventListener('click', () => (cajonUsuario.hidden = true));
  $('cancelar-usuario').addEventListener('click', () => (cajonUsuario.hidden = true));
  cajonUsuario.addEventListener('click', (e) => {
    if (e.target === cajonUsuario) cajonUsuario.hidden = true;
  });

  $('guardar-usuario').addEventListener('click', async () => {
    const cuerpo = {
      nombre: $('u-nombre').value.trim(),
      email: $('u-email').value.trim(),
      telefono: $('u-telefono').value.trim(),
      clave: $('u-clave').value,
      rol: $('u-rol').value,
    };
    try {
      await API.post('/api/admin/usuarios', cuerpo);
      cajonUsuario.hidden = true;
      decir('Cuenta creada');
      cargarUsuarios();
      cargarResumen();
    } catch (err) {
      avisar($('aviso-usuario'), err.message, 'error', 0);
    }
  });

  /* ------------------------------------------------------ textos del sitio */

  let textosCargados = false;

  async function cargarTextos(forzar = false) {
    if (textosCargados && !forzar) return;
    const { grupos, valores, defectos } = await API.get('/api/admin/textos');
    estado.defectosTextos = defectos;

    $('grupos-textos').innerHTML = grupos.map(pintarGrupo).join('');
    textosCargados = true;

    // el primer grupo arranca abierto
    const primero = document.querySelector('.grupo-texto');
    if (primero) primero.classList.add('abierto');

    function pintarGrupo(grupo) {
      const filas = grupo.campos
        .map((campo) => {
          const valor = valores[campo.clave] !== undefined ? valores[campo.clave] : campo.defecto;
          const control =
            campo.tipo === 'area'
              ? '<textarea data-clave="' + campo.clave + '" rows="' +
                (String(valor).length > 220 ? 6 : 3) + '">' + escapar(valor) + '</textarea>'
              : '<input type="text" data-clave="' + campo.clave + '" value="' + escapar(valor) + '">';

          return (
            '<div class="fila-texto" data-fila="' + campo.clave + '">' +
              '<div class="encabezado-campo">' +
                '<label for="' + campo.clave + '">' + escapar(campo.etiqueta) + '</label>' +
                '<button type="button" class="restaurar" data-restaurar="' + campo.clave + '">Volver al original</button>' +
              '</div>' +
              control +
              (campo.ayuda ? '<p class="ayuda-campo">' + escapar(campo.ayuda) + '</p>' : '') +
            '</div>'
          );
        })
        .join('');

      return (
        '<section class="grupo-texto" data-grupo="' + grupo.id + '">' +
          '<button type="button" class="grupo-cab">' +
            '<span><h3>' + escapar(grupo.titulo) + '</h3>' +
              (grupo.ayuda ? '<p>' + escapar(grupo.ayuda) + '</p>' : '') + '</span>' +
            '<span style="display:flex;align-items:center;gap:10px">' +
              '<span class="cambios" hidden>sin guardar</span>' +
              '<span class="flecha">›</span>' +
            '</span>' +
          '</button>' +
          '<div class="grupo-cuerpo">' + filas + '</div>' +
        '</section>'
      );
    }
  }

  /* abrir y cerrar los bloques */
  $('grupos-textos').addEventListener('click', async (e) => {
    const cabecera = e.target.closest('.grupo-cab');
    if (cabecera) {
      cabecera.closest('.grupo-texto').classList.toggle('abierto');
      return;
    }

    const restaurar = e.target.closest('[data-restaurar]');
    if (restaurar) {
      const clave = restaurar.dataset.restaurar;
      if (!confirm('¿Volver este texto a como venía de fábrica?')) return;
      try {
        const { valor } = await API.post('/api/admin/textos/restaurar', { clave });
        const control = document.querySelector('[data-clave="' + clave + '"]');
        if (control) {
          control.value = valor;
          control.closest('.fila-texto').classList.remove('tocado');
          marcarGrupos();
        }
        decir('Texto restaurado');
      } catch (err) {
        decir(err.message, true);
      }
    }
  });

  /* marcar lo que cambió pero todavía no se guardó */
  $('grupos-textos').addEventListener('input', (e) => {
    const control = e.target.closest('[data-clave]');
    if (!control) return;
    control.closest('.fila-texto').classList.add('tocado');
    marcarGrupos();
  });

  function marcarGrupos() {
    document.querySelectorAll('.grupo-texto').forEach((grupo) => {
      const globo = grupo.querySelector('.cambios');
      globo.hidden = !grupo.querySelector('.fila-texto.tocado');
    });
  }

  $('guardar-textos').addEventListener('click', async () => {
    const boton = $('guardar-textos');
    const cuerpo = {};
    document.querySelectorAll('#grupos-textos [data-clave]').forEach((control) => {
      cuerpo[control.dataset.clave] = control.value;
    });

    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      await API.put('/api/admin/textos', cuerpo);
      document.querySelectorAll('.fila-texto.tocado').forEach((f) => f.classList.remove('tocado'));
      marcarGrupos();
      avisar($('aviso-textos'), 'Listo. Actualizá la página del sitio para verlo.', 'ok');
      decir('Textos guardados');
    } catch (err) {
      avisar($('aviso-textos'), err.message, 'error', 0);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Guardar todos los cambios';
    }
  });

  /* ------------------------------------------------------------ mi cuenta */

  async function cargarAjustes() {
    const { ajustes } = await API.get('/api/admin/ajustes');
    $('a-registro').checked = ajustes.registro_abierto === '1';
  }

  $('guardar-registro').addEventListener('click', async () => {
    try {
      await API.put('/api/admin/textos', { registro_abierto: $('a-registro').checked ? 1 : 0 });
      avisar($('aviso-registro'), 'Guardado.', 'ok');
      decir('Guardado');
    } catch (err) {
      avisar($('aviso-registro'), err.message, 'error', 0);
    }
  });

  $('form-clave').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.post('/api/auth/clave', {
        actual: $('c-actual').value,
        nueva: $('c-nueva').value,
      });
      $('c-actual').value = '';
      $('c-nueva').value = '';
      avisar($('aviso-clave'), 'Contraseña cambiada.', 'ok');
    } catch (err) {
      avisar($('aviso-clave'), err.message, 'error', 0);
    }
  });

  /* --------------------------------------------------------------- salida */

  $('salir').addEventListener('click', cerrarSesion);

  /* -------------------------------------------------------------- arranque */

  (async function arrancar() {
    const u = await sesion();
    if (!u || u.rol !== 'admin') {
      location.href = '/ingresar.html?destino=/empresa.html';
      return;
    }
    estado.usuario = u;
    $('yo').innerHTML =
      '<b>' + escapar(u.nombre) + '</b>' + escapar(u.email) + '<br>Vendedor';
    $('saludo').textContent = 'Hola ' + u.nombre.split(' ')[0] + '. Esto es lo que hay hoy en el taller.';

    await cargarVehiculos();
    await cargarResumen();

    const inicial = location.hash.replace('#', '');
    irA(vistas.includes(inicial) ? inicial : 'resumen');
  })();
})();
