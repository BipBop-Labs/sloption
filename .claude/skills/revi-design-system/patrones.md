# Patrones de UI Revi — layout, estados, movimiento, accesibilidad

## Contenido
- Layout de aplicación
- Estados: carga, vacío, error
- Movimiento
- Accesibilidad
- Emails de producto y superficies externas

## Layout de aplicación

Shell transversal (ambas apps lo implementan igual):

```
┌──────┬──────────────────────────────────┐
│      │  Header h-[60px] bg-white        │
│ Side │──────────────────────────────────│
│ bar  │  Contenido (fondo blanco)        │
│      │  columna de chat max 800px       │
└──────┴──────────────────────────────────┘
```

- **Sidebar**: fija, colapsable `w-64` ↔ rail `w-16` con transición ~200ms; el estado
  se persiste (preferencias o localStorage). Marca del producto arriba, módulos al
  medio, cuenta abajo. En móvil se oculta (`-translate-x-full`).
- **Header**: 60px, blanco, contenido alineado; identidad/estado a la derecha.
- **Contenido**: fondo blanco; gutter `px-4 sm:px-6`; la lectura larga (chat, prosa)
  se centra a 800px. Paneles duales (chat + documento) van redimensionables con un
  divisor.
- Las tarjetas y paneles se separan con bordes y superficies suaves, no con sombras
  fuertes: la sombra crece solo al elevar (hover, overlay).

## Estados: carga, vacío, error

**Carga** — tres niveles, no se mezclan:

1. *Página completa*: spinner lucide `h-6 w-6 animate-spin` en color de marca fuerte +
   etiqueta ("Cargando expedientes…").
2. *En botón*: `Loader2 h-4 w-4 animate-spin` reemplaza al icono; el label cambia al
   gerundio ("Guardando…"). Sobre relleno primario: aro `border-2 border-white/30
   border-t-white`.
3. *Streaming de chat*: tres puntos de marca pulsando escalonados + "«Asistente» está
   pensando…".

Progreso determinado: barra `h-2 rounded-full` superficie suave + relleno de marca
fuerte, con `role="progressbar"` y `aria-valuenow/min/max`; `animate-pulse` solo en la
fase indeterminada. Si una espera supera ~300ms, di qué está pasando.

**Vacío** — frase completa con qué es y qué hacer, sin disculpas ni ilustraciones:
"Aún no hay expedientes asignados. Los verás aquí cuando te lleguen." (patrones de
texto en la skill `microcopy`).

**Error** — tres patrones:

1. *Inline junto al control*: `<p role="alert">` 12px en el rojo del producto.
2. *Banner de formulario*: **fondo blanco + borde neutro + texto en rojo** — nunca un
   banner de fondo rojo. `rounded-lg border bg-white px-4 py-3`.
3. *Fallo de operación larga* (stream, subida): tarjeta con borde neutro que explica
   qué pasó, por qué (atribuyendo la causa real: "dependemos de servicios externos…"),
   qué hacer (reintentar, ver estado), y un "Detalle técnico:" opcional en 12px.

El copy de error nunca culpa al usuario ni celebra: problema → razón → salida.

## Movimiento

El movimiento comunica cambios de estado; nada se anima por decorar. Vocabulario común
de ambas apps:

| Intención | Receta |
|---|---|
| Algo nuevo entra | fade + `translateY` corto (8–16px), 300–320ms |
| Streaming de texto | cada palabra emerge con `translateY(0.14em)` + blur 1.5px, 320ms |
| Decisión pendiente | glow pulsante lento (2.4s) en advertencia, alternado entre botones |
| Decisión tomada | la tarjeta "se asienta": 440ms con overshoot suave |
| Recompensa puntual | pop con overshoot 520–620ms (desbloqueo, "+1 al acta") |
| Falta algo / error de campo | shake 0.4–0.5s |
| Toast que llega | shake con **delay 150ms** (la vista está en otra parte al disparar) |
| Espera | puntos pulsando 1.4s infinito — "una respiración, no un parpadeo" |

- Easing canon: `cubic-bezier(0.16, 1, 0.3, 1)` (salida expresiva); overshoot
  `cubic-bezier(0.34, 1.26..1.56, 0.64, 1)` solo para asentar/recompensar.
- Transición base de controles: 180–200ms ease en color/borde/sombra.
- **Todo** keyframe propio va acompañado de `@media (prefers-reduced-motion: reduce)`
  que lo desactiva — y si la animación parte con `opacity: 0`, la regla reducida debe
  devolver `opacity: 1` o el contenido queda invisible. Ambas apps cumplen esto al
  100%; no seas la excepción.

## Accesibilidad

- Contraste AA (≥ 4.5:1) en todo texto sobre relleno. Los tokens ya lo garantizan si
  usas la variante fuerte para rellenos; no lo deshagas con opacidades.
- `<html lang="es">` (+ `translate="no"` en apps React: Google Translate rompe el
  reconciliador).
- Foco visible siempre (receta en componentes.md); `cursor: pointer` en botones.
- Iconos decorativos con `aria-hidden="true"`; botones-icono con `aria-label` en
  español escrito a mano ("Colapsar barra lateral", no "botón").
- Modales: `role="dialog" aria-modal="true"` + Escape + focus trap (deuda en el código
  existente; obligatorio en modales nuevos).
- `role="alert"` en errores, `role="progressbar"` con valores en barras de progreso.
- `prefers-reduced-motion` sin excepciones.

## Emails de producto y superficies externas

Misma identidad fuera de la app: fondo blanco, un solo CTA como botón de relleno
fuerte del producto, sentence case, sin imágenes decorativas ni urgencia. Para el
texto, skill `microcopy` (los emails institucionales tienen su propio registro).
En mockups/artifacts: define los tokens del producto como variables CSS al inicio y
construye con ellos; no aproximes de memoria ni uses paletas por defecto.
