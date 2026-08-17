'use strict';

/**
 * Todos los textos editables del sitio, agrupados igual que las secciones de
 * la página. El panel de empresa arma el formulario leyendo esto, así que
 * sumar un texto nuevo es sumar una línea acá.
 *
 * tipo: 'texto' -> una línea
 *       'area'  -> varias líneas (un renglón en blanco separa párrafos)
 */

const GRUPOS = [
  {
    id: 'encabezado',
    titulo: 'Encabezado',
    ayuda: 'La barra de arriba, presente en todas las pantallas.',
    campos: [
      { clave: 'sitio_titular', etiqueta: 'Nombre del taller', tipo: 'texto', defecto: 'Jartelier' },
      { clave: 'nav_1', etiqueta: 'Menú · primer link', tipo: 'texto', defecto: 'La colección' },
      { clave: 'nav_2', etiqueta: 'Menú · segundo link', tipo: 'texto', defecto: 'Autos y motos' },
      { clave: 'nav_3', etiqueta: 'Menú · tercer link', tipo: 'texto', defecto: 'Quién los hace' },
      { clave: 'nav_4', etiqueta: 'Menú · cuarto link', tipo: 'texto', defecto: 'Encargos' },
      { clave: 'btn_ingresar', etiqueta: 'Botón de ingreso', tipo: 'texto', defecto: 'Ingresar' },
    ],
  },
  {
    id: 'apertura',
    titulo: 'Apertura',
    ayuda:
      'Lo primero que se ve al entrar. En el título grande, cada renglón que escribas es un renglón en la página, y lo que pongas *entre asteriscos* sale en rojo.',
    campos: [
      {
        clave: 'hero_etiqueta',
        etiqueta: 'Línea chica de arriba',
        tipo: 'texto',
        defecto: 'Taller de una sola persona · Patagonia argentina',
      },
      {
        clave: 'hero_titulo',
        etiqueta: 'Título grande',
        tipo: 'area',
        ayuda: 'Un renglón por línea. Lo que va *entre asteriscos* sale en rojo.',
        defecto: 'Más de 30\nterminados.\n*Todos\na mano*',
      },
      {
        clave: 'hero_texto',
        etiqueta: 'Texto de apertura',
        tipo: 'area',
        defecto:
          'Autos y motos a escala 1:8 diseñados y construidos en la Patagonia. Toda una vida perfeccionando cada detalle. Hay +30 vehículos terminados, guardados en la casa donde se hicieron.',
      },
      { clave: 'hero_boton_1', etiqueta: 'Botón principal', tipo: 'texto', defecto: 'Ver los que están listos' },
      { clave: 'hero_boton_2', etiqueta: 'Botón secundario', tipo: 'texto', defecto: 'Conocer al que los hace' },
      {
        clave: 'hero_epigrafe',
        etiqueta: 'Epígrafe de la franja · izquierda',
        tipo: 'texto',
        ayuda: 'La línea chica debajo de la franja de apertura.',
        defecto: 'Hechos a mano, uno por vez, en el sur',
      },
      {
        clave: 'hero_epigrafe_der',
        etiqueta: 'Epígrafe de la franja · derecha',
        tipo: 'texto',
        defecto: 'Escala 1:8 · todos únicos',
      },
    ],
  },
  {
    id: 'cifras',
    titulo: 'Los tres números',
    ayuda: 'La tira de cifras que va debajo de la apertura.',
    campos: [
      { clave: 'cifra_1_valor', etiqueta: 'Primera cifra', tipo: 'texto', defecto: '+30' },
      { clave: 'cifra_1_rotulo', etiqueta: 'Primera · qué dice al lado', tipo: 'texto', defecto: 'Vehículos terminados' },
      { clave: 'cifra_2_valor', etiqueta: 'Segunda cifra', tipo: 'texto', defecto: '40' },
      { clave: 'cifra_2_rotulo', etiqueta: 'Segunda · qué dice al lado', tipo: 'texto', defecto: 'Años de taller' },
      { clave: 'cifra_3_valor', etiqueta: 'Tercera cifra', tipo: 'texto', defecto: '1:8' },
      { clave: 'cifra_3_rotulo', etiqueta: 'Tercera · qué dice al lado', tipo: 'texto', defecto: 'Escala de todos' },
    ],
  },
  {
    id: 'coleccion',
    titulo: 'La colección',
    ayuda: 'La sección oscura con la grilla de siluetas.',
    campos: [
      { clave: 'coleccion_etiqueta', etiqueta: 'Línea chica', tipo: 'texto', defecto: 'La colección' },
      { clave: 'coleccion_titulo', etiqueta: 'Título', tipo: 'area', ayuda: 'Un renglón por línea.', defecto: 'El catálogo\nes una casa' },
      {
        clave: 'coleccion_texto',
        etiqueta: 'Texto',
        tipo: 'area',
        defecto:
          'No hay depósito ni fábrica. Los vehículos están en la casa donde se hicieron, uno al lado del otro, sobre estantes que también hizo él. Cada silueta de acá abajo es uno terminado, con las ruedas que giran y las puertas que abren.',
      },
      { clave: 'coleccion_autos', etiqueta: 'Cuántos autos dibujar', tipo: 'texto', ayuda: 'Solo un número.', defecto: '20' },
      { clave: 'coleccion_motos', etiqueta: 'Cuántas motos dibujar', tipo: 'texto', ayuda: 'Solo un número.', defecto: '10' },
      { clave: 'coleccion_barcos', etiqueta: 'Cuántos barcos dibujar', tipo: 'texto', ayuda: 'Solo un número.', defecto: '2' },
      { clave: 'coleccion_pie', etiqueta: 'Pie de la grilla', tipo: 'texto', defecto: 'Autos y motos a la venta · algún barco, si insistís' },
    ],
  },
  {
    id: 'catalogo',
    titulo: 'Los que están a la venta',
    ayuda: 'El encabezado de la grilla de vehículos. Las piezas se cargan en la sección Vehículos.',
    campos: [
      { clave: 'catalogo_etiqueta', etiqueta: 'Línea chica', tipo: 'texto', defecto: 'Disponibles · entrega inmediata' },
      { clave: 'catalogo_titulo', etiqueta: 'Título', tipo: 'area', ayuda: 'Un renglón por línea.', defecto: 'Estos ya\nestán listos' },
      {
        clave: 'catalogo_texto',
        etiqueta: 'Texto',
        tipo: 'area',
        defecto:
          'Ninguno es un prototipo ni una promesa: se terminaron hace años y esperan desde entonces. El que se va, no se repite.',
      },
      { clave: 'catalogo_vacio', etiqueta: 'Qué decir si no hay nada cargado', tipo: 'texto', defecto: 'Por ahora no hay nada en esta categoría' },
    ],
  },
  {
    id: 'autor',
    titulo: 'Quién los hace',
    ayuda: 'La sección de la historia. Dejá un renglón en blanco para separar párrafos.',
    campos: [
      { clave: 'autor_etiqueta', etiqueta: 'Línea chica', tipo: 'texto', defecto: 'Quién los hace' },
      {
        clave: 'autor_cita',
        etiqueta: 'La frase destacada',
        tipo: 'area',
        defecto: 'Los hizo para hacerlos. Recién ahora aprende a venderlos.',
      },
      {
        clave: 'autor_texto',
        etiqueta: 'La historia',
        tipo: 'area',
        defecto:
          'Nació en el sur y no se fue nunca. Aprendió mirando, sin escuela de oficio y sin plano de fábrica: mide el auto real donde lo encuentre, dibuja la pieza y después la hace. Chapa, bronce, madera, cuero, tela. Sin moldes comprados, sin partes de kit, sin nadie que lo ayude.\n\nEmpezó a los veinte con una moto de un cilindro y no paró más. Cada vehículo le llevó entre seis meses y dos años, siempre después de la jornada, y cuando lo terminaba lo ponía en el estante y arrancaba el siguiente.\n\nNunca vendió ninguno. No por falta de oferta: porque no se le ocurrió que esto fuera un negocio. Esta página existe para que los que quedan encuentren dónde ir.',
      },
      { clave: 'autor_boton', etiqueta: 'Botón', tipo: 'texto', defecto: 'Ver los que están a la venta' },
    ],
  },
  {
    id: 'encargos',
    titulo: 'Encargos',
    ayuda: 'El bloque bordó del final, con el formulario de consulta.',
    campos: [
      { clave: 'encargo_etiqueta', etiqueta: 'Línea chica', tipo: 'texto', defecto: 'Encargos' },
      { clave: 'encargo_titulo', etiqueta: 'Título', tipo: 'area', ayuda: 'Un renglón por línea.', defecto: 'También lo hace\na pedido' },
      {
        clave: 'encargo_texto',
        etiqueta: 'Texto',
        tipo: 'area',
        defecto:
          'Si el auto o la moto que buscás no está entre los terminados, se puede pedir. Alcanza con fotos, la chapa patente o el recuerdo bien contado. Es una sola unidad y lleva entre seis meses y dos años, porque las manos son las mismas.\n\nEscribí lo que tenés en la cabeza y te contesta él, no un formulario automático.',
      },
      { clave: 'encargo_boton', etiqueta: 'Botón del formulario', tipo: 'texto', defecto: 'Enviar la consulta' },
      {
        clave: 'encargo_gracias',
        etiqueta: 'Qué decir cuando se envía',
        tipo: 'texto',
        defecto: 'Consulta enviada · te contestamos en unos días',
      },
    ],
  },
  {
    id: 'pie',
    titulo: 'Pie de página y contacto',
    ayuda: 'Lo de más abajo. El correo y el WhatsApp también arman los enlaces de contacto.',
    campos: [
      { clave: 'pie_1_titulo', etiqueta: 'Columna 1 · título', tipo: 'texto', defecto: 'Dónde están' },
      {
        clave: 'pie_1_texto',
        etiqueta: 'Columna 1 · texto',
        tipo: 'area',
        defecto: 'En una casa de la Patagonia argentina.\nSe visitan con cita: se avisa antes y se toma unos mates.',
      },
      { clave: 'pie_2_titulo', etiqueta: 'Columna 2 · título', tipo: 'texto', defecto: 'Contacto' },
      { clave: 'contacto_email', etiqueta: 'Correo público', tipo: 'texto', defecto: 'hola@jartelier.com.ar' },
      { clave: 'contacto_whatsapp', etiqueta: 'WhatsApp', tipo: 'texto', ayuda: 'Con código de país, ej: +54 9 11 …', defecto: '' },
      { clave: 'contacto_instagram', etiqueta: 'Instagram', tipo: 'texto', ayuda: 'Solo el usuario, ej: jartelier', defecto: '' },
      { clave: 'pie_3_titulo', etiqueta: 'Columna 3 · título', tipo: 'texto', defecto: 'Envíos' },
      {
        clave: 'pie_3_texto',
        etiqueta: 'Columna 3 · texto',
        tipo: 'area',
        defecto: 'Caja de madera hecha a medida para cada pieza. A todo el país y al exterior.',
      },
      { clave: 'colofon_izq', etiqueta: 'Colofón · izquierda', tipo: 'texto', defecto: 'Jartelier · Autos y motos a escala 1:8' },
      { clave: 'colofon_der', etiqueta: 'Colofón · derecha', tipo: 'texto', defecto: 'Una persona, cuarenta años, más de treinta vehículos' },
    ],
  },
];

/** Ajustes que no son textos (no aparecen en el editor). */
const OPCIONES = [{ clave: 'registro_abierto', defecto: '1' }];

const DEFECTOS = {};
for (const grupo of GRUPOS) {
  for (const campo of grupo.campos) DEFECTOS[campo.clave] = campo.defecto;
}
for (const opcion of OPCIONES) DEFECTOS[opcion.clave] = opcion.defecto;

const CLAVES = Object.keys(DEFECTOS);

module.exports = { GRUPOS, OPCIONES, DEFECTOS, CLAVES };
