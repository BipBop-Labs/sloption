import "./BoardFields.css";
import { useState } from "react";
import { action, errorMessage, refresh, type BoardData } from "@/frontend/lib/api";
import { Button, DropdownSelect, Modal, SettingRow } from "@/frontend/ui";
import type { Field } from "@/backend/domains/kernel";

/** Las propiedades son la forma del tablero, no una preferencia de la cuenta:
 *  se editan desde el tablero mismo. Solo las ve quien administra —cambiar una
 *  propiedad le cambia las tarjetas a todo el equipo. Las etapas se editan en
 *  las columnas. */
export default function BoardFields({
  board,
  close,
  onError,
}: {
  board?: BoardData;
  close(): void;
  onError(message: string): void;
}) {
  async function perform(name: string, input: unknown) {
    try {
      const response = await action<Record<string, unknown>>(name, input);
      refresh();
      return response;
    } catch (error) {
      onError(errorMessage(error));
      return null;
    }
  }
  return (
    <Modal className="fields-dialog" label="Propiedades" onClose={close}>
      <header className="dialog-header">
        <h2>Propiedades</h2>
        <button
          className="dialog-close"
          onClick={close}
          aria-label="Cerrar propiedades"
        >
          ×
        </button>
      </header>
      <section>
        <p className="help">
          Las etapas se agregan, ordenan y quitan desde las columnas del tablero.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            if (
              await perform("fields.create", {
                name: data.get("name"),
                type: data.get("type"),
                options: [],
              })
            )
              form.reset();
          }}
        >
          <label>
            Nombre
            <input name="name" required />
          </label>
          <label>
            Tipo
            <DropdownSelect
              label="Tipo de propiedad"
              name="type"
              defaultValue="text"
              options={[
                { id: "text", label: "Texto" },
                { id: "number", label: "Número" },
                { id: "date", label: "Fecha" },
                { id: "select", label: "Selección" },
                { id: "multiSelect", label: "Selección múltiple" },
              ]}
            />
          </label>
          <button>Crear propiedad</button>
        </form>
        {board?.fields.map((field) => (
          <FieldSettings
            key={`${field.id}-${JSON.stringify(field.options)}`}
            field={field}
            perform={perform}
          />
        ))}
      </section>
    </Modal>
  );
}
function FieldSettings({
  field,
  perform,
}: {
  field: Field;
  perform(name: string, input: unknown): Promise<unknown>;
}) {
  const [name, setName] = useState(field.name);
  const [options, setOptions] = useState(field.options);
  const [newOption, setNewOption] = useState("");
  return (
    <details className="field-settings">
      <summary>{field.name}</summary>
      <label>
        Nombre
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {options.map((option, index) => (
        <SettingRow key={option.id}>
          <input
            aria-label={`Opción ${index + 1}`}
            value={option.label}
            onChange={(event) =>
              setOptions((items) =>
                items.map((item) =>
                  item.id === option.id
                    ? { ...item, label: event.target.value }
                    : item,
                ),
              )
            }
          />
          <button
            aria-label={`Subir ${option.label}`}
            disabled={index === 0}
            onClick={() =>
              setOptions((items) => {
                const copy = [...items];
                [copy[index - 1], copy[index]] = [
                  copy[index]!,
                  copy[index - 1]!,
                ];
                return copy;
              })
            }
          >
            ↑
          </button>
          <Button
            aria-label={`Eliminar opción ${option.label}`}
            variant="danger"
            onClick={() =>
              setOptions((items) =>
                items.filter((item) => item.id !== option.id),
              )
            }
          >
            ×
          </Button>
        </SettingRow>
      ))}
      {(field.type === "select" || field.type === "multiSelect") && (
        <SettingRow>
          <input
            aria-label={`Nueva opción de ${field.name}`}
            value={newOption}
            onChange={(event) => setNewOption(event.target.value)}
            placeholder="Nueva opción"
          />
          <button
            onClick={() => {
              if (newOption.trim()) {
                setOptions((items) => [
                  ...items,
                  { id: crypto.randomUUID(), label: newOption.trim() },
                ]);
                setNewOption("");
              }
            }}
          >
            Agregar
          </button>
        </SettingRow>
      )}
      <p className="help">
        Eliminar una opción limpia ese valor en las tarjetas.
      </p>
      <button
        onClick={() => {
          void perform("fields.update", { id: field.id, name, options });
        }}
      >
        Guardar propiedad
      </button>
      <Button
        variant="danger"
        onClick={() => {
          void perform("fields.remove", { id: field.id });
        }}
      >
        Eliminar propiedad
      </Button>
    </details>
  );
}
