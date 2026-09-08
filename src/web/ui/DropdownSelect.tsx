import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useRef, useState } from "react";
import { Chip, chipColor } from "./Chip";

export type Choice = { id: string; label: string };
export function DropdownSelect({
  label,
  value,
  defaultValue,
  options,
  onChange,
  multiple = false,
  name,
  placeholder = "Sin asignar",
  clearable = false,
  prefix,
}: {
  label: string;
  value?: string | string[];
  defaultValue?: string | string[];
  options: Choice[];
  onChange?(value: string | string[]): void;
  multiple?: boolean;
  name?: string;
  placeholder?: string;
  clearable?: boolean;
  /** Texto fijo dentro del disparador. En una barra de filtros hace falta para
   *  saber qué campo filtra cada control, no solo el valor elegido. */
  prefix?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement>();
  const [internal, setInternal] = useState<string | string[]>(
    defaultValue ?? (multiple ? [] : ""),
  );
  const selected = value ?? internal;
  const ids = Array.isArray(selected) ? selected : selected ? [selected] : [];
  function change(next: string | string[]) {
    setInternal(next);
    onChange?.(next);
  }
  return (
    <div className="dropdown-field">
      {name &&
        (multiple ? (
          ids.map((id) => (
            <input key={id} type="hidden" name={name} value={id} />
          ))
        ) : (
          <input type="hidden" name={name} value={ids[0] ?? ""} />
        ))}
      <Dropdown.Root
        modal={false}
        open={open}
        onOpenChange={(next) => {
          setContainer(trigger.current?.closest("dialog") ?? document.body);
          setOpen(next);
        }}
      >
        <Dropdown.Trigger
          ref={trigger}
          className="dropdown-trigger"
          aria-label={label}
        >
          {prefix && <span className="dropdown-prefix">{prefix}</span>}
          <span className="selected-chips">
            {ids.length ? (
              ids.map((id) => (
                <Chip key={id} color={chipColor(id)}>
                  {options.find((option) => option.id === id)?.label ?? id}
                </Chip>
              ))
            ) : (
              <span className="placeholder">{placeholder}</span>
            )}
          </span>
          <span className="chevron" aria-hidden="true">
            ⌄
          </span>
        </Dropdown.Trigger>
        <Dropdown.Portal container={container}>
          <Dropdown.Content
            className="dropdown-menu"
            sideOffset={6}
            align="start"
            collisionPadding={12}
          >
            <Dropdown.Label className="dropdown-label">{label}</Dropdown.Label>
            {multiple ? (
              options.map((option) => (
                <Dropdown.CheckboxItem
                  className="dropdown-item"
                  key={option.id}
                  checked={ids.includes(option.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    change(
                      checked
                        ? [...ids, option.id]
                        : ids.filter((id) => id !== option.id),
                    )
                  }
                >
                  <span className="check-slot">
                    <Dropdown.ItemIndicator>✓</Dropdown.ItemIndicator>
                  </span>
                  <Chip color={chipColor(option.id)}>{option.label}</Chip>
                </Dropdown.CheckboxItem>
              ))
            ) : (
              <Dropdown.RadioGroup value={ids[0] ?? ""} onValueChange={change}>
                {clearable && (
                  <Dropdown.RadioItem className="dropdown-item" value="">
                    <span className="check-slot">
                      <Dropdown.ItemIndicator>✓</Dropdown.ItemIndicator>
                    </span>
                    Sin asignar
                  </Dropdown.RadioItem>
                )}
                {options.map((option) => (
                  <Dropdown.RadioItem
                    className="dropdown-item"
                    key={option.id}
                    value={option.id}
                  >
                    <span className="check-slot">
                      <Dropdown.ItemIndicator>✓</Dropdown.ItemIndicator>
                    </span>
                    <Chip color={chipColor(option.id)}>{option.label}</Chip>
                  </Dropdown.RadioItem>
                ))}
              </Dropdown.RadioGroup>
            )}
            {!options.length && (
              <div className="dropdown-empty">Aún no hay opciones.</div>
            )}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
  );
}
