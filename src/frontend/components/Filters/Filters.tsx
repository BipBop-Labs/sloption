import "./Filters.css";
import { useNavigate } from "@tanstack/react-router";
import type { Field, Profile } from "@/backend/domains/kernel";
import {
  activeFilter,
  ASSIGNEES,
  EMPTY,
  type BoardSearch,
} from "@/frontend/lib/filters";
import { DropdownSelect } from "@/frontend/ui";

export function Filters({
  filterable,
  profiles,
  search,
  hidden,
}: {
  filterable: Field[];
  profiles: Profile[];
  search: BoardSearch;
  hidden: number;
}) {
  const navigate = useNavigate();
  function set(key: string, value: string | string[] | undefined) {
    void navigate({
      to: "/",
      search: (previous: BoardSearch) => ({
        ...previous,
        [key]: (Array.isArray(value) ? value : value ? [value] : []).join(",") || undefined,
      }),
      replace: true,
    });
  }
  const active =
    !!search.q ||
    activeFilter(search, ASSIGNEES).length > 0 ||
    filterable.some((field) => activeFilter(search, field.id).length);
  return (
    <div className="filters">
      <input
        className="filter-search"
        type="search"
        aria-label="Buscar por título"
        placeholder="Buscar…"
        value={String(search.q ?? "")}
        onChange={(event) => set("q", event.target.value || undefined)}
      />
      <DropdownSelect
        label="Encargado(s)"
        prefix="Encargado(s)"
        multiple
        placeholder="Cualquiera"
        value={activeFilter(search, ASSIGNEES)}
        options={[
          { id: EMPTY, label: "Sin asignar" },
          ...profiles.map((profile) => ({
            id: profile.id,
            label: profile.name,
          })),
        ]}
        onChange={(value) => set(ASSIGNEES, value)}
      />
      {filterable.map((field) => (
        <DropdownSelect
          key={field.id}
          label={field.name}
          prefix={field.name}
          multiple
          placeholder="Cualquiera"
          value={activeFilter(search, field.id)}
          options={[
            { id: EMPTY, label: `Sin ${field.name.toLowerCase()}` },
            ...field.options,
          ]}
          onChange={(value) => set(field.id, value)}
        />
      ))}
      {active && (
        <button
          className="filter-clear"
          onClick={() =>
            void navigate({
              to: "/",
              search: ({ view, card, settings }: BoardSearch) => ({
                view,
                card,
                settings,
              }),
              replace: true,
            })
          }
        >
          Limpiar
          {hidden > 0 && <span className="filter-count">{hidden} ocultas</span>}
        </button>
      )}
    </div>
  );
}
