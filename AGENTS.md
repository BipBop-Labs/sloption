# AGENTS.md

Instrucciones para cualquier agente que trabaje en este repo. Vale para Claude Code,
Cursor, Codex o quien sea. **Leelo entero antes de escribir código.**

## Qué es esto

**Sloption**, el back office de Revi. Primer trabajo: reemplazar el kanban de Notion,
incluido el flujo de la weekly.

Cuatro documentos, y cada uno manda sobre lo suyo:

| Doc | Manda sobre |
|---|---|
| [SPEC.md](SPEC.md) | Qué hace y por qué. Alcance, modelo, decisiones de producto. |
| [CODE.md](CODE.md) | Stack, arquitectura, convenciones, Docker. |
| [VISUAL.md](VISUAL.md) | Lenguaje visual, interacción, performance percibida. |
| [ESTADO.md](ESTADO.md) | Dónde estamos hoy. **Se actualiza en cada sesión.** |

Si algo contradice a estos documentos, ganan ellos. Si vos creés que uno está mal,
decilo y proponé el cambio al documento — no lo esquives en el código.

## Las reglas que no se negocian

### 1. El núcleo no sabe quién lo llamó

UI, API HTTP y CLI son **tres adaptadores sobre la misma implementación**. Ninguno de
los tres contiene lógica de negocio.

Test de aceptación, de [SPEC.md](SPEC.md): tomar cualquier flujo de la UI y reproducirlo
completo desde la CLI, sin navegador. Si no se puede, falta una acción.

### 2. Toda operación es un endpoint, y todo endpoint declara su evento

Nombre estable, input tipado, output tipado, errores explícitos. Invocable desde los
tres adaptadores. Autoriza igual sin importar por dónde entró. Emite un evento de
esquema rígido y versionado al completarse, con un payload que define su dominio, o
declara `event: null`.

Si agregás una operación sin su definición en un `router.ts`, está incompleta. No hay
historial: los eventos se consumen por webhook.

### 3. No hay estado solo-frontend

Nada que un agente no pueda leer ni cambiar por API.

**La única excepción, y es aparente:** la UI optimista de [VISUAL.md](VISUAL.md). Eso
no es estado propio, es la **predicción del resultado de una acción** dibujada antes de
que el servidor conteste. La acción invocada es la misma que invocaría un agente.

### 4. Antes de la primera línea de código: elegir el patrón de arquitectura

Hexagonal / ports & adapters, DDD, el que corresponda. **Investigarlo, elegirlo,
justificarlo en [CODE.md](CODE.md).** No inventar uno.

El motivo está escrito en CODE.md y conviene repetirlo: sin una estructura rígida de
antemano, un modelo rápido y bienintencionado produce slop con forma de arquitectura.
Un estándar reconocible da un criterio externo contra el cual medir cada decisión.

Mientras esto esté abierto, **no se escribe código de features.**

### 5. El backend se corta por dominio

Cada dominio de `src/backend/domains/` tiene `router.ts` (solo definiciones y doc),
`orchestrator.ts` (una función por endpoint) y `services.ts` (lo reutilizable).

- Un orquestador usa servicios, propios o de otro dominio. **Nunca otro orquestador.**
- Los servicios son lo único que se comparte entre dominios.
- `src/backend/lib/` no importa dominios: los usa por puertos.

`tests/architecture.test.ts` falla si se rompe alguna. Detalle en [CODE.md](CODE.md).

### 6. El frontend tiene cuatro capas y no se mezclan

- `src/frontend/routes/` — **las páginas.** Una página es lo que el router monta y lo que la
  URL nombra. `router.tsx` es el árbol de rutas; hoy hay una sola, `BoardPage`.
- `src/frontend/components/` — **componentes con lógica.** Conocen el dominio, invocan
  acciones y consumen `ui/`. Los paneles que abre un parámetro de búsqueda —la tarjeta,
  configuración, propiedades— son componentes, no páginas: no tienen ruta propia.
- `src/frontend/ui/` — **primitivas tontas.** No conocen el dominio: sin `Card`, sin `Field`,
  sin acciones, sin queries. Reciben props y avisan por callback.
- `src/frontend/lib/` — lógica de vista que no es un componente: `api.ts`, `update.ts`,
  `filters.ts`, `drag.ts`, `stages.ts`. `main.tsx` es solo el entry y los proveedores.

**Un directorio por componente, con su CSS al lado**: `Board/Board.tsx` +
`Board/Board.css`, y el `.tsx` importa su `.css`. En la raíz de `src/frontend/` solo quedan
`main.tsx` y `styles.css`, y `styles.css` es solo lo global: tokens, estilo base de los
elementos y las pocas clases que comparten pantallas que no se conocen entre sí.

Antes de escribir un botón, un chip o un selector, mirá si ya está en `ui/` y reusalo. Si
falta, va ahí y se exporta desde su `index.ts` — no suelto en un componente ni en la raíz
de `src/frontend/`.

**Los imports que cruzan de capa usan el alias `@/`** (`@/backend/domains/kernel`,
`@/frontend/lib/api`, `@/frontend/ui`); dentro de la misma capa, ruta relativa. Así no
aparecen `../../../`.

Corolario de la regla 3: un componente **no copia a un `useState` algo que ya está en el
caché de queries.** La predicción optimista ya dejó ahí el valor nuevo. Detalle en
[CODE.md](CODE.md).

### 7. `pnpm` siempre, nunca `npm`

## Stack

TypeScript, monolito, un repo, un despliegue. Web + núcleo + CLI adentro.

TanStack (todo el frontend) · Drizzle (ORM y migraciones) · BetterAuth (email+password,
nada más) · pnpm · Coolify + Docker Compose.

**No es Vercel ni Next.js.** Si una guía te habla de `next/*`, App Router o del runtime
de Vercel, quedate con el principio de React y descartá lo específico de Next.

## Decisiones abiertas

Están en [ESTADO.md](ESTADO.md) con su estado real. Las dos grandes:

1. **Capa HTTP:** Hono, con TanStack Router y Query en el frontend.
2. **Patrón:** arquitectura hexagonal. Investigación y fundamento en CODE.md.

Si resolvés una, escribí la decisión **y su fundamento** en el doc que corresponde, y
actualizá ESTADO.md.

## Visual y performance

[VISUAL.md](VISUAL.md) es normativo. El usuario reemplazó la referencia Dell por una
apariencia similar a shadcn el 2026-09-08: tokens semánticos, claro/oscuro, chips y
selectores dropdown. Las tarjetas abren en un drawer lateral. Cero webfonts.
La preferencia de tema también es una acción persistida, accesible por API y CLI.
Mobile-first, UI optimista, drag por transform y transiciones con reduced motion.
El design system de los otros productos Revi sigue sin heredarse automáticamente.

## Qué NO construir

- Vistas que no sean kanban (tabla, calendario, timeline).
- Ciclos / sprints. Descartado explícitamente; la marca de "esta semana" alcanza.
- Login social, magic links, 2FA.
- El back office de las otras aplicaciones de Revi. La arquitectura tiene que
  admitirlo; la funcionalidad no se construye ahora.

## Higiene de sesión

1. Leé ESTADO.md antes de empezar.
2. Al terminar, **actualizá ESTADO.md**: qué cambió, qué decisión se cerró, qué queda.
   Es el único doc que se edita en cada sesión.
3. Las decisiones duraderas van a SPEC/CODE/VISUAL, no a ESTADO.md. ESTADO.md dice
   dónde estamos; los otros tres dicen cómo son las cosas.
