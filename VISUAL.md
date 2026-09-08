# Visual

> Lenguaje visual e interacción vigentes. Reemplaza la referencia Dell por indicación
> explícita del usuario del 2026-09-08.

## Lenguaje visual

Apariencia similar a shadcn: superficies neutras, bordes discretos, radios moderados,
sombras suaves y jerarquía tipográfica sobria. Los estilos se parametrizan en tokens CSS
semánticos en `src/web/styles.css`, no en valores repetidos por componente.

- Temas claro y oscuro. La preferencia se guarda en el perfil mediante
  `profile.preferences`, invocable desde UI, HTTP y CLI.
- Tokens de fondo, superficie, texto, texto secundario, borde, input, acento, foco,
  peligro, semana, chips, radio, tipografía y sombras.
- Tipografía sans de sistema, sin webfonts. El contenido usa la misma familia.
- Chips para estados, categorías, prioridades y selección de personas.
- La marca semanal es un chip con el texto **Esta semana**. No hay botón W.
- Los colores de chips tienen variantes legibles en ambos temas.

## Tablero y tarjeta

Dos vistas principales: **Esta semana** y **Todas**. El archivo permite restaurar
sin introducir una vista de tabla, calendario o timeline.

- Columnas derivadas de una propiedad de selección simple, compartida por el equipo.
- Arrastrar entre columnas cambia esa propiedad; dentro de la columna modifica el orden.
- La tarjeta muestra título, responsables y prioridad. La marca semanal es manual.
- Abrir la tarjeta muestra un **drawer lateral derecho**, de altura completa.
  En teléfono ocupa el ancho completo. No hay pantalla aparte de edición.
- Propiedades editables arriba; editor visual de contenido con imágenes abajo.
- Selección simple y múltiple mediante **dropdown**: clic abre un menú; los valores
  elegidos se muestran como chips. No se muestran listboxes nativos permanentes.
- No hay edición masiva, conforme a la aclaración del usuario.

## Interacción y accesibilidad

- Teclado para abrir, cerrar, elegir opciones y mover tarjetas; Escape cierra paneles.
- Focus visible, foco contenido en el drawer y restaurado al cerrarlo.
- Targets táctiles amplios. Scroll horizontal con snap por columna en mobile.
- Drag táctil con long-press; el gesto semanal tiene alternativa de clic en el chip.
- Estados de error visibles sin perder lo escrito.
- Texto de interfaz en español de Chile; código y contratos en inglés.

## Performance

- UI optimista como predicción de acciones reales, con reconciliación y rollback.
- Durante el drag solo cambia transform, sin re-render por frame.
- Editor y configuración se cargan por separado de la pantalla inicial.
- Prefetch por intención y caché TanStack de 30 segundos; no especular en conexiones
  lentas o con ahorro de datos.
- Sin spinners bajo 200 ms. Reservar espacio para evitar saltos de layout.
- Transiciones nativas de 150 ms, respetando reduced motion. React estable 19.2 no
  exporta ViewTransition; se usa la API nativa sin incorporar React experimental.
