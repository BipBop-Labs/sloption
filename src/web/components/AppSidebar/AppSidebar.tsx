import { Link } from "@tanstack/react-router";
import type { Role } from "@/core/model";
import type { BoardSearch } from "@/web/lib/filters";
import { Icon, Menu, MenuItem, Sidebar, SidebarUser } from "@/web/ui";

const ROLES: Record<Role, string> = {
  admin: "Administrador",
  member: "Miembro",
};

/** La navegación de la aplicación. Dos destinos y la cuenta abajo: el tablero
 *  con sus vistas es uno solo, y el historial no es una vista de tarjetas. */
export function AppSidebar({
  open,
  onOpenChange,
  view,
  name,
  role,
  onSettings,
  onSignOut,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  view: string;
  name: string;
  role: Role;
  onSettings(): void;
  onSignOut(): void;
}) {
  return (
    <Sidebar
      open={open}
      onOpenChange={onOpenChange}
      subtitle="REVI / TAREAS"
      title={
        <Link to="/" search={{ view: "week" }}>
          Sloption
        </Link>
      }
      footer={
        <Menu
          label="Cuenta"
          side="top"
          className="sidebar-menu"
          trigger={
            <SidebarUser
              name={name}
              detail={ROLES[role]}
              aria-label={`Cuenta de ${name}`}
            />
          }
        >
          <MenuItem onSelect={onSettings}>
            <Icon name="settings" />
            Configuración
          </MenuItem>
          <MenuItem onSelect={onSignOut}>
            <Icon name="exit" />
            Salir
          </MenuItem>
        </Menu>
      }
    >
      <Link
        to="/"
        // Volver al tablero desde el historial cae en la semana; si ya estabas
        // en una vista de tarjetas, te deja donde estabas.
        search={(previous: BoardSearch) => ({
          ...previous,
          view: previous.view === "history" ? "week" : previous.view,
        })}
        aria-current={view === "history" ? undefined : "page"}
      >
        <Icon name="board" />
        <span className="sidebar-label">Tablero</span>
      </Link>
      <Link
        to="/"
        search={(previous: BoardSearch) => ({ ...previous, view: "history" })}
        aria-current={view === "history" ? "page" : undefined}
      >
        <Icon name="history" />
        <span className="sidebar-label">Historial de eventos</span>
      </Link>
    </Sidebar>
  );
}
