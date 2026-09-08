# Recetas de componentes Revi

Clases literales extraídas del código real. Donde los productos difieren, se dan ambas
recetas; la anatomía (alturas, radios, jerarquía) es la misma.

## Contenido
- Iconografía (inventario)
- Botones
- Inputs y formularios
- Subida de archivos y carpetas
- Foco (receta transversal)
- Modales y drawers
- Toasts
- Chips, badges y estados de decisión
- Tablas
- Chat (composer, burbujas, thinking)

## Iconografía (inventario)

lucide-react exclusivo. Un concepto = un icono, siempre el mismo, en los dos repos:

| Concepto | Icono lucide | Nota |
|---|---|---|
| Cerrar / quitar | `X` | `h-3.5` en filas de lista, `h-4` en headers |
| Cargando | `Loader2` + `animate-spin` | `h-4` en botón, `h-6` a página completa |
| Enviar mensaje | `Send` | composer del chat |
| Subir archivos | `Upload` | `h-8` atenuado en dropzone |
| Agregar | `Plus` | `h-3` dentro de botón sm |
| Eliminar (destructivo) | `Trash2` | acompaña al label, nunca solo |
| Documento / archivo | `FileText` | filas de archivos |
| Expediente / carpeta | `FolderClosed` | crear/asociar: `FolderPlus` |
| Éxito / confirmado | `CheckCircle` | |
| Sugerencia de la IA (HITL) | `Sparkles` | en color advertencia |
| Historial / reciente | `History` | |

Tamaños canónicos: `h-4 w-4` junto a texto normal · `h-3.5 w-3.5` junto a `text-xs` ·
`h-5 w-5` en navegación/composer · `h-10 w-10` solo la marca del asistente en el hilo.
Siempre `flex-shrink-0`; decorativos con `aria-hidden="true"`; botones-icono con
`aria-label` en español. Si necesitas un concepto nuevo, elige un lucide y anótalo
aquí — dos iconos para la misma idea es el comienzo de la deriva.

## Botones

Anatomía transversal: altura **36px** (`h-9`), `rounded-md`, label 13–14px peso 500,
icono opcional `h-4 w-4`, `disabled:opacity-50..60`. Variantes compactas `h-7`/`h-8`
en tablas y admin; `h-10` en diálogos de ancho completo.

**Primario** (uno por superficie):

```
Norman/Clara:  bg-ui-primary hover:bg-ui-primary-muted text-white
               (si debe teñirse del asistente: bg-cchc-primary hover:bg-cchc-primary-muted)
Celeste:       focus-ring flex h-9 items-center rounded-md bg-primary-strong px-3
               text-[13px] font-medium text-white hover:opacity-90
```

**Secundario / outline**:

```
Celeste:       focus-ring h-9 rounded-md border border-input bg-surface px-3
               text-[13px] text-on-surface hover:bg-surface-muted
Norman/Clara:  borde + fondo blanco + hover con superficie suave (variante "outline")
```

**Destructivo**: relleno con el rojo del producto (`bg-error` en Celeste,
`bg-ui-secondary`/`destructive` en N/C) + `text-white hover:opacity-90`. El label
nombra la acción completa ("Eliminar expediente", nunca "Confirmar"); para acciones
graves se exige escribir `ELIMINAR`.

**Ghost / icono**: sin fondo, `h-8 w-8` centrado, `rounded-md`, texto secundario,
`hover:bg-<superficie-suave> hover:text-<texto-principal>`. Acción destructiva en fila
de tabla: `hover:bg-error/10 hover:text-error` (o rojo del producto al 10%).

## Inputs y formularios

```
Anatomía:      h-9 w-full rounded-md border px-3 + placeholder en texto atenuado
Celeste:       focus-ring h-9 rounded-md border border-input bg-surface px-3
               text-[13px] text-on-surface placeholder:text-muted-foreground
```

- Label siempre visible encima; el placeholder muestra formato esperado, nunca
  reemplaza al label (ver skill `microcopy`).
- Error inline bajo el campo: `<p role="alert">` en 12px con el rojo del producto.
- Textarea de chat: auto-crecible con tope (~160px), ver sección Chat.

## Subida de archivos y carpetas

El `<input type="file">` nativo nunca se muestra: va `hidden` y lo disparan botones.
Para carpetas completas, un segundo input con `webkitdirectory` (preserva la ruta
relativa de cada archivo).

**Dropzone** (cuando hay arrastre, patrón de Norman/Clara):

```
rounded-lg border-2 border-dashed p-4 text-center transition-all
  reposo:    border neutro + hover que lo oscurece un paso
  drag-over: borde y fondo en verde éxito (border-cchc-success bg-cchc-success-light)
+ icono Upload h-8 w-8 atenuado centrado
+ "Arrastra archivos o carpetas aquí, o" + botones outline sm:
  [+ Seleccionar archivos] [Seleccionar carpeta]
```

**Selector simple** (sin arrastre, patrón de Celeste): botón secundario que dispara el
input oculto; nada de zona punteada si no hay drag real.

**Lista de archivos elegidos** — una fila por archivo:

```
[FileText h-4 w-4] nombre (truncate, flex-1, title=nombre) · tamaño en caption
+ botón quitar X h-3.5 w-3.5, oculto hasta hover de la fila
  (opacity-0 group-hover:opacity-100 focus-visible:opacity-100), hover:text-error
+ aria-label="Quitar {nombre}"
```

**Progreso de subida**: texto de estado arriba ("Subiendo archivo 3 de 12: plano.pdf")
+ barra `h-2 rounded-full` con pista en superficie suave y relleno de marca fuerte,
`role="progressbar"` con `aria-valuenow/min/max`, `transition-all duration-300`;
`animate-pulse` solo en la fase indeterminada ("Creando expediente…"). Porcentaje en
caption debajo.

## Foco (por producto)

El foco de teclado siempre es visible; el mecanismo depende del repo — usa el que ya
existe donde estés trabajando, sin mezclar:

- **Celeste**: clase `focus-ring` (una `@utility` en `src/styles.css`): halo de 3px
  del color de marca al 50%, que pasa a rojo si el campo tiene `aria-invalid="true"`.
- **Norman/Clara**: el patrón shadcn por componente:
  `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`.

En ambos casos: nunca `outline: none` sin reemplazo visible.

## Modales y drawers

Modal (anatomía idéntica en los 5 modales de Celeste y los diálogos de N/C):

```
Overlay:   fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4
Tarjeta:   rounded-lg bg-white shadow-lg + max-w-md..lg + p-6
Semántica: role="dialog" aria-modal="true" + cierre con Escape + click en scrim
Botonera:  al pie, alineada a la derecha: [Cancelar (outline)] [Acción primaria]
```

Excepciones legítimas y documentadas: encuestas que deben contestarse no cierran con
Escape/scrim; mientras hay trabajo en curso, toda salida queda inerte. Deuda conocida
en ambos productos: falta focus trap — si agregas un modal nuevo, inclúyelo.

Drawer lateral derecho:

```
fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col
border-l border-<borde> bg-white shadow-xl
```

Escala z-index transversal: `10` sticky · `50` popovers/sidebar · `60` modales ·
`70` drawers · `80` modal sobre modal · `100` tooltips.

## Toasts

Receta compartida (idéntica carácter a carácter en ambos repos — es EL patrón):
sonner montado una sola vez con `position="bottom-right"`, y `toast.custom(...,
{ duration: 10000, unstyled: true })` — el estilo por defecto de sonner **no se usa**;
la tarjeta se dibuja entera:

```
w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-3.5
+ icono en caja h-9 w-9 rounded-lg
+ título 14px medium, cuerpo 12px atenuado, CTA 12px semibold con flecha " →"
+ animación de shake 0.5s con delay 150ms (la vista está en el composer cuando dispara)
```

Toda la tarjeta es click target, no solo el CTA. Los toasts son para *avisos que
esperan una decisión*; las confirmaciones de éxito van discretas y cerca de la acción.
Colores de la tarjeta según intención: advertencia con `#fbb900`/`warning-surface`
(canon; el `amber-*` crudo del código existente es deuda).

## Chips, badges y estados de decisión

No hay componente Badge: son `span` con receta.

```
Chip de estado:  rounded-full border px-3 py-1 text-xs  (+ colores semánticos)
Micro-etiqueta:  text-[10px]..text-xs font-semibold tracking-wide uppercase
```

Lenguaje de decisión HITL (de Norman/Clara, canon para superficies "la IA propone,
el humano decide"):

- **Pendiente de decisión**: superficie de advertencia + borde de advertencia + título
  en micro-etiqueta uppercase + icono `Sparkles`; el valor citado va en 11px sobre
  blanco con borde. Botones con glow pulsante alternado.
- **Guardado**: misma anatomía en verde éxito `#458f68` + micro-animación de
  recompensa ("+1 al acta").
- **Descartado**: `border-l-2` gris + texto atenuado con `line-through` + enlace
  "deshacer" pequeño. Lo descartado se encoge, no desaparece.
- **Resuelto/pasado**: superficie gris suave, sin acciones ("esto ya pasó, no es
  editable").

## Tablas

```
Header:  sticky top-0 z-10 px-3 py-3 text-left + Space Grotesk 12.5px semibold
         tracking ligero + texto secundario
Celda:   px-3 py-3 en 13px; filas con hover de superficie suave
Acción destructiva en fila:  icono ghost con hover:bg-error/10 hover:text-error
```

## Chat (composer, burbujas, thinking)

- **Composer**: `rounded-2xl border bg-white shadow-lg hover:shadow-xl` +
  `focus-within:` borde y ring de marca al 20%; textarea auto-crecible con tope;
  debajo, disclaimer fijo: "«Asistente» es una IA y puede cometer errores. Verifica
  las respuestas."
- **Mensaje del usuario**: burbuja `rounded-2xl border bg-white px-4 py-3` con borde
  neutro.
- **Mensaje del asistente**: **prosa sin burbuja**, precedida por la marca del
  asistente a `h-10 w-10`. Los enlaces en color link del producto.
- **Pensando**: 3 puntos del color de marca pulsando escalonados (0/150/300ms) +
  "«Asistente» está pensando…". Es una respiración, no un parpadeo.
- **Mensaje de sistema**: centrado, `rounded-lg` superficie gris suave, 12px.
- La columna del hilo se centra a **800px**.
