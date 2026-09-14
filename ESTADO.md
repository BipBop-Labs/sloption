# Estado

**Última actualización:** 2026-09-14
**Fase:** v1 implementada y validada localmente. No desplegada.

## Implementado

- Arquitectura hexagonal cortada por dominio (router, orquestador, servicios),
  documentada en CODE.md; TanStack Router/Query + Hono.
- PostgreSQL y Drizzle, migraciones y seed transaccional de administrador.
- Kanban, orden manual, marca semanal manual, archivo y restauración.
- Propiedades tipadas configurables; selección simple y múltiple mediante dropdowns.
- Editor visual Tiptap con imágenes, colaboración Yjs y Markdown persistido.
- Endpoints comunes por HTTP y CLI, autorización de admins/miembros; cada uno declara
  su evento con payload propio.
- Invitaciones de un uso sin email, vinculación de identidades importadas.
- Agentes con API keys revocables, sin vencimiento; los eventos identifican al agente y
  a su dueño.
- Webhooks con firma HMAC, outbox durable y reintentos. Son la única salida de los
  eventos: no hay historial. Login y logout emiten evento con IP y dispositivo.
- Sincronización SSE: aviso de cambio y recarga completa al reconectar.
- Drawer lateral, chips, apariencia similar a shadcn y tokens claro/oscuro.
  Tema persistido por usuario mediante acción. Esta indicación reemplazó Dell.
- Hover de tarjeta con borde `--info`; al arrastrar, la tarjeta sale del flujo y
  las vecinas abren un hueco punteado donde caería.
- Etapas del tablero editables en línea: agregar y eliminar con confirmación,
  solo para admins. Diálogo de confirmación e iconos reutilizables.
- Columnas reordenables con el mismo gesto que las tarjetas: se agarran por el
  encabezado, salen del flujo y las vecinas abren el hueco donde caerían.
  Alt+flechas para el teclado. Es `boards.setStates` con las etapas en otro orden,
  así que la CLI reordena igual; el tablero se dibuja optimista.
- Eliminar una etapa siempre pide escribir su nombre (`challenge` de
  `useConfirm`). La columna solo muestra las tarjetas de la vista y el filtro
  actuales, así que "no tiene tarjetas" en pantalla no dice nada del backlog ni
  del archivo: se pide el nombre sin excepción.
- Vista "Todas" como lista al estilo Notion: `CardList` (src/web/list.tsx),
  componente reutilizable que dibuja grupos plegables de filas; la vista arma los
  grupos "Esta semana" y "Backlog". El kanban queda solo para la semana.
- Archivar suelta la columna: `card.archive` copia la etiqueta de la etapa en
  `card.archivedStage` y deja el campo de agrupación en null. La tarjeta
  archivada no referencia ninguna opción, así que borrar una etapa nunca queda
  bloqueado por el archivo ni le borra su último estado. Restaurar la devuelve a
  esa etapa si todavía existe una opción con ese nombre; si no, queda sin estado.
- El archivo es una lista (`CardList`, un grupo "Archivadas"), no un tablero, y
  ahí no se muestran las pestañas Semana/Todas. La etapa que muestra cada fila
  archivada es su etiqueta guardada. Sigue en `/?view=archived`: no hizo falta
  una ruta aparte, la vista ya es un parámetro de la misma pantalla.
- Filtros de tarjetas del lado del cliente, guardados en la URL: búsqueda por
  título y un filtro por cada campo de opciones (incluye responsable).
- Compose de desarrollo (DB + backend), frontend local y Compose de producción sin
  puertos publicados. Imagen de producción probada localmente, web y health HTTP 200.

## Roadmap

Después del refactor a dominios (plan del 2026-09-13):

1. **Organizaciones.** Crear una y pertenecer a ella, con un rol por organización. Los
   objetos pertenecen a la organización: el tablero pertenece a la org y la tarea al
   tablero. Para leer una tarea hay que ser miembro de la org y tener acceso al tablero.
2. **Varios tableros por organización, de varios tipos:** tareas (el actual),
   calendario, hitos y lista de entradas. El admin define quién accede a cada tablero.
3. **Una persona en varias organizaciones.** Es lo más difícil y puede que no se haga
   nunca. La alternativa es un deploy completo de la app por organización.

Lo que deja listo el refactor: `orgId` en el actor y `scope` en los endpoints (el
runner carga el recurso, autoriza y se lo pasa al orquestador). El puerto
`Authorizer.can(actor, boardId)` y las listas filtradas por acceso se agregan con las
organizaciones: hoy no tendrían nada que decidir.

## Datos locales

El tablero viejo de Notion se descartó. El seed crea el admin inicial de `.env` y un
tablero base con las etapas not started, in progress y done, más la propiedad
Prioridad. Solo corre si todavía no hay un admin con acceso. La base de desarrollo se
vació el 2026-09-14 con la migración nueva.

El frontend corre en http://localhost:5173. `.env` contiene las credenciales locales;
el archivo está ignorado por Git. README.md explica arranque, CLI y configuración para
Coolify.

## Verificación y límites

- TypeScript, compilación web y 11 pruebas unitarias de núcleo/documentos/señales.
- Pruebas de navegador/API: invitaciones, permisos, CLI, atribución y revocación de
  claves; firma y reintento de webhooks; drawer, dropdown, colaboración y temas.
- Se detectó y corrigió una carrera de notificación SSE entre la lectura de eventos
  y la espera. Una prueba unitaria cubre el caso.
- Los tests E2E usan la base local y generan tarjetas prefijadas E2E y miembros de
  integración. No ejecutar contra producción.
- El editor se carga aparte (aprox. 160 KB gzip). No se ha hecho una medición formal
  de los presupuestos de latencia/CLS ni una prueba de carga multiusuario.
- No se desplegó a Coolify. La configuración usa el origen APP_URL y la red del proxy.

- Validación final: TypeScript y build aprobados; 11 tests unitarios, dos flujos
  de API/CLI/webhooks y el flujo de navegador aprobados. El menú del drawer se monta
  explícitamente dentro del diálogo para evitar interceptar o perder clics.
- Se retiraron las tarjetas E2E creadas durante las pruebas; los registros de auditoría
  y miembros de integración se conservan en el entorno local.

## Próximo paso

Probar a mano el tablero con las etapas nuevas: crear, asignar, filtrar por responsable
y prioridad, agregar y reordenar etapas. Después, usar la app y recoger ajustes del
equipo.

## Bitácora

Formato: fecha — qué cambió. Agregá arriba, no abajo.

### 2026-09-14 — Tablas reales por dominio, sin json

- **Se fue `records`**, la tabla genérica con un JSONB por entidad. Ahora hay 16 tablas
  con foreign keys, cada una en el `models.ts` de su dominio, incluidas las de BetterAuth.
  Migraciones reiniciadas: `drizzle/0000_init.sql`. La base de desarrollo se vació.
- **Los servicios consultan Drizzle directo** (`tx.sql`). Se fueron el store genérico
  (`get`/`list`/`put` por colección) y el mapa `Entities`.
- **Tarjeta híbrida:** columnas base (`title`, `board_id`, `state_id`, `rank`, `weekly`,
  `archived`…), `card_assignees` con foreign key a `profiles`, y un solo jsonb,
  `cards.properties`, para las propiedades que define cada tablero, validado contra
  `fields`.
- **Las columnas del kanban son los estados del tablero** (`board_states`). Se fue la
  agrupación configurable: `boards.configure` y `groupingId` desaparecen, y
  `boards.setStates` agrega, reordena y quita etapas. Quitar una deja sus tarjetas sin
  estado por la foreign key.
- **Asignar es un endpoint**: `cards.assign` emite `cards.assigneesChanged.v1` con quién
  entró y quién salió. Es el caso de un agente que se entera.
- **Filtros del frontend:** por responsable y por propiedades de selección; nunca por
  etapa.
- **Webhooks sin persistir:** entrega en memoria después del commit, con reintentos. Se
  fueron `deliveries` y el worker; un reinicio pierde lo pendiente.
- **`lib/` no define modelos:** el `Actor` pasó a `auth/schemas.ts` y `lib/` solo conoce
  `{ userId, role }`. Tests de arquitectura nuevos: `models.ts` solo importa modelos y
  `lib/` no toca Drizzle.
- **Se fueron `sourceId` y `bodyMissing`**, restos de la importación de Notion.
- Los tests unitarios con store en memoria (`archive`, `identity`) no aplican con Drizzle
  directo: archivar quedó como función pura (`archiveTransition`, en `tests/cards.test.ts`)
  y auth se cubre en los E2E.

Verificación: typecheck, build, 41 tests unitarios y E2E 5/5 contra la base nueva.

### 2026-09-14 — Esquemas en `schemas.ts`, sin `model.ts`

- **Un `schemas.ts` por dominio** reemplaza a `model.ts`. "Modelo" sonaba a base de
  datos, y la forma de guardar es asunto del adaptador de Postgres. Además, desde que el
  tipo sale del esquema (`z.infer`), modelo y esquema eran lo mismo con dos nombres.
- **Los routers ya no tienen esquemas inline:** solo referencian nombres. Las listas se
  arman ahí mismo (`z.array(Profile)`).
- **Nombres por lo que es, no por su rol:** `NewCard`, `CardPlacement`, `BoardView`,
  `IssuedKey`. El esquema y su tipo comparten nombre. Se fueron las `interface` escritas
  a mano (`Key`, `Invitation`, `Webhook`), que duplicaban el esquema.
- **Composición entre dominios:** `BoardView` usa `Profile`, `CardSummary` y `Field`.
  Regla nueva en `tests/architecture.test.ts`: un `schemas.ts` solo importa otros
  `schemas.ts`.
- **Esquemas base** (`Id`, `ById`, `Empty`, `Ok`) en `domains/schemas.ts`; `kernel.ts`
  queda con colecciones, transacción, dependencias e `implement`.
- **`properties.ts` desaparece.** `parsePropertyValue` pasó a `fields/services.ts` como
  `parseValue`. `removeOptionReference` era código muerto: solo lo usaba su test.
- **Los payloads de eventos siguen en `events.ts`**, reusando esquemas como `Id`, `Role`
  y `FieldType`.

Verificación: typecheck, build, 43 tests unitarios y E2E 5/5 con el backend reconstruido.

### 2026-09-14 — Sloption es solo Sloption

- Se quitaron las menciones a Revi de docs, UI (título, login, sidebar), seed y skills.
- `.claude/skills/`: se borró `design-system` (no aplicaba) y las demás perdieron el
  prefijo `revi-`. `microcopy` usa ejemplos de Sloption.

### 2026-09-13 — Eventos en su propio archivo, sin importación de Notion

- **`events.ts` por dominio.** `defineEvent("cards.moved.v1", { data, refreshesBoard })`
  define el evento; el router lo referencia (`event: CardMoved`) y el orquestador lo
  construye (`event: CardMoved({...})`), lo que valida el payload en esa línea.
  TypeScript exige devolver exactamente el evento del endpoint.
- **El evento tiene nombre propio**, no el del endpoint: renombrar un endpoint no rompe
  webhooks, y un evento puede salir de varios endpoints (`cards create` y un futuro
  `cards batchCreate`). El catálogo lo lista una vez; dos definiciones distintas con el
  mismo nombre rompen al arrancar.
- **Nombres nuevos, en pasado:** `cards.created.v1`, `cards.moved.v1`,
  `cards.archivedChanged.v1`, `auth.signedIn.v1`… La lista está en ACTIONS.md.
- **Sin importación de Notion:** se borraron el dominio `imports`, `import-notion.ts`,
  `adm-zip` y `csv-parse`. El tablero viejo se descarta.
- **Seed:** tablero base con not started, in progress y done.
- **Docker:** se borraron el contenedor `backoffice-db-1` y el volumen
  `backoffice_postgres-dev`.
- `app.spec` ya no depende del nombre de las etapas: usa la primera columna.

Verificación: typecheck, build, 43 tests unitarios (4 nuevos de eventos: reuso entre
endpoints, validación al construir, nombre duplicado y formato) y E2E 5/5 con el backend
reconstruido.

### 2026-09-13 — Backend por dominios, eventos a webhooks, sin historial

- **`src/frontend/` y `src/backend/`.** El frontend no cambió por dentro.
- **Wrapper en `src/backend/lib/`.** `defineRouter` + `defineEndpoint` declaran cada
  endpoint una vez; de ahí salen la acción, la ruta HTTP, el comando CLI, el evento y la
  entrada del catálogo. `createCatalog` es el runner. `service.ts` (827 líneas) se partió
  en siete dominios con `router.ts`, `orchestrator.ts` y `services.ts`.
  `tests/architecture.test.ts` verifica que los orquestadores no se importan entre sí y
  que `lib/` no conoce dominios.
- **auth es un dominio** e implementa el puerto `Authenticator`. Permisos por recurso con
  `scope`: el runner carga, autoriza e inyecta (hoy: `keys revoke` solo del dueño, y
  NOT_FOUND de toda operación sobre una tarjeta).
- **Errores por dominio**, con código propio y `kind` genérico: `{error:{code,kind,message}}`.
- **Eventos con payload propio** (`cards.move.v1` trae `fromOptionId` y `toOptionId`), en
  `.v1` porque estamos en beta. `session.me` declara `event: null`.
- **Sin historial.** Migración `0002`: se borra la tabla `events` y `deliveries` guarda
  el payload; lo entregado se borra. Se fueron la vista de historial, `history.list`, el
  cursor SSE y `wake-signal.ts`.
- **Sesión:** `auth.login.v1` y `auth.logout.v1` con IP (último valor de
  `X-Forwarded-For`) y user agent. Se eliminaron `auth.session.v1`, `stream.open.v1`,
  `invitation.accept` como ruta a mano y `system.seed.v1`. Login y logout siguen en
  BetterAuth, fuera del catálogo, por su rate limit y la cookie HttpOnly.
- **Nombres nuevos, sin compatibilidad:** `card.*` → `cards.*`, `document.apply` →
  `cards.applyDocument`, `key.*` → `keys.*`, etc. `POST /api/actions/:name` ya no existe.
  La CLI acepta `sloption cards move` y `sloption cards.move`, y saca las rutas de
  `catalog.read`. Los webhooks suscritos a nombres viejos dejan de recibir.

Verificación: typecheck, build, 39 tests unitarios (runner, scope, errores, auth,
archivo, arquitectura) y un smoke que monta las 29 rutas. Migración `0002` aplicada por
el backend de Docker al arrancar. E2E: `api.spec` 2/2, `app.spec` 3/3 repetido y
`drag-slot.spec` 2/2.

Arreglos en los E2E, ninguno por el refactor:

- `app.spec` suponía tarjetas semanales en la base; ahora crea la suya.
- `app.spec` no aceptaba la confirmación de archivar, que existe desde `120c86d`.
- `app.spec` apretaba Enter sobre la tarjeta recién creada, pero el composer ya abre el
  drawer y el Enter a veces lo cerraba. Fallaba en un paso distinto cada corrida.
- `api.spec` buscaba la red `backoffice_default`. Con Docker Desktop el gateway de la
  red queda dentro de la VM: el receptor del webhook se alcanza por
  `host.docker.internal`.

Entorno:

- Al renombrar la carpeta a `sloption`, compose pasó a ser otro proyecto con otro
  volumen, `sloption_postgres-dev`, que arrancó vacío. Las 1006 tarjetas importadas
  siguen en `backoffice_postgres-dev`.
- El login de BetterAuth permite 10 intentos por minuto. Correr E2E seguidos lo agota y
  el test falla en el login con "Demasiados intentos".

### 2026-09-08 — Revisión Ousterhout del backend: identidad, límites y auditoría

Revisión de los 16 archivos no-web con la skill de Ousterhout. El veredicto fue que las
capas son las correctas y no falta ninguna nueva — `createActionRunner` y el puerto
`Documents` son módulos profundos de manual, y `service.ts` no se parte: 816 líneas
detrás de una interfaz de dos miembros es profundidad, no deuda. Lo que sí había eran
tres fugas y un bug de auditoría.

- **El historial escondía los eventos de seguridad.** Filtraba por `data.changed`, y
  `changed` no significa "escribió": `key.revoke`, `webhook.create`, `webhook.remove` e
  `invitation.create` escriben y estaban marcados `false`, así que no se veían. Ahora
  filtra por el nombre de la acción (`.read`/`.list`). Verificado contra la base local:
  recupera esos eventos y sigue ocultando las lecturas. El parámetro de `register` pasó
  a `refreshesBoard`; el campo del evento sigue siendo `changed` porque `.v1` no se toca.
- **La autenticación tenía tres dueños.** `resolveActor` vivía en `src/server/context.ts`
  —reglas de negocio en el composition root— mientras `core/identity.ts` tenía `accept` y
  `audit`. Ahora el núcleo expone `fromApiKey` y `fromSession`, y el adaptador HTTP
  quedó con cinco líneas que solo eligen de dónde sale la credencial.
  `tests/identity.test.ts` cubre key vigente, revocada, inexistente, sesión y sesión sin
  perfil, con la misma tienda en memoria de `archive.test.ts`.
- **El worker de webhooks salió de `src/server/`** a `src/adapters/postgres/`: leía la
  tabla `records` y su JSONB con SQL crudo desde fuera del adaptador que los define.
- **`fieldInput` se deriva de `propertySchema`.** Estaba escrito dos veces y las listas
  de tipos ya habían divergido. `people` sigue excluido, ahora a propósito y comentado.

Se descartaron dos cambios propuestos, y conviene saber por qué:

- **La URL del asset se queda en el núcleo** (`/api/assets/:id`). Sacarla exigiría un
  caso especial para `asset.create` en el adaptador HTTP, que entra por el endpoint
  genérico de acciones: la cura es peor. La ruta es parte del contrato que un agente
  consume, no un detalle de transporte.
- **`card.read` sigue inicializando el documento al leer.** Toda tarjeta nace con
  `document: null`, así que el init perezoso es load-bearing y sacarlo pide una
  migración. Además no paga hasta que se toque el lock global: la lectura seguiría
  abriendo transacción igual.

Pendiente, medido pero no tocado: **toda transacción toma
`pg_advisory_xact_lock(71924001)`, lecturas incluidas.** El comentario lo justifica
diciendo que así los cursores SSE no pierden eventos, pero esa invariante la dan las
escrituras serializadas; el lector del SSE ni pasa por el store. Con cinco personas no
se nota. Antes de tocarlo, medir.

Verificación: typecheck, 32 tests unitarios (6 nuevos), e2e de API y de historial, y
comprobación por CLI de `field.create` en sus tres casos y de `history.list`.

**El e2e de webhooks falla y no es por estos cambios** — falla idéntico sobre el código
original: el contenedor no alcanza el receptor del test en la IP del gateway de Docker
(`fetch failed`). Es del entorno.

### 2026-09-08 — El frontend se ordena: cuatro capas, un directorio por componente

`styles.css` tenía 969 líneas con el CSS de todas las pantallas mezclado, y en la raíz
de `src/web/` convivían el entry, el router y cinco módulos sueltos. No se veía qué era
una página ni de quién era una regla de CSS.

- **`src/web/routes/`** — `router.tsx` (el árbol de rutas, que salió de `main.tsx`) y
  `BoardPage/`. Una página es lo que el router monta; hoy hay una sola. Se usa `routes/`
  y no `pages/` porque es la convención de TanStack Router: `pages/` es de Next, y
  AGENTS.md dice que esto no es Next. `vercel-react-best-practices` no opina de
  estructura de carpetas — es una guía de performance.
- **`src/web/lib/`** — `api.ts`, `update.ts`, `filters.ts`, `drag.ts`, `stages.ts`.
  `stages.ts` es una sola función pura, `reorderStages`: devuelve las opciones del campo
  agrupador con una etapa movida antes de otra. Es el modelo detrás de arrastrar una
  columna; `drag.ts` es la geometría del gesto sobre el DOM. Están separadas porque una
  se prueba sin navegador y la otra no.
- **Un directorio por componente, con su CSS al lado**, en `ui/` y en `components/`:
  `Board/Board.tsx` + `Board/Board.css`, y el `.tsx` importa su `.css`.
- `styles.css` queda en 262 líneas: tokens, estilo base de los elementos y tres
  utilidades transversales sin dueño (`.error`, `.help`, `.sr-only`). La cabecera de
  diálogo, que compartían `CardDialog` y `BoardFields`, subió a `ui/Modal/Modal.css` en
  vez de duplicarse.
- **`ui/SettingRow/`**: `.setting-row` estaba en `styles.css` pero tenía nombre propio y
  seis usos entre `Settings` y `BoardFields`. El criterio que queda escrito en CODE.md:
  si tiene nombre propio, es un componente; si es un selector de elemento o una utilidad
  que cualquier pantalla futura va a querer, se queda en `styles.css`.
- **El estilo base de `button` e `input` no se muda a `ui/`**, y CODE.md ahora dice por
  qué: como selector de elemento aplica a cualquier `<button>` pelado sin importar nada;
  dentro de `Button.css` solo aplicaría cuando algo importe `Button`, y hay `<button>`
  sueltos por todos lados.
- De regalo: el CSS de `Settings`, `BoardFields` y `DocumentEditor` —los tres que se
  cargan con `lazy()`— ahora viaja en su propio chunk y no en el bundle inicial.
- **Alias `@/`** (`tsconfig.json`, `vite.config.ts`, `vitest.config.ts`) para los
  imports que cruzan de capa. Sin él, anidar un nivel dejaba `../../../core/model`.
- AGENTS.md (regla 5) y CODE.md quedan actualizados: la regla eran tres capas y ahora
  son cuatro.

Sin cambios de comportamiento: es mover archivos y repartir CSS. `pnpm typecheck`,
`pnpm test` (26) y `pnpm build` en verde.

### 2026-09-08 — El historial sale del modal y se vuelve una vista de eventos

Estaba al final del modal de Configuración, como una lista infinita de `div`s. Con
cinco personas usando la app todos los días eso no se lee.

- `src/web/components/History.tsx` — tabla (Cuándo / Qué pasó / Quién / Dónde) de
  50 filas por página. La paginación es la que ya tenía `history.list`: el cursor
  es el `sequence` de la última fila. La pila de cursores vive en el componente,
  así "Más recientes" vuelve página por página y no de un salto al principio.
  La columna "Dónde" linkea a la tarjeta (`?card=…`) en los eventos `card.*`; el
  resto de los eventos apunta a campos o webhooks, que no tienen pantalla propia.
- Es `/?view=history`, la misma pantalla y el mismo parámetro que el archivo. No
  hizo falta una ruta aparte.
- **El historial no es una vista de tarjetas**, así que no va en las pestañas del
  tablero: el link vive con Configuración, tema y Salir, en `.header-actions`
  (que de paso reemplaza el `margin-left: auto` sobre el primer `button`). En esa
  vista no se dibujan ni las pestañas ni los filtros de tarjetas.
- **`history.list` toma `includeReads` (por defecto `false`).** Cada lectura emite
  su evento y son la mayoría: de ~940 eventos locales, 655 eran `board.read` y
  `card.read`. La consulta filtra `data.changed is distinct from 'false'`, así que
  los eventos de sesión (`auth.login`, `stream.open`), que no traen el campo,
  siguen apareciendo: sacarlos sería perder la auditoría de accesos. En la UI es la
  casilla "Mostrar también quién miró qué". La CLI lo pasa igual, sin código nuevo.
- `tests/e2e/history.spec.ts` cubre el flujo y **solo lee**: no crea tarjetas.

Pendiente: `stream.open` emite un evento por reconexión SSE y es ruido, pero no es
una lectura y no se puede filtrar con `changed`. Si molesta, hay que decidir qué
eventos son de infraestructura.

### 2026-09-08 — Primitivas de UI en `src/web/ui/`

Nueve primitivas, un archivo por componente y el archivo con el nombre del componente:
`Avatars`, `Button`, `Chip`, `Composer`, `ConfirmProvider`, `DropdownSelect`, `Icon`,
`Modal`, `Toast`. `ui/index.ts` es el inventario y las páginas importan `from "./ui"`.

- Salieron de la raíz de `src/web/`: `confirm.tsx`, `icon.tsx` y `dropdown.tsx` (partido
  en `Chip.tsx` y `DropdownSelect.tsx`).
- Estaban inline y duplicados: `Avatars` y `Composer` eran el mismo bloque copiado en
  `main.tsx` y `list.tsx`; `Modal` era el mismo `<dialog>` + `showModal()` en `CardDialog`
  y en `Settings`, y ahora además devuelve el foco en los dos.
- `Button` solo nombra las variantes. El estilo base del botón sigue en `styles.css`
  sobre el elemento `button`: un `<button>` pelado sale bien solo. Antes las variantes
  eran `className="primary" | "danger"` sueltas por las páginas.
- `Composer` conserva el texto si `onSubmit` falla, que era el comportamiento del
  composer del kanban y no el de la lista.
- Regla nueva en [AGENTS.md](AGENTS.md) (#5) y detalle en [CODE.md](CODE.md): la
  primitiva se reusa si existe, no conoce el dominio, y la lógica la pone la página.

Revisado contra `vercel-react-best-practices`. El barrel no ensucia los chunks.

### 2026-09-08 — El frontend queda en tres capas

Con el trabajo de archivar ya aterrizado se partió `main.tsx`, que eran 1447 líneas con
el entry, el router y ocho componentes adentro. Ahora son 51 líneas: proveedores y rutas.

- `src/web/components/` — componentes con lógica, uno por archivo con el nombre del
  componente: `BoardPage`, `Board`, `CardTile`, `CardDialog`, `CardList` (era `list.tsx`),
  `Filters`, `Login`, `Settings` (era `settings.tsx`), `DocumentEditor` (era `editor.tsx`).
- `src/web/update.ts` — la predicción optimista, que era el bloque más denso de
  `BoardPage`, ahora es `useUpdate(showError)` y se lee sola.
- `src/web/drag.ts` — `dropTargetAt` y `columnDropAt`: geometría pura sobre el DOM, la
  usan el tablero y la tarjeta.
- `BoardPage` usa `getRouteApi("/")` en vez de importar `boardRoute`, así no hay ciclo
  entre el router y la página.

Los dos hallazgos del review de `vercel-react-best-practices` quedaron cerrados
(`rerender-derived-state-no-effect`):

- El **tema** salía de un `useState` sincronizado con el perfil por `useEffect`. Ahora se
  deriva del perfil del caché y `toggleTheme` escribe la predicción ahí, igual que una
  tarjeta. Era estado solo-frontend, o sea que además violaba la regla 3 de AGENTS.md.
- El **`weekly`** de `CardDialog` era un `useState` que copiaba `card.weekly`. La
  predicción de `update` ya deja el valor nuevo en el caché y lo revierte sola si la
  acción falla; el estado local sobraba y encima no revertía.

Barrida de UI hecha a mano dentro de `components/`, y lo que salió de ahí:

- `CardTile` escribía `<span className="chip chip-week">` a mano mientras `Chip` ya tenía
  una prop para eso **sin un solo uso**. La prop se llamaba `weekly`, o sea dominio
  metido en una primitiva: ahora es `variant="highlight"`, con la misma forma que
  `Button`. La clase pasó a `.chip-highlight` y los tokens `--week-*` a `--highlight-*`,
  que además ya usaba `.secret-result` (la caja de API keys) sin tener nada que ver con
  semanas. `button.week-mark` se queda con su nombre: es el toggle "Esta semana" de
  `CardDialog`, o sea la capa de componentes, y ahí el dominio corresponde.
- `ui/FilePicker` — el botón "Imagen" del editor era un `<label className="button">` con
  un `<input type="file">` escondido adentro. Es el truco que hay que hacer bien una vez
  (el label lo activa con teclado, `sr-only` en vez de `display:none` para no sacarlo del
  foco), no en cada sitio que suba un archivo. De paso limpia el `value` al elegir, así
  que ahora se puede subir dos veces el mismo archivo — antes el segundo intento no
  disparaba nada.
- `ui/DropSlot` — el hueco del arrastre estaba escrito tres veces en `Board`, dos con
  `style` propio. El de columnas y el de tarjetas tienen que medir igual o se despegan.

Se dejaron a mano a propósito: el `dialog-header` de `CardDialog` y `Settings` comparten
la clase CSS pero no el layout (el drawer cierra con `»` a la izquierda, el modal con `×`
a la derecha), y `setting-row`, `property-row`, `filter-search` y el resto son maquetación
de un solo sitio. Compartir una clase CSS no es motivo para compartir un componente.

Verificado sirviendo el `dist` con la API stubeada y cargándolo en Chromium: monta,
dibuja el tablero, abre el drawer, el tema sale del perfil y no hay errores de consola.
**Esa prueba encontró un bug que `tsc`, el build y los tests unitarios no vieron:** al
partir `main.tsx` se quedó fuera la llamada a `createRoot`, y la app compilaba y
construía sin montar nada. La pista fue el chunk principal, que bajó de 411 kB a 228 kB.
Si se vuelve a mover código del frontend, cargá la app: el typecheck no alcanza.

### 2026-09-08 — Crear tareas desde la vista "Todas"

- `CardGroup` acepta `create?(title)`. Si está, el grupo dibuja el mismo composer
  `.new-card` del kanban al final de sus filas; `CardList` sigue sin saber qué
  tarjeta se crea. La vista pasa `weekly: true` en "Esta semana" y `false` en
  "Backlog", que es justo lo que distingue a los dos grupos.
- Es la acción `card.create` de siempre, sin etapa: la tarjeta nace en "Sin
  estado" y crear abre su panel, igual que en el tablero.
- Con filtros puestos la tarjeta recién creada puede quedar oculta (no cumple el
  filtro). No se siembra con los valores del filtro: eso adivinaría intención.

### 2026-09-08 — Filtros de tarjetas

- `src/web/filters.ts`: predicado puro, separado de main.tsx para poder probarlo
  sin React. `tests/filters.test.ts` cubre O dentro de un campo, Y entre campos,
  multiSelect, búsqueda por título y el valor "sin asignar".
- Un filtro por cada campo `select`, `multiSelect` y `people`, alimentado por
  `data.fields`: un campo nuevo se vuelve filtrable solo, sin código por campo.
  Texto, número y fecha quedaron fuera: piden otros controles y en un kanban
  rinden menos que la búsqueda por título.
- `filterableFields()` excluye el campo de agrupación: filtrar por él sería
  filtrar por columna, que es lo que el tablero ya muestra. Un parámetro viejo
  de ese campo en la URL queda inerte, no filtra a ciegas.
- `DropdownSelect` acepta `prefix`: el disparador dice qué campo filtra
  ("Prioridad: alta"), no solo el valor. El `name` que ya tenía sólo genera
  inputs ocultos para formularios, no una etiqueta visible.
- La URL lleva un parámetro por campo (`?assignees=ana,beto&priority=alta`), no
  un blob JSON. Las pestañas Semana/Todas y Archivadas conservan los filtros.
- El encabezado muestra "N de M tarjetas" y el botón Limpiar dice cuántas hay
  ocultas: al reordenar con filtros puestos, importa saber que hay tarjetas que
  no se ven.
- **Orden con filtros:** se mantiene la semántica que ya tenía `card.move`
  (insertar junto al vecino visible). Al quitar el filtro, la tarjeta queda
  inmediatamente sobre aquella donde se soltó. La alternativa —permutar sólo las
  posiciones que ocupan las visibles— obligaría a que `card.move` conociera el
  filtro del que llama, y entonces la CLI tendría que reproducirlo para reordenar
  igual. Ver la discusión en la bitácora.

### 2026-09-08 — Archivo: etapa guardada y vista de lista

- `card.archive` deja de tocar la columna: guarda la **etiqueta** de la etapa, no
  su id. Copia y no referencia, para que borrar la opción no borre el dato ni
  haya que impedir borrarla. La etapa vive en un solo lugar según el estado de la
  tarjeta: en `values[groupingId]` si está activa, en `archivedStage` si está
  archivada, nunca en los dos.
- Al restaurar se busca la opción por etiqueta: vuelve a su columna si sigue
  existiendo con ese nombre. Renombrada o borrada, la tarjeta queda sin estado.
- `tests/archive.test.ts` prueba las tres ramas con una tienda en memoria: sin
  base ni servidor, `createService` corre entero contra un `Map`.
- El archivo pasó a lista: una tarjeta archivada ya no tiene columna, así que un
  kanban de una sola columna no decía nada. `Board` quedó solo para la semana y
  perdió el prop `view` y su rama muerta de creación.

### 2026-09-08 — UI del tablero: confirmación, etapas y panel

- `src/web/confirm.tsx`: `ConfirmProvider` + `useConfirm()`, una confirmación
  basada en promesa para toda acción que no se deshace sola. Modelado sobre el
  `UiConfirmationService` de my-cv-app. Escape y cierre cuentan como cancelar.
  Lo usan archivar tarjeta y eliminar etapa.
- `src/web/icon.tsx`: iconos de línea que heredan color y tamaño del texto. Se
  agregan cuando se usan; no entra una librería.
- Etapas: se agregan y eliminan desde el propio tablero con `field.update`, que
  ya limpiaba el valor en las tarjetas afectadas — no hizo falta acción nueva.
  Solo admins; la columna sintética "Sin estado" no se puede borrar.
- Panel lateral: entra y sale deslizando con `@starting-style` y transiciones
  `allow-discrete` en `display`/`overlay`, más el backdrop en opacidad. El
  bloque de `prefers-reduced-motion` ya las anula.
- Cabecera del panel: cierra con `»` a la izquierda, se quitó la `×`, y
  Archivar lleva icono y confirmación. El título de la tarjeta vive ahí y se
  edita ahí: la cabecera es pegajosa, así que sigue visible al hacer scroll.
- Los botones de cerrar se estilan por su clase `.dialog-close`, no por
  `:last-child`: con el selector viejo, cualquier botón agregado al final de una
  cabecera heredaba el aspecto del de cerrar (le pasó a Archivar).
- Crear una tarjeta abre su panel: crear es el principio de escribirla.
- En la tarjeta, "Esta semana" pasó a ser un `.chip-week` que solo se lee. La
  clase ya existía; el toggle sigue en el panel, que es donde se edita.
- La tarjeta enfocada usaba el anillo gris genérico de `[role="button"]`: ahora
  funde un `outline` en `--info` con su propio borde, sin perder el indicador.

### 2026-09-08 — Feedback visual del arrastre

- Referencia tomada de PostulaLibre (`cv-app-aa083.web.app/applications`), leyendo
  sus bundles públicos: hover de tarjeta que solo cambia `border-color` al token
  de foco cian, y hueco de origen `1px dashed` con fondo `color-mix(... 8%)`.
- Se agregó el token `--info` (`#087f93` claro / `#56d6e7` oscuro) en styles.css.
- `.card:hover, .card:focus-visible` usa `--info` en vez de `--input`.
- El hueco marca el **destino**, no el origen. Al levantar, la tarjeta pasa a
  `position: fixed` con su rect medido, así que su espacio se cierra; `Board`
  mantiene el destino en estado y renderiza un `.drop-slot` real en esa columna,
  de modo que las vecinas abren el espacio antes de soltar.
- `dropTargetAt()` es la única función que decide dónde cae: la usan la vista
  previa y el drop real, así que no pueden divergir. El re-render ocurre solo
  cuando cambia el destino, no en cada `pointermove`. `.dragging` pasa a
  `cursor: grabbing`.
- Parpadeo corregido: el hueco desplaza a las vecinas, así que cambia lo que hay
  bajo el cursor; si eso cambiara el destino, el layout oscilaría. El cursor
  sobre el hueco significa "ya estás en el destino" y conserva el actual.
- Se suelta en el destino que se mostró, no en un hit-test nuevo al soltar.
- `tests/e2e/drag-slot.spec.ts` cubre lo que puede romperse en silencio: que el
  hueco ocupe espacio real y que el hit-test lo vea. Sin servidor ni base.

### 2026-09-08 — Respuestas e inspección de exports

- Confirmaciones de alcance registradas en SPEC.md: toda la v1, tablero único,
  invitaciones sin correo, orden manual, sin edición masiva, editor visual con imágenes,
  archivo/restauración, actualizaciones en vivo e identidad de agente y dueño en auditoría.
- Se inspeccionaron ambos ZIP de Downloads sin modificar los originales. Los CSV
  completos son idénticos y contienen 1006 filas; hay 231 IDs de páginas Markdown
  únicos en la unión de los ZIP. No se puede afirmar que estén todos los cuerpos.
- Estados encontrados: no comenzado, cooking, QA, staged, deployed, listo, descartado
  y vacío. Prioridades: alta, media, baja y vacío. Weekly: 129 filas marcadas.
- Investigación inicial con fuentes oficiales: arquitectura hexagonal, server routes
  de TanStack, Electric Sync sobre PostgreSQL y alternativa LISTEN/NOTIFY + SSE.
  Todavía no se cerró la elección ni se escribió código de features.
- Pendientes de aclaración: semana, roles, conflictos de edición, idioma y tratamiento
  de relaciones/campos calculados/cuerpos faltantes durante la importación.

### 2026-09-08 — Inicio de implementación: aclaraciones previas

- Se leyeron los seis documentos raíz y se inventariaron las skills vendorizadas.
- El usuario pidió empezar a construir, con preguntas previas y sin asumir decisiones
  no documentadas. No se escribió código ni se cerraron decisiones técnicas.
- Pendiente de respuesta: alcance de la primera entrega, tableros, permisos y altas,
  semántica semanal, propiedades y orden, edición concurrente, eventos y webhooks,
  migración de Notion y restricciones de infraestructura.
- Arquitectura y capa HTTP siguen pendientes de investigación y decisión documentada.

### 2026-09-08

- **VISUAL.md**: se completó la sección "Lenguaje visual", que estaba pendiente.
  Base: análisis de Dell 1996 (`getdesign.md/dell-1996`), tomado sobrio — estructura sí,
  kitsch no. Tokens de color, tipografía de dos familias de sistema, escala de espaciado
  base 4, radio 0, profundidad por borde.
- **VISUAL.md**: se agregaron tres secciones nuevas — "Snappy" (presupuesto de respuesta,
  optimista por defecto, drag a 60fps, view transitions, CLS 0), "Prefetch" (precarga por
  intención con TanStack Router, qué y cuándo, y cuándo no) y "Mobile" (breakpoints,
  gestos táctiles).
- **AGENTS.md**, **CLAUDE.md**, **ESTADO.md**: creados. Las reglas del repo en AGENTS.md,
  el ruteo de skills en CLAUDE.md, el avance acá.
- **Skills**: vendorizadas en `.claude/skills/`. De `vercel-labs/agent-skills` se tomaron
  las cuatro aplicables (`composition-patterns`, `react-best-practices`,
  `react-view-transitions`, `web-design-guidelines`) con prefijo `vercel-`; se
  descartaron `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize` (el
  despliegue es Coolify) y `react-native-skills`. Se sumaron cinco skills
  más de escritura, prompting, review y diseño de software.
- **Favicon**: `public/favicon.svg` — cuadrado redondeado blanco con borde negro y una "S"
  geométrica, guiño al ícono de Notion. Linkeado desde `index.html`. Primer archivo en
  `public/` (Vite lo copia a `dist/web` en el build).

### 2026-09-09

- **CLI**: `pnpm cli help` (también sin argumentos, `--help` o `-h`) documenta uso,
  variables de entorno, forma de la salida y errores, operaciones de sesión y cómo
  averiguar la identidad propia con `history.list`. No lista las acciones a propósito:
  para eso está `catalog.read`, y así la ayuda no se desincroniza del catálogo.

- **CLI instalable**: `pnpm -s install:cli` deja `sloption` en `~/.local/bin`
  (o en `$SLOPTION_BIN`) como symlink al repo. Corre con Node 24+ sin dependencias
  ni `pnpm install`, así que un agente clona, instala y usa; actualizar es `git pull`.
