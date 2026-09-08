# CLAUDE.md

**Leé [AGENTS.md](AGENTS.md) primero.** Ahí están las reglas del repo, el stack, las
decisiones cerradas y las abiertas. Este archivo solo agrega lo específico de Claude
Code para no duplicar — y para no desincronizarse.

Orden de lectura al empezar una sesión:

1. [AGENTS.md](AGENTS.md) — las reglas.
2. [ESTADO.md](ESTADO.md) — dónde estamos hoy.
3. El doc del área que vas a tocar: [SPEC.md](SPEC.md), [CODE.md](CODE.md) o
   [VISUAL.md](VISUAL.md).

## Skills del repo

Están vendorizadas en [.claude/skills/](.claude/skills/), así que funcionan sin
instalar nada. Cuándo usar cada una:

| Skill | Cuándo |
|---|---|
| `vercel-react-view-transitions` | Cualquier animación de la UI. Es **la** referencia para el snappy de VISUAL.md: abrir tarjeta, cambiar de vista, mover entre columnas, rollback optimista. Sin librerías de animación. |
| `vercel-react-best-practices` | Al escribir o refactorizar componentes. 70 reglas de performance. Ignorá lo que sea de Next.js o del runtime de Vercel — acá es TanStack. |
| `vercel-composition-patterns` | Al diseñar la API de un componente reusable, o cuando aparece proliferación de props booleanas. |
| `vercel-web-design-guidelines` | Auditoría de UI: accesibilidad, foco, targets táctiles. Corré esto antes de dar una pantalla por terminada. Descarga las reglas por red al ejecutarse. |
| `revi-ousterhout-software-design` | **Al elegir el patrón de arquitectura** (regla 4 de AGENTS.md) y en cualquier discusión de profundidad de módulo, ocultamiento de información o diseño de interfaces. Es la que más pesa en la etapa actual. |
| `revi-pr-review` | Revisar una PR o autorevisarse antes de abrirla. |
| `revi-microcopy` | Texto de UI: botones, errores, vacíos, confirmaciones. |
| `revi-best-prompting` | Prompts de agentes, tools o cualquier contenido dirigido a un LLM — incluye los usuarios virtuales de SPEC.md. |
| `revi-simple-writing` | Texto para gente sin contexto técnico. |
| `revi-design-system` | **NO aplica a este repo.** Está de referencia del ecosistema Revi. El lenguaje visual de Sloption es el de [VISUAL.md](VISUAL.md) y no hereda de Norman/Clara/Celeste. |

No está vendorizada `daily` — es un ritual de equipo contra Notion, no toca este repo.
Sigue disponible si tenés el plugin `revi-skills@revi` instalado a nivel usuario.

### Instalar las skills de Revi como plugin (opcional)

La versión vendorizada es una copia congelada. Para seguir la fuente actualizada:

```
/plugin marketplace add ia-revi/skills
/plugin install revi-skills@revi
```

Si preferís eso, borrá las carpetas `revi-*` de `.claude/skills/` para no tener dos
copias con nombres distintos.

## Cosas que se olvidan seguido

- `pnpm`, nunca `npm`.
- **No es Next.js.** Mucha guía de React asume Next; quedate con el principio y tirá lo
  específico.
- No agregues una tercera familia tipográfica ni un `@font-face`. Es decisión de
  performance, no de gusto. Ver [VISUAL.md](VISUAL.md).
- Antes de dar algo por hecho: si existe en la UI y no existe como acción invocable
  desde la CLI, no está hecho.
- **Actualizá [ESTADO.md](ESTADO.md) antes de cerrar la sesión.**
