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

**Quién es el que llama lo decide el núcleo.** `createIdentityService` expone
`fromApiKey(token)` y `fromSession(authUserId)`: ahí viven las reglas de que una key
revocada no autentica, que una API key actúa como su dueño anotando al agente aparte
para la auditoría, y que el rol sale del perfil y no del usuario de BetterAuth. El
adaptador solo extrae la credencial del transporte que conoce —cabecera `Authorization`
o cookie— y pregunta. Antes esto estaba en `src/server/context.ts`, o sea reglas de
negocio en el composition root, y repartidas entre tres módulos.

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

El historial filtra las lecturas **por el nombre de la acción** (`.read` y `.list`, la
convención de todo el catálogo), no por el `changed` del evento. `changed` significa "el
tablero debe refrescarse", que no es lo mismo que "escribió algo": `key.revoke`, los
webhooks y `invitation.create` escriben sin tocar el tablero, y filtrando por `changed`
quedaban escondidos de la auditoría justo los eventos de seguridad. El campo del evento
sigue llamándose `changed` porque el esquema `.v1` está congelado; el parámetro de
`register` se llama `refreshesBoard`, que es lo que hace.

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

- `src/core/`: contratos, dominio, acciones, autorización, identidad y puertos.
- `src/adapters/postgres/`: esquema Drizzle, migraciones, transacciones y el worker
  del outbox de webhooks. Es lo único que conoce la tabla `records` y su JSONB.
- `src/adapters/http/`: Hono, extracción de credenciales del transporte y SSE.
- `src/adapters/cli/`: cliente del catálogo HTTP.
- `src/adapters/documents/`: conversión Markdown y colaboración.
- `src/web/`: el entry (`main.tsx`) y `styles.css`. Nada más suelto acá.
- `src/web/routes/`: el árbol de rutas (`router.tsx`) y las páginas. Una página es lo que
  el router monta y lo que la URL nombra.
- `src/web/components/`: componentes con lógica. Conocen el dominio, invocan acciones y
  consumen `ui/`.
- `src/web/ui/`: primitivas de UI, tontas y sin dominio (ver abajo).
- `src/web/lib/`: lógica de vista que no es un componente — el cliente HTTP y lo demás
  (`api.ts`, `update.ts`, `filters.ts`, `stages.ts`, `drag.ts`).
- `src/server/`: configuración y composición de adaptadores. Solo cableado: ninguna
  regla vive acá.
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

## Las tres capas del frontend

| Capa | Qué vive ahí | Qué no |
|---|---|---|
| `src/web/routes/` | `router.tsx` y las páginas: hoy solo `BoardPage`. | Paneles sin ruta propia. El cajón de la tarjeta, configuración y propiedades los abre un parámetro de búsqueda de esta misma ruta: son componentes. |
| `src/web/components/` | Componentes con lógica: `Board`, `CardTile`, `CardDialog`, `CardList`, `Filters`, `Login`, `Settings`, `BoardFields`, `AppSidebar`, `History`, `DocumentEditor`. Invocan acciones y arman la predicción optimista. | Markup de un control que ya existe en `ui/`. |
| `src/web/ui/` | Primitivas: botón, chip, icono, dropdown, avatares, composer, modal, panel, barra lateral, toast, confirmación. | Nada del dominio: sin `Card`, sin `Field`, sin acciones, sin queries. |
| `src/web/lib/` | Lógica que no es un componente: `api.ts`, `update.ts`, `filters.ts`, `stages.ts`, `drag.ts`. | Nada de JSX. |

**Antes de escribir un control, mirá si ya existe en `ui/` y reusalo.** Si falta, se
agrega ahí y se exporta desde `src/web/ui/index.ts` — nunca suelto en un componente ni en
la raíz de `src/web/`.

**Un directorio por componente, con su CSS al lado**, y el archivo se llama como el
componente: `Button/Button.tsx` exporta `Button` e importa `Button/Button.css`.
PascalCase para el componente y su directorio; los módulos de `lib/`, que no exportan
uno, siguen en minúscula.

`styles.css` es solo lo global: los tokens del tema, el estilo base de los elementos
(`button`, `input`, `a`, `h1`-`h3`…) y las pocas clases que comparten pantallas que no se
conocen entre sí (`.error`, `.help`, `.sr-only`). Todo lo demás vive en el
`.css` del componente que lo usa; si es de dos componentes hermanos, sube a la primitiva
que ambos consumen —la cabecera de diálogo está en `ui/Modal/Modal.css`, no duplicada.
Además, el CSS de un componente cargado con `lazy()` viaja en su propio chunk.

**Los imports que cruzan de capa usan el alias `@/`** — `@/core/model`, `@/web/lib/api`,
`@/web/ui`—; dentro de la misma capa, ruta relativa. Está declarado en `tsconfig.json`,
`vite.config.ts` y `vitest.config.ts`.

La regla que las mantiene reusables: **las primitivas son tontas.** No conocen `Card`,
`Field` ni `Profile`, no llaman acciones ni leen queries. Reciben props y avisan por
callback. La lógica —qué acción invocar, qué predicción dibujar, qué permiso hace falta—
la pone la página que las consume.

**El estilo base de los elementos —`button`, `input`, `textarea`, `a`, `h1`-`h3`— vive en
`styles.css` como selector de elemento, y se queda ahí.** Un `<button>` o un `<input>`
pelado ya sale bien en cualquier componente, sin importar nada. Si esas reglas se mudaran
a `ui/Button/Button.css`, solo se aplicarían cuando algo importe el componente `Button`:
un `<button>` suelto —y hay muchos— quedaría sin estilo según qué otro componente esté
montado. El selector de elemento **es** la primitiva; envolverlo en un `<Input>` de React
agregaría una capa sin sacar ninguna.

`<Button variant>` existe solo para las variantes, así no quedan clases sueltas repartidas
por los componentes.

El criterio para decidir si algo se queda en `styles.css`: **si tiene nombre propio, es un
componente.** `.setting-row` lo tenía y se fue a `ui/SettingRow/`. Lo que queda son
selectores de elemento, los tokens, y tres utilidades transversales sin dueño (`.error`,
`.help`, `.sr-only`) que cualquier pantalla futura va a querer y ninguna debería tener que
importar de otra.

Un componente no guarda en estado local algo que ya vive en el caché de queries. La
predicción optimista de `update.ts` deja el valor nuevo en el caché antes de que el
servidor conteste, y lo devuelve solo si la acción falla; copiarlo a un `useState` con un
`useEffect` agrega un render y se desincroniza cuando falla. Es la misma regla 3 de
AGENTS.md vista desde el frontend.

## Convenciones

- `pnpm` siempre. Nunca `npm`.
- Controles de UI: reusar lo de `src/web/ui/`; primitiva tonta, lógica en `components/`.
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
