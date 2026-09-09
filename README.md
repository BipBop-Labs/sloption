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

Solo un administrador puede invitar, vincular identidades importadas, cambiar roles,
configurar propiedades y webhooks. Los miembros pueden trabajar en el tablero y crear
sus propias claves de agentes. Las invitaciones generan un enlace para compartir,
sin enviar correo. Se consumen una sola vez.

Las identidades importadas no pueden iniciar sesión hasta vincularse con una invitación.
Las claves no vencen, se pueden revocar y heredan el rol actual del dueño. La auditoría
incluye el dueño, el agente y el ID de la clave, nunca su secreto.

## CLI y API

```sh
export SLOPTION_URL=http://localhost:5173
export SLOPTION_API_KEY=...
pnpm cli help
pnpm cli catalog.read '{}'
pnpm cli board.read '{"view":"week"}'
pnpm cli card.create '{"title":"Nueva tarea","weekly":true}'
pnpm cli card.read '{"id":"..."}'
pnpm cli card.move '{"id":"...","optionId":"cooking","beforeId":null}'
pnpm cli card.week '{"id":"...","weekly":false}'
pnpm cli profile.preferences '{"theme":"dark"}'
```

Cada acción se expone en `POST /api/actions/<nombre>`, con JSON y autenticación por
cookie o `Authorization: Bearer ...`. `catalog.read` describe inputs, outputs y eventos.
Un argumento `@archivo.json` permite enviar documentos largos desde CLI.

`pnpm cli auth.login @credenciales.json` devuelve la cookie; también se puede usar
`SLOPTION_COOKIE` en lugar de una API key. `auth.logout` e `invitation.accept` están
disponibles sin navegador. Si apuntas directamente al puerto aleatorio del backend,
configura `SLOPTION_ORIGIN` con el `APP_URL` esperado.

## Importación de Notion

```sh
pnpm import:notion --dry-run /ruta/export-1.zip /ruta/export-2.zip
pnpm import:notion /ruta/export-1.zip /ruta/export-2.zip
```

Usa `SLOPTION_URL` y `SLOPTION_API_KEY` de un administrador, o su `SLOPTION_COOKIE`.
La importación se ejecuta como `import.apply`; los ZIP se leen sin extraer rutas al
filesystem. Repetir los mismos exports no duplica tarjetas ni perfiles.

Los exports recibidos contienen 1.006 tarjetas. Se asociaron 227 cuerpos por título
único y se importaron cinco imágenes; 779 tarjetas indican que el cuerpo no estaba
disponible. Los originales se conservan sin modificaciones en Downloads. Dependencias,
relaciones y cálculos de otras bases se omiten. Fechas originales se conservan como
texto para no inventar una zona horaria. Eduardo Esquivel no se crea como usuario.

## Colaboración y eventos

El cuerpo se sincroniza mediante Yjs. `document.apply` acepta una actualización Yjs
en base64 y devuelve tanto el estado colaborativo como el Markdown actual. Las
actualizaciones concurrentes se combinan; modificar propiedades usa una versión y
rechaza cambios obsoletos con `CONFLICT`.

Cada acción completada persiste un evento en la misma transacción. SSE informa cambios
confirmados y recupera eventos al reconectar. Las lecturas también se auditan, pero no
provocan nuevas recargas. El historial muestra persona y agente.

Los webhooks usan un outbox durable, hasta 10 intentos con espera exponencial. Verifica
`X-Sloption-Signature` como HMAC-SHA256 de `timestamp + "." + rawBody`, usando el secreto
del webhook y `X-Sloption-Timestamp`. Deduplica por `X-Sloption-Event-Id`; la entrega es
al menos una vez. Los intentos y errores quedan en la tabla `deliveries`.

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
