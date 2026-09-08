---
name: design-system
description: Design system de los productos Revi (Norman, Clara y Celeste), extraído del código real. Tokens por asistente, tipografía, espaciado, iconos y recetas de componentes y estados. Usar siempre que se cree o modifique UI de un producto Revi — pantallas, componentes, clases Tailwind, mockups o emails — aunque nadie diga "design system", para no inventar colores, márgenes ni estilos.
---

# Design system de Revi

Los productos Revi son herramientas de trabajo serias de gobierno digital: **sobrias,
técnicas y profesionales — densas pero ordenadas, nunca lúdicas ni recargadas**. La IA
asiste y el humano decide; la interfaz transmite eso con calma: sin celebraciones, sin
emojis, sin marketing.

Esta skill es **normativa**: cuando los productos divergen entre sí, fija el patrón
canónico para todo lo nuevo. El código existente puede diferir (se anota como deuda en
cada archivo); no "corrijas" código viejo hacia el canon salvo que te lo pidan.

El objetivo de fondo es que los **átomos estén alineados entre los tres productos**:
márgenes y paddings, radios, sombras, tipografía, iconos, inputs (incluida la subida
de archivos y carpetas), tablas, modales, toasts. Un mismo átomo debe verse y
comportarse igual sin importar en qué app vive.

## Los tres asistentes

| Asistente | Usuario | Dominio | Marca | Dónde vive |
|---|---|---|---|---|
| **Norman** | Revisor municipal (DOM) | Permisos de edificación | Azul `#0185f3` | `revi-mono/frontend/project`, rutas `/reviewer/*` |
| **Clara** | Solicitante | Permisos de edificación | Rojo `#e23615` | Misma app, rutas `/applicant/*` |
| **Celeste** | Analista DGA | Derechos de agua | Celeste `#00c3ff` (rellenos `#0079a3`) | `revi-dga-mono/frontend` |

Norman y Clara son **dos personas del mismo asistente en la misma app**: comparten el
árbol de componentes y la paleta se invierte según el rol (el azul de uno es el rojo de
la otra). Celeste es una app aparte con la misma identidad de fondo. Un asistente nuevo
hereda este sistema completo y solo define su color de marca.

## Reglas de oro

1. **Nunca inventes un color.** Todo color sale de los tokens del producto
   ([tokens.md](tokens.md)). Si falta un paso (un hover, una superficie), propone
   extender los tokens; no recurras a la paleta cruda de Tailwind (`gray-*`, `amber-*`,
   `red-*`) — su presencia en el código existente es deuda, no canon.
2. **El color vivo de marca es acento, no relleno.** Sirve para foco, bordes activos,
   puntos de estado y detalles. Un relleno con texto encima usa la variante fuerte del
   producto con contraste AA ≥ 4.5:1 (Celeste lo aprendió a golpes: `#00c3ff` da 2:1
   con blanco).
3. **Estados semánticos con los tokens declarados**: éxito `#458f68`, advertencia
   `#fbb900` (idénticos en los tres productos); el error usa el rojo de cada producto.
   Las escalas crudas `amber-*`/`emerald-*` que verás en el código son la desviación a
   migrar, no el estándar.
4. **Tipografía: Roboto para cuerpo, Space Grotesk para títulos.** Cuerpo de trabajo a
   14px. Máximo dos familias y dos pesos por pantalla, y solo pesos que estén cargados
   — un `font-bold` sobre una Roboto que solo cargó 400/500 produce negrita sintética,
   que se ve mal y es la falla más repetida del código actual.
5. **Solo modo claro.** La profundidad se logra apilando superficies blancas con sombra
   creciente, nunca oscureciendo fondos. (Única superficie oscura permitida: bloques de
   código en prosa.)
6. **Foco visible siempre**: navegar con teclado debe mostrar dónde estás; nunca
   `outline: none` sin un reemplazo visible. Cada app tiene su mecanismo — usa el del
   repo donde estés ([componentes.md](componentes.md)).
7. **Iconografía lucide exclusiva**, de trazo: `h-4 w-4` junto a texto normal,
   `h-3.5 w-3.5` en compacto, `h-5 w-5` en navegación. Sin otras librerías de iconos y
   sin emojis como iconos.
8. **Movimiento con intención y con freno**: easings expresivos tipo
   `cubic-bezier(0.16, 1, 0.3, 1)`, duraciones 180–620ms, y **todo** envuelto en
   `@media (prefers-reduced-motion: reduce)`. Una animación que no comunica un cambio
   de estado no va.
9. **Sentence case en todo** — botones, títulos, menús ("Subir expediente", nunca
   "Subir Expediente" ni MAYÚSCULAS). Las mayúsculas se reservan para micro-etiquetas
   de 10–12px con `tracking-wide`.
10. **Una acción primaria por superficie.** Un solo botón de relleno fuerte por
    pantalla/modal; el resto va en variantes secundarias o ghost.

## Cómo usar esta skill

- **Vas a elegir colores, fuentes, radios o sombras** → lee [tokens.md](tokens.md)
  (valores literales por producto, qué conmuta entre Norman y Clara, qué está muerto).
- **Vas a construir un botón, input, modal, toast, chip o tabla** → lee
  [componentes.md](componentes.md) (recetas con las clases exactas que usa cada
  producto).
- **Vas a armar una pantalla, un estado de carga/vacío/error, o animar algo** → lee
  [patrones.md](patrones.md) (layout, estados de UI, movimiento, accesibilidad,
  escala de z-index).
- **Vas a escribir texto de UI** (botones, errores, vacíos, tooltips) → usa la skill
  `microcopy` de este mismo repo; ahí vive la voz de Revi (tuteo chileno, sentence
  case, un CTA por superficie). Esta skill no la duplica.

Para un mockup o prototipo fuera de los repos (HTML suelto, artifact), usa los tokens
del producto correspondiente como variables CSS y las mismas recetas; no aproximes los
colores de memoria.

## Verificación: no degradar el puntaje de react-doctor

Al modificar UI dentro de un frontend real (no aplica a mockups sueltos), cierra con
un chequeo de salud React:

```bash
npx -y react-doctor --score --yes
```

Córrelo desde la raíz del frontend (`frontend/project` en revi-mono, que ya trae su
`doctor.config.json`; `frontend` en revi-dga-mono) **antes y después** de tu cambio:
el puntaje después no puede ser menor que el de antes, y el conteo de errores y
warnings tampoco puede subir (importa cuando el puntaje ya está en el piso y no puede
"bajar" más). Si empeoró, `npx -y react-doctor --yes --verbose` muestra las reglas
afectadas; corrige y vuelve a medir hasta recuperarlo. Las reglas de react-doctor a veces chocan con una decisión de diseño
legítima (p. ej. animar `height` en un collapse): en ese caso documenta la excepción
en un comentario junto al código, como ya hace `components/ui/collapse-reveal.tsx`.
