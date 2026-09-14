import { Link } from "@tanstack/react-router";
import type { Role } from "@/backend/domains/kernel";
import { Icon, Menu, MenuItem, Sidebar, SidebarUser } from "@/frontend/ui";

const ROLES: Record<Role, string> = {
  admin: "Administrador",
  member: "Miembro",
};

/** La navegación de la aplicación: el tablero, con sus vistas, y la cuenta abajo. */
export function AppSidebar({
  open,
  onOpenChange,
  name,
  role,
  onSettings,
  onSignOut,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  name: string;
  role: Role;
  onSettings(): void;
  onSignOut(): void;
}) {
  return (
    <Sidebar
      open={open}
      onOpenChange={onOpenChange}
      subtitle="TAREAS"
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
      <Link to="/" search={{ view: "week" }} aria-current="page">
        <Icon name="board" />
        <span className="sidebar-label">Tablero</span>
      </Link>
    </Sidebar>
  );
}
