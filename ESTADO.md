# Estado

**Última actualización:** 2026-09-08
**Fase:** v1 implementada y validada localmente. No desplegada.

## Implementado

- Arquitectura hexagonal documentada en CODE.md; TanStack Router/Query + Hono.
- PostgreSQL y Drizzle, migraciones y seed transaccional de administrador.
- Kanban, orden manual, marca semanal manual, archivo y restauración.
- Propiedades tipadas configurables; selección simple y múltiple mediante dropdowns.
- Editor visual Tiptap con imágenes, colaboración Yjs y Markdown persistido.
- Acciones comunes por HTTP y CLI, autorización de admins/miembros y auditoría.
- Invitaciones de un uso sin email, vinculación de identidades importadas.
- Agentes con API keys revocables, sin vencimiento; auditoría del agente y su dueño.
- Webhooks con firma HMAC, outbox durable y reintentos.
- Historial de eventos en su propia vista (`/?view=history`): tabla paginada por
  cursor. Sincronización SSE con recuperación por cursor.
- Drawer lateral, chips, apariencia similar a shadcn y tokens claro/oscuro.
  Tema persistido por usuario mediante acción. Esta indicación reemplazó Dell.
- Hover de tarjeta con borde `--info`; al arrastrar, la tarjeta sale del flujo y
  las vecinas abren un hueco punteado donde caería.
- Etapas del tablero editables en línea: agregar y eliminar con confirmación,
  solo para admins. Diálogo de confirmación e iconos reutilizables.
- Columnas reordenables con el mismo gesto que las tarjetas: se agarran por el
  encabezado, salen del flujo y las vecinas abren el hueco donde caerían.
  Alt+flechas para el teclado. Es `field.update` con las opciones en otro orden,
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

## Datos locales

Se importaron las 1006 tarjetas de los dos ZIP recibidos: 227 cuerpos asociados, 779
marcados como ausentes y cinco imágenes. Se omitieron dependencias, relaciones y
cálculos de otras bases. Las siete identidades del export se crearon como miembros sin
acceso; Eduardo Esquivel quedó excluido. Fechas originales conservadas como texto.

El frontend corre en http://localhost:5173. `.env` contiene credenciales locales
aleatorias y el admin `admin@sloption.local`; el archivo está ignorado por Git.
README.md explica arranque, importación, CLI y configuración para Coolify.

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
- No se reconstruyen cuerpos ausentes ni relaciones externas de Notion.
- No se desplegó a Coolify. La configuración usa el origen APP_URL y la red del proxy.

- Validación final: TypeScript y build aprobados; 11 tests unitarios, dos flujos
  de API/CLI/webhooks y el flujo de navegador aprobados. El menú del drawer se monta
  explícitamente dentro del diálogo para evitar interceptar o perder clics.
- Se retiraron las tarjetas E2E creadas durante las pruebas; los registros de auditoría
  y miembros de integración se conservan en el entorno local.

## Próximo paso

Usar la app y recoger ajustes del equipo. Mantener paridad UI/API/CLI en cada cambio.

## Bitácora

Formato: fecha — qué cambió. Agregá arriba, no abajo.

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
  despliegue es Coolify) y `react-native-skills`. De `ia-revi/skills` se tomaron seis con
  prefijo `revi-`; se omitió `daily` por ser un ritual de equipo ajeno al repo.
