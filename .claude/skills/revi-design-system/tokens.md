# Tokens de Revi — valores literales por producto

## Contenido
- Compartidos entre los tres productos
- Norman y Clara (revi-mono): capas `cchc-*` y `ui-*`, conmutación por rol
- Celeste (revi-dga-mono): paleta completa
- Tipografía (canon transversal)
- Espaciado (canon transversal)
- Radios, sombras y contenedores
- Tokens muertos y deuda conocida

## Compartidos entre los tres productos

Estos valores son idénticos en ambos repos; para un producto nuevo son el punto de
partida no negociable:

| Rol | Valor | Nota |
|---|---|---|
| Éxito | `#458f68` (variante fuerte `#366b4f`) | N/C: `cchc-success[-muted]`; Celeste: `success[-strong]` |
| Advertencia | `#fbb900` | N/C: `cchc-yellow-accent`; Celeste: `warning` (superficie `#fdf8e9`) |
| Fondo | `#ffffff` | Solo modo claro |
| Radio base | 10px | Escalas compatibles: 6 / 8 / 10 / 14 (+16 en Celeste) |
| Header | 60px de alto, fondo blanco | |
| Sidebar | 256px expandida ↔ 64px colapsada (rail), persistida | |
| Columna de chat | 800px máximo | |
| Gutter | `px-4 sm:px-6` (16→24px) | |

## Norman y Clara (revi-mono/frontend/project)

Los tokens viven en `app/globals.css`. Hay dos prefijos con roles distintos:

- **`cchc-*`** — conmuta con la persona activa (un `ThemeContext` reescribe las
  variables en runtime según el rol). Úsalo en chat, formularios y todo lo que deba
  teñirse del asistente.
- **`ui-*`** — fijo, no conmuta. Úsalo en navegación y chrome de la app que debe verse
  igual para ambos roles.

Paleta conmutable (los valores se **invierten** entre personas):

| Token | Norman (reviewer) | Clara (applicant) |
|---|---|---|
| `cchc-primary` | `#0185f3` | `#e23615` |
| `cchc-primary-muted` (hover) | `#0367c5` | `#c42e12` |
| `cchc-primary-light` | `#0185f320` | `#e2361520` |
| `cchc-primary-border` | `#0185f330` | `#e2361550` |
| `cchc-secondary` | `#e23615` | `#0185f3` |
| `cchc-soft` (superficie suave) | `#f0f4f8` | `#f8f0f0` |

Fijos con prefijo `ui-*`: `ui-primary #0185f3` · `ui-primary-muted #0367c5` ·
`ui-primary-light #0185f320` · `ui-secondary #e23615` · `ui-soft #f0f4f8`.

Fijos con prefijo `cchc-*` (no conmutan pese al prefijo): `cchc-success #458f68` ·
`cchc-success-muted #366b4f` · `cchc-accent #ba53a6` (morado HITL) ·
`cchc-yellow-accent #fbb900` · `cchc-text #6b7280` (cuerpo) · `cchc-text-bold #333333`
(énfasis) · `cchc-link #0185f3` · `cchc-border #e5e7eb`. Las variantes `*-light` y
`*-border` son el mismo hex con alfa (`#458f6820`, `#fbb90050`).

Ojo: los tokens shadcn de la app (`--primary`, `--secondary`…) son **grises neutros**,
no marca. `bg-primary` ahí pinta casi negro; la marca siempre va por `cchc-*`/`ui-*`.

## Celeste (revi-dga-mono/frontend)

Todo vive en `src/styles.css` (Tailwind v4 CSS-first; el bloque `@theme` es la config).

Marca:

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#00c3ff` | Solo acentos: foco, bordes activos, puntos de estado. **Nunca relleno con texto** (2:1 con blanco) |
| `primary-strong` | `#0079a3` | Rellenos de botón y texto de marca (4.95:1) |
| `primary-deep` | `#0b1b2b` | Hover de rellenos; también es la tinta |
| `link` | `#0079a3` | Enlaces |

Semánticos: `success #458f68` · `success-strong #366b4f` · `warning #fbb900` ·
`warning-surface #fdf8e9` · `error #c0392b`.

Neutrales (con matiz azul deliberado, no grises puros):
`surface #ffffff` · `surface-muted #f3f8fb` · `surface-soft #f7fbfd` ·
`surface-accent #e9f7fe` · `on-surface #0b1b2b` (texto) ·
`on-surface-variant #41576b` (texto secundario) · `muted-foreground #647585`
(oscurecido desde `#8296a6` para cumplir AA 4.75:1) · `border #e4ecf2` ·
`input #d6e1ea` · `ring #00c3ff`.

**Canon transversal de neutros**: el enfoque de Celeste — neutros propios con matiz de
marca — es el estándar para lo nuevo. El `gray-*`/`#6b7280` de Norman/Clara funciona
pero es la versión vieja de la misma idea.

## Tipografía (canon transversal)

- **Roboto** — cuerpo. Cuerpo de trabajo **14px**. Pesos cargados: 400 y 500; no uses
  `font-semibold`/`font-bold` sobre Roboto (negrita sintética).
- **Space Grotesk** — títulos (`h1–h4`) y micro-etiquetas en mayúsculas. Pesos: 500,
  600, 700.

Escala semántica (implementada en Celeste; canon para productos nuevos — en
Norman/Clara hoy se usa `text-sm`/`text-xs` crudo, deuda conocida):

| Utilidad | Tamaño/interlínea | Peso | Uso |
|---|---|---|---|
| `text-headline-md` | 24/32 | 700 | Título de página |
| `text-title-lg` | 20/28 | 600 | Título de sección/tarjeta |
| `text-body-md` | 14/20 | 400 | Cuerpo por defecto |
| `text-body-sm` | 12/16 | 400 | Secundario, tablas |
| `text-label-md` | 14/20 | 500 | Botones, labels |
| `text-label-sm` | 12/16 | 500 | Labels compactos |
| `text-label-caps` | 12/16, tracking +0.08em | 500 | Micro-etiquetas MAYÚSCULAS |
| `text-caption` | 12/16, tracking +0.01em | 400 | Notas al pie |

Si necesitas un paso que no existe (p. ej. los `text-[13px]` de tablas densas que
ambos productos improvisan), propone agregarlo a la escala; no siembres arbitrarios.

## Espaciado (canon transversal)

Base **4px**, ritmo visual **8px** (la escala default de Tailwind: `1` = 4px). Los
pasos canónicos, extraídos de la frecuencia real de uso en ambas apps:

| Contexto | Receta | En px |
|---|---|---|
| Icono ↔ texto dentro de un control | `gap-1.5`..`gap-2` | 6–8 |
| Elementos hermanos (botonera, chips, filas de meta) | `gap-2` | 8 |
| Campos de un formulario entre sí | `gap-4` | 16 |
| Label ↔ su input | `gap-1.5` | 6 |
| Secciones/tarjetas entre sí | `gap-6` / `mt-6` | 24 |
| Padding de control (botón, input) | `px-3` (compacto `px-2.5`, diálogo `px-4`) | 12 |
| Padding de tarjeta | `p-6` (compacta `p-4`) | 24 / 16 |
| Padding de celda de tabla | `px-3 py-3` | 12 |
| Padding de toast | `p-3.5` | 14 |
| Gutter de página | `px-4 sm:px-6` | 16→24 |

Alturas de control alineadas: botones e inputs **`h-9`** (36px); compactos `h-7`/`h-8`
en tablas y admin; `h-10` solo en diálogos de ancho completo; botón-icono `h-8 w-8`.
No introduzcas valores fuera de la escala de 4px (`p-[13px]`, `mt-[18px]`…): si un
espacio "necesita" un valor intermedio, el problema suele ser el paso vecino.

## Radios, sombras y contenedores

Radios (misma semántica en ambos repos): controles **8px** (`rounded-md`) · diálogos
**10px** (`rounded-lg`) · tarjetas **14px** (`rounded-xl`) · composer de chat y
burbujas **16px** (`rounded-2xl`) · chips y avatares `rounded-full`. Evita `rounded` a
secas (4px, fuera de escala).

Sombras con semántica asignada (valores estándar Tailwind): `shadow-xs` controles ·
`shadow-sm` tarjetas · `shadow-lg` overlays y composer · `shadow-xl` drawers y hover
de paneles. La profundidad crece apilando blanco + sombra, nunca oscureciendo.

Contenedores: página ~1280px máx; columna de lectura/chat **800px**; drawers laterales
`max-w-sm` (384px); toasts ~380px.

## Tokens muertos y deuda conocida

Para no confundirse al leer el código existente:

- **Norman/Clara**: bloque `.dark` completo sin activar (no hay modo oscuro);
  `--sidebar-*` y `--chart-*` sin uso; ~1.300 clases `gray-*`/`amber-*`/`red-*` crudas;
  cuatro fuentes de verdad para el color de marca. El ámbar crudo (`amber-50/300/700`)
  es el lenguaje de facto de "requiere tu decisión" — al tocarlo, migra hacia
  `#fbb900` + `warning-surface`.
- **Celeste**: alias shadcn declarados por defensa pero sin uso; `chart-*`,
  `container-page`, `warning-surface` sin uso; `text-[13px]` ×25 como escala paralela.
- El `DESIGN.md` de Celeste y el `ds-bundle/` de revi-mono describen estados viejos de
  sus códigos; ante conflicto, **manda el código fuente** (y esta skill).
