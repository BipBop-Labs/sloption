# Código

> Cómo está construido. Stack, estructura, convenciones.

## Forma general

**Monolito en TypeScript.** Un repo, un despliegue.

Dentro del repo viven la web, el núcleo de la aplicación y **la CLI** — la CLI no es
un proyecto aparte, se instala desde acá.

## Stack

| Capa | Decisión |
|---|---|
| Todo el frontend | **TanStack** |
| ORM y migraciones | **Drizzle** |
| Autenticación | **BetterAuth** |
| Gestor de paquetes | **pnpm** (no npm) |
| Despliegue | **Coolify** + Docker Compose |

## Arquitectura elegida: hexagonal (ports & adapters)

El núcleo contiene las acciones y las reglas de autorización. No importa React, Hono,
BetterAuth ni Drizzle. Los adaptadores traducen protocolos y almacenamiento; el
composition root conecta sus implementaciones. La CLI usa la API HTTP, que invoca
exactamente el mismo catálogo que la web.

Se evaluaron arquitectura por capas centrada en el framework y arquitectura hexagonal.
Elegimos la segunda porque permite probar los flujos sin servidor ni navegador y evita
que autenticación, persistencia o sincronización definan las reglas del producto.
No se agregan agregados DDD, buses ni repositorios por entidad sin una necesidad concreta.
La skill de Ousterhout orienta interfaces pequeñas que encapsulan transacciones,
validación y auditoría, evitando capas que solo reenvían métodos.

Fuente: [artículo original de Cockburn](https://alistair.cockburn.us/hexagonal-architecture).

## HTTP: Hono; frontend: TanStack Router y Query

TanStack Start sí ofrece [server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
y puede alojar una API: no se descarta por incapacidad. Elegimos Hono porque el contrato
de desarrollo requiere backend en Docker y frontend local, y necesitamos streaming
persistente independiente del servidor de desarrollo de la UI. Una SPA con TanStack
Router y Query conserva ese límite sin dos servidores Start ni SSR que el tablero
privado no necesita. En producción Hono sirve también los archivos compilados de Vite:
un monolito, un proceso de aplicación y una base de datos.

La lógica no vive en handlers ni server functions: vive en el núcleo.
[Adaptador Node de Hono](https://hono.dev/docs/getting-started/nodejs).

## Persistencia y tiempo real

PostgreSQL + Drizzle. Cada acción completada y su evento se persisten en la misma
transacción. Los eventos tienen secuencia durable para reconectar y consultar historial.
Las notificaciones de PostgreSQL despiertan el streaming SSE; no son el almacenamiento
de eventos. Las lecturas auditadas no invalidan el tablero, evitando un ciclo infinito
lectura → evento → recarga. Los secretos nunca forman parte de los payloads de auditoría.

Se evaluó [Electric Sync](https://electric.ax/docs/sync/): sincroniza lecturas desde
PostgreSQL, exige un servicio adicional y replicación lógica. Para un solo tablero
compartido se elige SSE con recuperación desde eventos persistidos: menos infraestructura,
las mismas escrituras autorizadas. [Semántica de NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html).

Edición simultánea: Yjs encapsulado detrás de un puerto de documentos.
Cada actualización debe invocar una acción autenticada, persistir antes de difundirse y
estar disponible por HTTP/CLI. El Markdown sigue siendo legible por agentes. No integrar
un servidor de colaboración con un camino de escritura que omita el núcleo.
[Yjs: actualizaciones conmutativas e idempotentes](https://docs.yjs.dev/api/document-updates).
La integración está implementada y tiene pruebas de convergencia y de edición entre dos
sesiones de navegador. El estado Yjs y su representación Markdown se confirman juntos.

### Estructura de carpetas

- `src/core/`: contratos, dominio, acciones, autorización y puertos.
- `src/adapters/postgres/`: esquema Drizzle, migraciones y transacciones.
- `src/adapters/http/`: Hono, autenticación de transporte y SSE.
- `src/adapters/cli/`: cliente del catálogo HTTP.
- `src/adapters/documents/`: conversión Markdown y colaboración.
- `src/web/`: componentes React, TanStack Router y Query, CSS.
- `src/server/`: configuración y composición de adaptadores.
- `scripts/`: desarrollo, seed e importación.
- `tests/`: dominio, integración con PostgreSQL y flujos UI/API/CLI.

## Docker y entornos

Dos composes, con propósitos distintos.

### Producción — `docker compose up`

Levanta **todo** lo necesario para que el servicio corra: base de datos, backend,
frontend.

**No expone ningún puerto.** La exposición se hace a mano desde la red de Coolify.

### Desarrollo — `docker-compose.dev.yml`

Levanta **solo la base de datos y el backend**, y **sí expone el puerto del backend**
(puerto aleatorio del host).

El frontend **no va en Docker en desarrollo**: corre local con `pnpm run dev` y se
conecta al backend del compose.

**Por qué:** meter el frontend en Docker para desarrollo trae problemas con el caché
de builds de TanStack y con los volúmenes. No vale la pena.

## Convenciones

- `pnpm` siempre. Nunca `npm`.
- Esquema de base de datos en código, con Drizzle como fuente de verdad.
- Esquemas de eventos versionados y explícitos (ver [SPEC.md](SPEC.md)).

## Detalles de persistencia

El adaptador almacena entidades tipadas en registros JSONB identificados por colección
e ID; Drizzle define la tabla y las migraciones, incluidas las tablas de BetterAuth.
Las propiedades configurables no requieren una migración SQL por campo. El núcleo
valida tipos y referencias antes de escribir. Para un único tablero, una exclusión
transaccional de PostgreSQL ordena acciones y eventos. Si el volumen o concurrencia
crece, medir ese límite antes de dividir bloqueos o normalizar consultas.

Invitación, cuenta y perfil se crean en una misma transacción usando BetterAuth con el
adaptador Drizzle ligado a ella. El seed también es transaccional e idempotente.

La señal SSE usa revisiones para no perder notificaciones recibidas entre leer el
historial y entrar en espera. El evento durable sigue siendo la fuente de recuperación.
