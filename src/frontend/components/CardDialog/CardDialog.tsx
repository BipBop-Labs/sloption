import "./CardDialog.css";
import { lazy, Suspense, useState } from "react";
import type { Card, Field, Profile, Value } from "@/backend/domains/kernel";
import type { Update } from "@/frontend/lib/update";
import {
  Chip,
  chipColor,
  DropdownSelect,
  Icon,
  Modal,
  useConfirm,
} from "@/frontend/ui";
const DocumentEditor = lazy(() => import("../DocumentEditor/DocumentEditor"));

function PropertyInput({
  field,
  current,
  profiles,
  save,
}: {
  field: Field;
  current: Value | undefined;
  profiles: Profile[];
  save(value: Value): void;
}) {
  if (
    field.type === "select" ||
    field.type === "multiSelect" ||
    field.type === "people"
  ) {
    const multiple = field.type !== "select";
    return (
      <DropdownSelect
        label={field.name}
        multiple={multiple}
        clearable={!multiple}
        value={
          multiple
            ? Array.isArray(current)
              ? current
              : []
            : typeof current === "string"
              ? current
              : ""
        }
        options={
          field.type === "people"
            ? profiles.map((profile) => ({
                id: profile.id,
                label: profile.name,
              }))
            : field.options
        }
        onChange={(next) => save(next === "" ? null : next)}
      />
    );
  }
  return (
    <input
      key={JSON.stringify(current)}
      aria-label={field.name}
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      defaultValue={
        typeof current === "number" || typeof current === "string"
          ? current
          : ""
      }
      onBlur={(event) => {
        const text = event.target.value;
        const next =
          text === "" ? null : field.type === "number" ? Number(text) : text;
        if (next !== current) save(next);
      }}
    />
  );
}
export function CardDialog({
  card,
  fields,
  profiles,
  close,
  update,
  onError,
}: {
  card: Card;
  fields: Field[];
  profiles: Profile[];
  close(): void;
  update: Update;
  onError(message: string): void;
}) {
  const confirm = useConfirm();
  const [title, setTitle] = useState(card.title);
  const [documentPending, setDocumentPending] = useState(false);
  function requestClose() {
    if (documentPending || title !== card.title) {
      onError(
        "Hay cambios sin guardar. Espera a que se guarden o reintenta antes de cerrar.",
      );
      return;
    }
    close();
  }
  return (
    <Modal
      label="Detalle de tarjeta"
      className="card-dialog drawer"
      onClose={requestClose}
    >
      <header className="dialog-header">
        <button
          className="dialog-close"
          onClick={requestClose}
          aria-label="Cerrar tarjeta"
        >
          »
        </button>
        <input
          className="card-title"
          aria-label="Título"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title !== card.title)
              void update("cards.update", {
                id: card.id,
                version: card.version,
                title,
              });
          }}
        />
        <button
          onClick={async () => {
            const archiving = !card.archived;
            if (
              archiving &&
              !(await confirm({
                title: "¿Archivar esta tarjeta?",
                message:
                  "Sale del tablero. Puedes restaurarla desde Archivadas.",
                confirmLabel: "Archivar",
              }))
            )
              return;
            void update(
              "cards.archive",
              { id: card.id, archived: archiving },
              { archived: archiving },
            );
          }}
        >
          <Icon name={card.archived ? "restore" : "archive"} />
          {card.archived ? "Restaurar" : "Archivar"}
        </button>
      </header>
      <div className="property-row">
        <span>Planificación</span>
        <button
          className={card.weekly ? "chip week-mark marked" : "chip week-mark"}
          aria-label="Esta semana"
          aria-pressed={card.weekly}
          onClick={() => {
            // La predicción del caché ya deja card.weekly en el valor nuevo, y
            // si la acción falla lo devuelve sola. No hace falta copiarlo acá.
            const next = !card.weekly;
            void update(
              "cards.week",
              { id: card.id, weekly: next },
              { weekly: next },
            );
          }}
        >
          Esta semana
        </button>
      </div>
      {card.archived && card.archivedStage && (
        <div className="property-row">
          <span>Última etapa</span>
          <Chip color={chipColor(card.archivedStage)}>
            {card.archivedStage}
          </Chip>
        </div>
      )}
      {fields.map((field) => (
        <div className="property-row" key={field.id}>
          <span>{field.name}</span>
          <PropertyInput
            field={field}
            current={card.values[field.id]}
            profiles={profiles}
            save={(value) => {
              void update("cards.update", {
                id: card.id,
                version: card.version,
                values: { [field.id]: value },
              });
            }}
          />
        </div>
      ))}
      {card.bodyMissing && (
        <p className="help">
          El export de Notion no incluye el cuerpo de esta tarjeta.
        </p>
      )}
      <Suspense fallback={<p>Cargando editor…</p>}>
        <DocumentEditor
          card={card}
          onError={onError}
          onPendingChange={setDocumentPending}
        />
      </Suspense>
    </Modal>
  );
}
