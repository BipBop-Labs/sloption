import "./CardList.css";
import type {
  BoardState,
  Card,
  Field,
  Profile,
} from "@/backend/domains/kernel";
import { cardQuery, queryClient } from "@/frontend/lib/api";
import { Avatars, Chip, chipColor, Composer } from "@/frontend/ui";

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
  states,
  fields,
  profiles,
  open,
}: {
  groups: CardGroup[];
  states: BoardState[];
  fields: Field[];
  profiles: Profile[];
  open(id: string): void;
}) {
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
            // La archivada ya no pertenece a una etapa: muestra la etiqueta
            // que guardó al archivarse.
            const stage = card.archived
              ? card.archivedStage
              : states.find((state) => state.id === card.stateId)?.label;
            const priorityValue = card.properties.priority;
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
                  <Chip color={chipColor(card.stateId ?? stage)}>{stage}</Chip>
                )}
                {typeof priorityValue === "string" && (
                  <Chip color={chipColor(priorityValue)}>
                    {priority?.options.find(
                      (option) => option.id === priorityValue,
                    )?.label ?? priorityValue}
                  </Chip>
                )}
                <Avatars ids={card.assignees} people={profiles} />
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
