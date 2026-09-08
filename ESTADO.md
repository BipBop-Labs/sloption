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
- Historial consultable y sincronización SSE con recuperación por cursor.
- Drawer lateral, chips, apariencia similar a shadcn y tokens claro/oscuro.
  Tema persistido por usuario mediante acción. Esta indicación reemplazó Dell.
- Hover de tarjeta con borde `--info`; al arrastrar, la tarjeta sale del flujo y
  las vecinas abren un hueco punteado donde caería.
- Etapas del tablero editables en línea: agregar y eliminar con confirmación,
  solo para admins. Diálogo de confirmación e iconos reutilizables.
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
