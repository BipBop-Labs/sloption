# Sloption

Back office de Revi: kanban compartido, editor colaborativo, API y CLI sobre un núcleo
hexagonal. Interfaz en español, código en inglés.

## Desarrollo

Requiere Node 24, pnpm 11 y Docker Compose.

1. Copia `.env.example` a `.env` y completa secretos, correo y contraseña del admin.
   `SEED_ADMIN_PASSWORD` requiere al menos 12 caracteres. `APP_URL` debe ser
   `http://localhost:5173` para este entorno.
2. Ejecuta `pnpm install --frozen-lockfile`.
3. Ejecuta `docker compose -f docker-compose.dev.yml up -d --build`.
4. Ejecuta `pnpm dev` y abre http://localhost:5173.

El compose de desarrollo solo levanta PostgreSQL y backend; el backend publica un
puerto aleatorio que el script de desarrollo descubre automáticamente. La base no
publica puertos. Las migraciones y el seed son parte del arranque. El seed no cambia
la contraseña de un administrador ya creado.

En el entorno local preparado durante esta sesión, `.env` ya contiene credenciales
aleatorias y el correo `admin@sloption.local`. No se versiona ese archivo.

## Producción / Coolify

Configura las variables de `.env.example` en Coolify, con `APP_URL` igual al origen
HTTPS público. Ejecuta `docker compose up -d --build`. No publica puertos del host:
conecta el proxy de Coolify al servicio `app`, puerto interno `3000`.

La imagen sirve la web compilada y la API desde el mismo proceso. PostgreSQL usa un
volumen persistente. Las imágenes subidas se guardan en PostgreSQL junto con el resto
de los datos, por lo que el respaldo de la base las incluye. El proxy debe permitir
SSE sin buffering; la respuesta agrega `X-Accel-Buffering: no`.

No se ha desplegado a Coolify.

## Usuarios

Solo un administrador puede invitar, cambiar roles,
configurar propiedades y webhooks. Los miembros pueden trabajar en el tablero y crear
sus propias claves de agentes. Las invitaciones generan un enlace para compartir,
sin enviar correo. Se consumen una sola vez.

Las claves no vencen, se pueden revocar y heredan el rol actual del dueño. Los eventos
incluyen el dueño, el agente y el ID de la clave, nunca su secreto.

## CLI y API

Instalación tras clonar (no necesita `pnpm install`: la CLI corre con Node 24+ solo,
sin dependencias):

```sh
pnpm -s install:cli   # symlink sloption -> este repo, en ~/.local/bin
sloption help
```

Para actualizar, `git pull`. El symlink apunta al repo, así que no hay que reinstalar.
Si `~/.local/bin` no está en el PATH, elegí otro destino con
`SLOPTION_BIN=/otro/bin pnpm -s install:cli`.

```sh
export SLOPTION_URL=http://localhost:5173
export SLOPTION_API_KEY=...
sloption help                # con credenciales, lista todos los comandos
sloption catalog read
sloption boards read '{"view":"week"}'
sloption cards create '{"title":"Nueva tarea","weekly":true}'
sloption cards read '{"id":"..."}'
sloption cards move '{"id":"...","optionId":"in progress","beforeId":null}'
sloption cards week '{"id":"...","weekly":false}'
sloption profiles preferences '{"theme":"dark"}'
```

Cada endpoint tiene su ruta, por defecto `POST /api/<base>/<nombre>` (`cards move` es
`POST /api/cards/move`), con JSON y autenticación por cookie o `Authorization: Bearer ...`.
`catalog read` describe inputs, outputs, errores y el payload de cada evento; la CLI saca
las rutas de ahí. Un argumento `@archivo.json` permite enviar documentos largos desde CLI.

`sloption session login @credenciales.json` devuelve la cookie; también se puede usar
`SLOPTION_COOKIE` en lugar de una API key. `session logout` e `invitations accept` están
disponibles sin navegador. Si apuntas directamente al puerto aleatorio del backend,
configura `SLOPTION_ORIGIN` con el `APP_URL` esperado.

## Colaboración y eventos

El cuerpo se sincroniza mediante Yjs. `cards applyDocument` acepta una actualización Yjs
en base64 y devuelve tanto el estado colaborativo como el Markdown actual. Las
actualizaciones concurrentes se combinan; modificar propiedades usa una versión y
rechaza cambios obsoletos con `STALE_VERSION` (kind `CONFLICT`).

Cada endpoint emite su evento en la misma transacción; los eventos están en el
`events.ts` de cada dominio y `catalog read` lista sus nombres y payloads. No se guarda
historial: los eventos salen por webhook y, si cambian el tablero, por SSE, que al
reconectar recarga todo. Cada evento indica persona y agente.

Los webhooks usan un outbox durable, hasta 10 intentos con espera exponencial. Verifica
`X-Sloption-Signature` como HMAC-SHA256 de `timestamp + "." + rawBody`, usando el secreto
del webhook y `X-Sloption-Timestamp`. Deduplica por `X-Sloption-Event-Id`; la entrega es
al menos una vez. Lo pendiente y lo que falló queda en la tabla `deliveries`; lo
entregado se borra.

## Verificación

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm exec playwright test
```

Playwright usa el entorno local ya levantado y las credenciales de `.env`. Crea datos
identificables con prefijo `E2E` y usuarios `test-...@sloption.local`; no usar contra una
base de producción. Comprueba UI, colaboración entre dos sesiones, permisos, CLI,
revocación y firma/reintento de webhooks.
