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

### 2. Toda operación es una acción, y toda acción emite un evento

Nombre estable, input tipado, output tipado, errores explícitos. Invocable desde los
tres adaptadores. Autoriza igual sin importar por dónde entró. Emite un evento de
esquema rígido y versionado al completarse.

Si agregás una operación y no le ponés nombre de acción ni evento, está incompleta.

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

### 5. El frontend tiene tres capas y no se mezclan

- `src/web/ui/` — **primitivas tontas.** No conocen el dominio: sin `Card`, sin `Field`,
  sin acciones, sin queries. Reciben props y avisan por callback.
- `src/web/components/` — **componentes con lógica.** Conocen el dominio, invocan
  acciones y consumen `ui/`.
- `src/web/*.ts` — lógica que no es un componente. `main.tsx` es solo el entry y el router.

Antes de escribir un botón, un chip o un selector, mirá si ya está en `ui/` y reusalo. Si
falta, va ahí y se exporta desde su `index.ts` — no suelto en un componente ni en la raíz
de `src/web/`. Un archivo por componente, con el nombre del componente: `Button.tsx`
exporta `Button`.

Corolario de la regla 3: un componente **no copia a un `useState` algo que ya está en el
caché de queries.** La predicción optimista ya dejó ahí el valor nuevo. Detalle en
[CODE.md](CODE.md).

### 6. `pnpm` siempre, nunca `npm`

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
