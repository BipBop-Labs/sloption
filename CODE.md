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

## Arquitectura elegida: hexagonal, cortada por dominio

Ports & adapters, con el backend dividido en dominios verticales: auth, boards, cards,
fields, webhooks y assets. Los dominios no importan React, Hono, BetterAuth ni
Drizzle. Los adaptadores traducen protocolos y almacenamiento; el composition root
conecta sus implementaciones. La CLI usa la API HTTP, que invoca exactamente el mismo
catálogo que la web.

Se evaluaron arquitectura por capas centrada en el framework y arquitectura hexagonal.
Elegimos la segunda porque permite probar los flujos sin servidor ni navegador y evita
que autenticación, persistencia o sincronización definan las reglas del producto.
No se agregan agregados DDD, buses ni repositorios por entidad sin una necesidad concreta.
La skill de Ousterhout orienta interfaces pequeñas que encapsulan transacciones,
validación y auditoría, evitando capas que solo reenvían métodos.

### El wrapper: `src/backend/lib/`

Cada endpoint se declara una vez, con `defineEndpoint` dentro de un `defineRouter`: doc,
acceso (`public`, `member` o `admin`), input y output zod, errores, `scope` opcional y el
evento que emite, o `null` si no emite. De esa definición salen:

- la acción `cards.move`;
- la ruta HTTP, por defecto `POST /api/cards/move`, o la que declare `http`;
- el comando `sloption cards move`;
- su entrada en `catalog.read`, con JSON Schema del input, el output y el payload.

El runner (`createCatalog`, en `lib/catalog.ts`) corre igual cada llamada, venga de donde
venga: autentica con el puerto `Authenticator`, autoriza por rol, valida el input, abre la
transacción, carga y autoriza el recurso de `scope`, llama al orquestador, valida output y
payload, y publica el evento en la misma transacción.

**Los eventos se definen aparte**, en el `events.ts` de cada dominio, con
`defineEvent("cards.moved.v1", { data, refreshesBoard })`. El nombre es propio, no el del
endpoint: es el contrato de los webhooks, así que renombrar un endpoint no los rompe, y un
mismo evento puede salir de varios endpoints (`cards create` y un futuro
`cards batchCreate`). El orquestador lo construye llamándolo —`event: CardMoved({...})`—,
lo que valida el payload en esa línea. TypeScript exige que devuelva exactamente el evento
que declara su endpoint; dos definiciones distintas con el mismo nombre rompen al
arrancar.

**La CLI llama a la API HTTP**, como `gh` o `stripe`: un solo lugar autentica, autoriza y
emite, y la CLI funciona desde cualquier máquina con una API key. Saca las rutas de
`catalog.read`, así que un endpoint nuevo aparece en la CLI sin tocarla.

### Un dominio: router, orquestador, servicios

`src/backend/domains/<dominio>/`:

- `router.ts`: solo definiciones y su doc. Sin lógica.
- `orchestrator.ts`: una función por endpoint; `implement` obliga a implementarlas
  todas. Devuelve el output y el payload del evento.
- `services.ts`: operaciones reutilizables que reciben la transacción.
- `events.ts`: los eventos que emite el dominio.
- `model.ts` y `errors.ts`.

`domains/kernel.ts` es lo compartido: el mapa de colecciones, la transacción y las
dependencias. Reglas, verificadas por `tests/architecture.test.ts`:

- Un orquestador usa servicios propios y de otros dominios.
- Los servicios se consumen entre dominios; los orquestadores no. Solo `server/`
  importa orquestadores.
- `lib/` no conoce ningún dominio.

### Errores

Cada dominio declara los suyos con un código propio (`STALE_VERSION`) y un `kind` de
`lib/errors.ts`, que decide el status HTTP y el exit code de la CLI. La respuesta es
`{error: {code, kind, message}}`. El orquestador lanza con `fail(code)`, tipado con los
errores de su endpoint. Los del runner (UNAUTHENTICATED, FORBIDDEN, INVALID_INPUT y el
NOT_FOUND de `scope`) no se declaran.

### Autenticación y autorización

**auth es un dominio**: sesión, API keys, invitaciones, perfiles y roles. Implementa el
puerto `Authenticator` de `lib/`. El adaptador solo extrae la credencial —cabecera
`Authorization` o cookie— y el runner pregunta. En auth viven las reglas de que una key
revocada no autentica, que una API key actúa como su dueño anotando al agente aparte, y
que el rol sale del perfil y no del usuario de BetterAuth.

**Permisos que dependen del recurso:** el endpoint declara `scope` (`load`, `from`,
`allow`). El runner carga el recurso dentro de la transacción, responde NOT_FOUND o
FORBIDDEN y se lo pasa al orquestador, sin una segunda lectura. Es la forma que toma
después el acceso por tablero del roadmap (ESTADO.md); el actor ya lleva `orgId`.

Login y logout siguen en BetterAuth (`/api/auth/*`), fuera del catálogo, para conservar
su rate limit y la cookie HttpOnly. Emiten `auth.signedIn.v1` y `auth.signedOut.v1` con IP y
user agent, suscribibles por webhook. La IP es el último valor de `X-Forwarded-For`, el
que agrega el proxy de Coolify; el primero lo escribe el cliente.

Fuente: [artículo original de Cockburn](https://alistair.cockburn.us/hexagonal-architecture).

## HTTP: Hono; frontend: TanStack Router y Query

TanStack Start sí ofrece [server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
y puede alojar una API: no se descarta por incapacidad. Elegimos Hono porque el contrato
de desarrollo requiere backend en Docker y frontend local, y necesitamos streaming
persistente independiente del servidor de desarrollo de la UI. Una SPA con TanStack
Router y Query conserva ese límite sin dos servidores Start ni SSR que el tablero
privado no necesita. En producción Hono sirve también los archivos compilados de Vite:
un monolito, un proceso de aplicación y una base de datos.

La lógica no vive en handlers ni server functions: vive en los orquestadores y servicios
de cada dominio. El adaptador HTTP monta una ruta por endpoint del catálogo.
[Adaptador Node de Hono](https://hono.dev/docs/getting-started/nodejs).

## Persistencia y tiempo real

PostgreSQL + Drizzle. Cada endpoint y su evento se confirman en la misma transacción.

**No hay historial de eventos.** Un evento sale por dos lados y no se guarda en ninguno:

- **Webhooks.** Por cada suscriptor se encola una entrega con el payload en
  `deliveries`: outbox durable, firma HMAC y reintentos. Entregada se borra; después de
  diez fallos queda como `failed`. Quien necesite guardar eventos suscribe un webhook a
  otro servicio.
- **Navegadores.** Si el evento declara `refreshesBoard`, un `pg_notify` avisa por SSE
  y el cliente recarga. No hay cursor: al conectar o reconectar llega `ready` y el
  cliente recarga todo. Las lecturas emiten evento pero no refrescan el tablero, así no
  hay ciclo lectura → evento → recarga.

Los secretos nunca forman parte de los payloads.

Se evaluó [Electric Sync](https://electric.ax/docs/sync/): sincroniza lecturas desde
PostgreSQL, exige un servicio adicional y replicación lógica. Para un solo tablero
compartido se elige SSE con recarga al reconectar: menos infraestructura, las mismas
escrituras autorizadas. [Semántica de NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html).

Edición simultánea: Yjs encapsulado detrás de un puerto de documentos.
Cada actualización debe invocar una acción autenticada, persistir antes de difundirse y
estar disponible por HTTP/CLI. El Markdown sigue siendo legible por agentes. No integrar
un servidor de colaboración con un camino de escritura que omita el núcleo.
[Yjs: actualizaciones conmutativas e idempotentes](https://docs.yjs.dev/api/document-updates).
La integración está implementada y tiene pruebas de convergencia y de edición entre dos
sesiones de navegador. El estado Yjs y su representación Markdown se confirman juntos.

### Estructura de carpetas

- `src/backend/lib/`: el wrapper (`endpoint.ts`, `catalog.ts`), los puertos y los kinds
  de error. Sin dominio.
- `src/backend/domains/`: un directorio por dominio y `kernel.ts`.
- `src/backend/adapters/postgres/`: esquema Drizzle, migraciones, transacciones y el
  worker del outbox de webhooks. Es lo único que conoce la tabla `records` y su JSONB.
- `src/backend/adapters/http/`: Hono. Una ruta por endpoint, extracción de la credencial,
  SSE y el login de BetterAuth.
- `src/backend/adapters/cli/`: cliente HTTP; saca las rutas de `catalog.read`.
- `src/backend/adapters/documents/`: conversión Markdown y colaboración.
- `src/backend/server/`: configuración y composición. Solo cableado: ninguna regla vive
  acá.
- `src/frontend/`: el entry (`main.tsx`) y `styles.css`. Nada más suelto acá.
- `src/frontend/routes/`: el árbol de rutas (`router.tsx`) y las páginas. Una página es
  lo que el router monta y lo que la URL nombra.
- `src/frontend/components/`: componentes con lógica. Conocen el dominio, invocan
  acciones y consumen `ui/`.
- `src/frontend/ui/`: primitivas de UI, tontas y sin dominio (ver abajo).
- `src/frontend/lib/`: lógica de vista que no es un componente — el cliente HTTP y lo
  demás (`api.ts`, `update.ts`, `filters.ts`, `stages.ts`, `drag.ts`).
- `scripts/`: desarrollo, migraciones y seed (el admin inicial y un tablero base).
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
| `src/frontend/routes/` | `router.tsx` y las páginas: hoy solo `BoardPage`. | Paneles sin ruta propia. El cajón de la tarjeta, configuración y propiedades los abre un parámetro de búsqueda de esta misma ruta: son componentes. |
| `src/frontend/components/` | Componentes con lógica: `Board`, `CardTile`, `CardDialog`, `CardList`, `Filters`, `Login`, `Settings`, `BoardFields`, `AppSidebar`, `DocumentEditor`. Invocan acciones y arman la predicción optimista. | Markup de un control que ya existe en `ui/`. |
| `src/frontend/ui/` | Primitivas: botón, chip, icono, dropdown, avatares, composer, modal, panel, barra lateral, toast, confirmación. | Nada del dominio: sin `Card`, sin `Field`, sin acciones, sin queries. |
| `src/frontend/lib/` | Lógica que no es un componente: `api.ts`, `update.ts`, `filters.ts`, `stages.ts`, `drag.ts`. | Nada de JSX. |

**Antes de escribir un control, mirá si ya existe en `ui/` y reusalo.** Si falta, se
agrega ahí y se exporta desde `src/frontend/ui/index.ts` — nunca suelto en un componente
ni en la raíz de `src/frontend/`.

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

**Los imports que cruzan de capa usan el alias `@/`** — `@/backend/domains/kernel`,
`@/frontend/lib/api`, `@/frontend/ui`—; dentro de la misma capa, ruta relativa. El
frontend importa del backend solo tipos: `import type`. Está declarado en `tsconfig.json`,
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
- Controles de UI: reusar lo de `src/frontend/ui/`; primitiva tonta, lógica en
  `components/`.
- Esquema de base de datos en código, con Drizzle como fuente de verdad.
- Esquemas de eventos versionados y explícitos (ver [SPEC.md](SPEC.md)).

## Detalles de persistencia

El adaptador almacena entidades tipadas en registros JSONB identificados por colección
e ID; Drizzle define la tabla y las migraciones, incluidas las tablas de BetterAuth.
Las propiedades configurables no requieren una migración SQL por campo. El núcleo
valida tipos y referencias antes de escribir. Para un único tablero, una exclusión
transaccional de PostgreSQL ordena las escrituras. Si el volumen o concurrencia crece,
medir ese límite antes de dividir bloqueos o normalizar consultas.

Invitación, cuenta y perfil se crean en una misma transacción usando BetterAuth con el
adaptador Drizzle ligado a ella. El seed también es transaccional e idempotente.
