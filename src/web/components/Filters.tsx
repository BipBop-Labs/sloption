import { useNavigate } from "@tanstack/react-router";
import type { Field, Profile } from "../../core/model";
import { activeFilter, EMPTY, type BoardSearch } from "../filters";
import { DropdownSelect } from "../ui";

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
  function set(key: string, value: string | undefined) {
    void navigate({
      to: "/",
      search: (previous: BoardSearch) => ({ ...previous, [key]: value }),
      replace: true,
    });
  }
  const active =
    !!search.q ||
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
            ...(field.type === "people"
              ? profiles.map((profile) => ({
                  id: profile.id,
                  label: profile.name,
                }))
              : field.options.map((option) => ({
                  id: option.id,
                  label: option.label,
                }))),
          ]}
          onChange={(value) =>
            set(
              field.id,
              (Array.isArray(value) ? value : [value]).join(",") || undefined,
            )
          }
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
