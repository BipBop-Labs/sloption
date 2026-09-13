/** La fila de cuenta que va al pie de la barra lateral: inicial, nombre y una
 *  línea secundaria. Es un `<button>` y nada más — abrir un menú, un modal o lo
 *  que sea lo decide quien la usa. Sirve de disparador de `Menu`. */
import "./SidebarUser.css";
export function SidebarUser({
  name,
  detail,
  className,
  ...props
}: React.ComponentProps<"button"> & { name: string; detail?: string }) {
  return (
    <button
      type="button"
      {...props}
      className={["sidebar-user", className].filter(Boolean).join(" ")}
    >
      <span className="avatar" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <span className="sidebar-user-text sidebar-label">
        <span className="sidebar-user-name">{name}</span>
        {detail && <span className="sidebar-user-detail">{detail}</span>}
      </span>
      <span className="chevron" aria-hidden="true">
        ⌄
      </span>
    </button>
  );
}
