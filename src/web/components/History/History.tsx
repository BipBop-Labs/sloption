import "./History.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ActionEvent } from "@/core/actions";
import type { Card, Profile } from "@/core/model";
import { action } from "@/web/lib/api";
import type { BoardSearch } from "@/web/lib/filters";

type Entry = ActionEvent & { sequence: number };
const PAGE = 50;

export function History({
  profiles,
  cards,
}: {
  profiles: Profile[];
  cards: Card[];
}) {
  /** Cada página se pide con el `sequence` de la última fila de la anterior.
   *  La pila guarda los cursores usados para poder volver hacia adelante. */
  const [cursors, setCursors] = useState<number[]>([]);
  const [includeReads, setIncludeReads] = useState(false);
  const before = cursors.at(-1);
  const events = useQuery({
    queryKey: ["history", before, includeReads],
    queryFn: () =>
      action<Entry[]>("history.list", { before, limit: PAGE, includeReads }),
    placeholderData: (previous?: Entry[]) => previous,
  });
  const rows = events.data ?? [];
  const name = (id: string | null | undefined) =>
    profiles.find((profile) => profile.id === id)?.name ?? id;
  return (
    <section id="board-content" className="history">
      <label className="history-reads">
        <input
          type="checkbox"
          checked={includeReads}
          onChange={(event) => {
            setIncludeReads(event.target.checked);
            setCursors([]);
          }}
        />
        Mostrar también quién miró qué
      </label>
      <table>
        <thead>
          <tr>
            <th scope="col">Cuándo</th>
            <th scope="col">Qué pasó</th>
            <th scope="col">Quién</th>
            <th scope="col">Dónde</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((event) => {
            const entityId =
              typeof event.data.entityId === "string"
                ? event.data.entityId
                : null;
            // Solo los eventos de tarjeta llevan a una tarjeta; el resto apunta
            // a campos, webhooks o claves, que no tienen pantalla propia.
            const card = event.type.startsWith("card.")
              ? cards.find((item) => item.id === entityId)
              : undefined;
            return (
              <tr key={event.id}>
                <td>
                  <time dateTime={event.occurredAt}>
                    {new Date(event.occurredAt).toLocaleString("es-CL")}
                  </time>
                </td>
                <td>{event.type.replace(/\.v\d+$/, "")}</td>
                <td>
                  {name(event.actor.userId)}
                  {event.actor.agentId &&
                    ` / ${name(event.actor.agentId) ?? "Agente"}`}
                </td>
                <td>
                  {card ? (
                    <Link
                      to="/"
                      search={(previous: BoardSearch) => ({
                        ...previous,
                        card: card.id,
                      })}
                    >
                      {card.title}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && (
        <p>{events.isPending ? "Cargando…" : "Todavía no pasó nada."}</p>
      )}
      <nav className="history-pages" aria-label="Páginas del historial">
        <button
          onClick={() => setCursors((stack) => stack.slice(0, -1))}
          disabled={!cursors.length}
        >
          Más recientes
        </button>
        <button
          onClick={() =>
            setCursors((stack) => [...stack, rows.at(-1)!.sequence])
          }
          disabled={rows.length < PAGE}
        >
          Anteriores
        </button>
      </nav>
    </section>
  );
}
