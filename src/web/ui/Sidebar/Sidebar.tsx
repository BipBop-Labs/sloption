import { useEffect } from "react";
import "./Sidebar.css";

/** El ancho en el que la barra deja de ser columna y pasa a tapar la pantalla.
 *  Está también en Sidebar.css; si cambia uno, cambian los dos. */
const OVERLAY = "(max-width: 899px)";

/** La columna de navegación.
 *
 *  Cerrada no desaparece: se encoge a una tira de iconos que sigue siendo
 *  navegable, y las etiquetas se van animando su ancho hasta cero. Por eso
 *  cada fila se escribe con el icono primero y el texto envuelto en un
 *  `<span className="sidebar-label">`: eso es lo que se encoge. En pantallas
 *  angostas no hay lugar ni para la tira, así que ahí sí se va del todo y
 *  vuelve como cajón con velo.
 *
 *  El `<nav>` es una ranura sin API: cualquier `<a>` o `<button>` que le pongas
 *  adentro toma el aspecto de fila. Así entra un `Link` del router sin que las
 *  primitivas tengan que saber que existe un router. `footer` queda pegado
 *  abajo, separado del nav por el espacio que sobre. */
export function Sidebar({
  open,
  title,
  subtitle,
  label = "Navegación lateral",
  onOpenChange,
  footer,
  children,
}: {
  open: boolean;
  title?: React.ReactNode;
  subtitle?: string;
  label?: string;
  onOpenChange(open: boolean): void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Escape cierra el cajón cuando tapa la pantalla. Encogida no tapa nada, y
  // cerrarla desde cualquier campo con Escape sería una sorpresa.
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && matchMedia(OVERLAY).matches)
        onOpenChange(false);
    };
    addEventListener("keydown", escape);
    return () => removeEventListener("keydown", escape);
  }, [open, onOpenChange]);
  return (
    <>
      {open && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Cerrar navegación"
          onClick={() => onOpenChange(false)}
        />
      )}
      <aside
        className={open ? "sidebar sidebar-open" : "sidebar"}
        aria-label={label}
      >
        <div className="sidebar-header">
          <span className="sidebar-brand" aria-hidden={open ? undefined : true}>
            {title}
            {subtitle && <span className="sidebar-subtitle">{subtitle}</span>}
          </span>
          <button
            className="sidebar-collapse"
            type="button"
            aria-label="Ocultar navegación"
            aria-expanded={open}
            aria-hidden={open ? undefined : true}
            tabIndex={open ? undefined : -1}
            onClick={() => onOpenChange(false)}
          >
            «
          </button>
          {/* Encogida, el mismo hueco lo ocupa el botón que la vuelve a abrir:
              la tira nunca queda sin salida. */}
          <button
            className="sidebar-expand"
            type="button"
            aria-label="Mostrar navegación"
            aria-expanded={open}
            aria-hidden={open ? true : undefined}
            tabIndex={open ? -1 : undefined}
            data-tooltip="Mostrar navegación"
            onClick={() => onOpenChange(true)}
          >
            »
          </button>
        </div>
        {/* Navegar cierra el cajón solo cuando tapa la pantalla: si no, el
            destino quedaría tapado por la barra que lo acaba de abrir. */}
        <nav
          onClick={(event) => {
            if (
              (event.target as HTMLElement).closest("a") &&
              matchMedia(OVERLAY).matches
            )
              onOpenChange(false);
          }}
        >
          {children}
        </nav>
        {footer && <div className="sidebar-footer">{footer}</div>}
      </aside>
    </>
  );
}
