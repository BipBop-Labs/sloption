import "./Menu.css";
import * as Dropdown from "@radix-ui/react-dropdown-menu";

/** Menú de acciones. Es el hermano de `DropdownSelect`: aquel elige un valor,
 *  este dispara algo. El disparador lo pone quien lo usa — se le clona el
 *  comportamiento al elemento que le pases, así el botón sigue siendo suyo. */
export function Menu({
  label,
  trigger,
  side = "bottom",
  align = "start",
  className,
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className={["dropdown-menu", className].filter(Boolean).join(" ")}
          aria-label={label}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
        >
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function MenuItem({
  onSelect,
  children,
}: {
  onSelect(): void;
  children: React.ReactNode;
}) {
  return (
    <Dropdown.Item className="dropdown-item" onSelect={onSelect}>
      {children}
    </Dropdown.Item>
  );
}
