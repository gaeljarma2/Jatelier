# Jartelier — sitio + modo empresa

Sitio público, cuentas de clientes y panel privado de vendedores para los
vehículos a escala 1:8 del taller.

---

## Arrancarlo por primera vez

Necesitás Node.js 18 o más nuevo (`node -v` para chequear; si no lo tenés,
se baja de nodejs.org).

Abrí la Terminal, entrá a esta carpeta y corré:

```bash
npm install      # instala las dependencias (una sola vez)
npm run seed     # crea el vendedor y carga los 6 vehículos que ya estaban
npm start        # levanta el sitio
```

Después andá a **http://localhost:3000**

### Cuenta de vendedor que crea el seed

| | |
|---|---|
| Correo | `admin@jartelier.com.ar` |
| Contraseña | `jartelier2026` |

> **Cambiala apenas entres**, en *Ajustes del sitio → Mi contraseña*.

---

## Las tres pantallas

| Dirección | Qué es | Quién entra |
|---|---|---|
| `/` | El sitio público, con el catálogo y el formulario de encargos | Cualquiera |
| `/ingresar.html` | Ingreso y alta de cuenta | Cualquiera |
| `/cuenta.html` | Favoritos, historial de consultas y datos personales | Clientes registrados |
| `/empresa.html` | **Modo empresa**: el panel del taller | Solo vendedores |

Si un cliente intenta abrir `/empresa.html`, lo mandamos de vuelta a su cuenta.
Si no hay sesión, va al ingreso. La protección está en el servidor, no solo en
el navegador.

---

## Qué se puede hacer en el modo empresa

**Resumen** — cuántos vehículos hay, cuántos están disponibles, cuántas
consultas nuevas sin leer, y las últimas cuatro consultas para contestar de una.

**Vehículos** — cargar uno nuevo, editar todo lo de uno existente, cambiar el
estado desde la tabla sin abrir nada, borrarlo. De cada vehículo se maneja:

- título, año, subtítulo y descripción larga
- tipo (auto, moto, barco, otro), escala, largo en mm, año de terminado, materiales
- **características libres**: agregás las filas que quieras («Puertas y capot» →
  «abren», «Rayos por rueda» → «36»). No hay límite fijo de campos.
- precio y moneda, con la opción de mostrarlo o no en el sitio público
- estado: disponible / reservado / vendido / borrador (el borrador no se publica)
- destacado y orden en la grilla
- color de placa, que se usa de fondo mientras no haya foto
- **fotos**: se arrastran o se eligen, varias por vehículo, se elige cuál es la
  portada y se borran de a una

**Consultas** — todos los correos que dejaron desde el sitio, con el mensaje, el
teléfono si lo dejaron y por qué vehículo preguntaban. De cada una se puede:
marcarla como leída / contestada / cerrada, escribirle una nota interna que solo
ven ustedes, borrarla, o hacerle clic al correo para contestar desde tu programa
de mail. Arriba: **Bajar CSV** (todas las consultas en una planilla) y **Copiar
todos los mails** (al portapapeles, listo para pegar en un envío).

**Usuarios** — todos los clientes registrados y los vendedores. Se puede
convertir un cliente en vendedor y al revés, crear una cuenta de vendedor nueva,
resetearle la contraseña a alguien y borrar cuentas. El sistema no te deja
quedarte sin ningún vendedor.

**Ajustes del sitio** — los textos del encabezado, el correo, el WhatsApp y el
Instagram que se ven en el pie, y el interruptor para permitir (o cortar) el
alta de cuentas nuevas.

---

## Cómo está armado

```
src/            el servidor
  server.js       arranque, sesiones y archivos estáticos
  db.js           base SQLite y creación de tablas
  auth.js         contraseñas, sesiones y permisos
  modelos.js      consultas a la base y validaciones
  rutas-auth.js   /api/auth/*      registro, ingreso, salida
  rutas-publicas.js /api/*         catálogo, consultas, favoritos
  rutas-admin.js  /api/admin/*     todo el modo empresa
  seed.js         carga inicial

public/         lo que ve el navegador
  index.html      sitio público
  ingresar.html   ingreso y alta
  cuenta.html     área del cliente
  empresa.html    panel de vendedores
  404.html
  css/ js/

data/           la base de datos (jatelier.db) y las sesiones
uploads/        las fotos que subís desde el panel
```

**Guardá copia de `data/` y `uploads/`**: ahí está todo. El resto se puede
volver a bajar.

### Seguridad que ya viene puesta

- Contraseñas guardadas con bcrypt (12 rondas), nunca en texto plano
- Sesión en cookie `httpOnly`, con la sesión guardada del lado del servidor
- Ocho intentos fallidos por IP cada diez minutos y después frena
- Todas las consultas a la base son parametrizadas (sin inyección SQL)
- Las subidas aceptan solo JPG, PNG y WEBP, hasta 8 MB, con nombre generado
- El rol se relee de la base en cada pedido: si le sacás el permiso a alguien,
  pierde el acceso al toque

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Levanta el sitio en el puerto 3000 |
| `npm run dev` | Igual pero se reinicia solo cuando editás un archivo |
| `npm run seed` | Crea el vendedor y los vehículos si la base está vacía |
| `npm run reset` | **Borra todo** y vuelve a cargar desde cero |
| `PORT=8080 npm start` | Otro puerto |

---

## Cuando quieras publicarlo

Anda tal cual en cualquier servidor con Node (Railway, Render, Fly, un VPS).
Tres cosas antes de subirlo:

```bash
export NODE_ENV=production
export SESSION_SECRET="una-frase-larga-e-inventada-que-no-le-digas-a-nadie"
export PORT=3000
```

Con `NODE_ENV=production` la cookie de sesión pasa a exigir HTTPS, así que el
sitio tiene que estar detrás de un certificado (Railway, Render y compañía lo
ponen solos).

Para hosting compartido con cPanel hace falta que el plan soporte Node; si solo
soporta PHP, avisame y lo reescribo.
