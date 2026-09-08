import "./CardList.css";
import type { Card, Field, Profile } from "@/core/model";
import { cardQuery, queryClient } from "@/web/lib/api";
import { Avatars, Chip, chipColor, Composer } from "@/web/ui";

export type CardGroup = {
  title: string;
  color?: number;
  cards: Card[];
  /** Si está, el grupo muestra su composer. Qué tarjeta crea lo decide quien lo pasa. */
  create?(title: string): void;
};

/** Lista de tarjetas agrupada, al estilo Notion: una fila por tarjeta bajo un
 *  encabezado plegable. Quién agrupa y con qué criterio lo decide quien la usa;
 *  acá solo se dibuja. Sin arrastre: para mover entre etapas está el kanban. */
export function CardList({
  groups,
  fields,
  profiles,
  groupingId,
  open,
}: {
  groups: CardGroup[];
  fields: Field[];
  profiles: Profile[];
  groupingId: string;
  open(id: string): void;
}) {
  const stages = fields.find((field) => field.id === groupingId);
  const priority = fields.find((field) => field.id === "priority");
  return (
    <div id="board-content" className="list" aria-label="Lista de tareas">
      {groups.map((group) => (
        <details className="list-group" open key={group.title}>
          <summary>
            <Chip color={group.color}>{group.title}</Chip>
            <span>{group.cards.length}</span>
          </summary>
          {group.cards.map((card) => {
            // La archivada ya no pertenece a una columna: muestra la etiqueta
            // que guardó al archivarse.
            const stage = card.archived
              ? (card.archivedStage ?? "")
              : String(card.values[groupingId] ?? "");
            const assignees = card.values.assignees;
            return (
              <button
                type="button"
                className="row"
                key={card.id}
                onClick={() => open(card.id)}
                onPointerEnter={() => {
                  void queryClient.prefetchQuery(cardQuery(card.id));
                }}
              >
                <span
                  className="row-title"
                  style={{ viewTransitionName: `title-${card.id}` }}
                >
                  {card.title}
                </span>
                {stage && (
                  <Chip color={chipColor(stage)}>
                    {stages?.options.find((option) => option.id === stage)
                      ?.label ?? stage}
                  </Chip>
                )}
                {typeof card.values.priority === "string" && (
                  <Chip color={chipColor(card.values.priority)}>
                    {priority?.options.find(
                      (option) => option.id === card.values.priority,
                    )?.label ?? card.values.priority}
                  </Chip>
                )}
                <Avatars
                  ids={Array.isArray(assignees) ? assignees : []}
                  people={profiles}
                />
              </button>
            );
          })}
          {!group.cards.length && <p className="row-empty">Nada por acá.</p>}
          {group.create && (
            <Composer
              label={`Nueva tarea en ${group.title}`}
              submitLabel={`Crear tarea en ${group.title}`}
              onSubmit={group.create}
            />
          )}
        </details>
      ))}
    </div>
  );
}
