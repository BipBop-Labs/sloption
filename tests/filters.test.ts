import { describe, expect, test } from "vitest";
import {
  ASSIGNEES,
  EMPTY,
  activeFilter,
  filterableFields,
  matchesFilters,
} from "@/frontend/lib/filters";
import type { Card, Field } from "../src/backend/domains/kernel";

const fields: Field[] = [
  {
    id: "priority",
    name: "Prioridad",
    type: "select",
    options: [
      { id: "alta", label: "alta" },
      { id: "baja", label: "baja" },
    ],
  },
  {
    id: "tags",
    name: "Etiquetas",
    type: "multiSelect",
    options: [
      { id: "swe", label: "SWE" },
      { id: "ux", label: "UX" },
    ],
  },
];

function card(
  properties: Card["properties"] = {},
  assignees: string[] = [],
  title = "Revisar la weekly",
) {
  return { title, assignees, properties };
}
const matches = (
  c: ReturnType<typeof card>,
  search: Record<string, unknown>,
) => matchesFilters(c, fields, search);

describe("filtros del tablero", () => {
  test("sin filtros pasa todo", () => {
    expect(matches(card(), {})).toBe(true);
  });

  test("varios valores del mismo campo son un O", () => {
    expect(matches(card({ priority: "alta" }), { priority: "alta,baja" })).toBe(
      true,
    );
    expect(matches(card({ priority: "otra" }), { priority: "alta,baja" })).toBe(
      false,
    );
  });

  test("campos distintos son un Y", () => {
    const c = card({ priority: "alta" }, ["ana"]);
    expect(matches(c, { priority: "alta", [ASSIGNEES]: "ana" })).toBe(true);
    expect(matches(c, { priority: "alta", [ASSIGNEES]: "beto" })).toBe(false);
  });

  test("multiSelect coincide si tiene alguno de los pedidos", () => {
    const c = card({ tags: ["swe", "ux"] });
    expect(matches(c, { tags: "ux" })).toBe(true);
    expect(matches(c, { tags: "otra" })).toBe(false);
  });

  test("personas: basta con una de las pedidas", () => {
    const c = card({}, ["ana", "beto"]);
    expect(matches(c, { [ASSIGNEES]: "beto,carla" })).toBe(true);
    expect(matches(c, { [ASSIGNEES]: "carla" })).toBe(false);
  });

  test("el valor vacío encuentra las que no tienen ese campo", () => {
    expect(matches(card(), { priority: EMPTY })).toBe(true);
    expect(matches(card({ priority: null }), { priority: EMPTY })).toBe(true);
    expect(matches(card(), { [ASSIGNEES]: EMPTY })).toBe(true);
    expect(matches(card({ priority: "alta" }), { priority: EMPTY })).toBe(
      false,
    );
  });

  test("la búsqueda por título no distingue mayúsculas y es parcial", () => {
    expect(matches(card(), { q: "WEEKLY" })).toBe(true);
    expect(matches(card(), { q: "  weekly " })).toBe(true);
    expect(matches(card(), { q: "daily" })).toBe(false);
  });

  test("solo se filtra por propiedades con opciones", () => {
    const all: Field[] = [
      ...fields,
      { id: "notas", name: "Notas", type: "text", options: [] },
    ];
    expect(filterableFields(all).map((f) => f.id)).toEqual([
      "priority",
      "tags",
    ]);
  });

  test("un filtro vacío en la URL no filtra nada", () => {
    expect(activeFilter({ priority: "" }, "priority")).toEqual([]);
    expect(activeFilter({}, "priority")).toEqual([]);
    expect(matches(card({ priority: "alta" }), { priority: "" })).toBe(true);
  });
});
