import { describe, expect, test } from "vitest";
import {
  EMPTY,
  activeFilter,
  filterableFields,
  matchesFilters,
} from "@/frontend/lib/filters";
import type { Card, Field } from "../src/backend/domains/kernel";

const fields: Field[] = [
  {
    id: "status",
    name: "Estado",
    type: "select",
    options: [
      { id: "qa", label: "QA" },
      { id: "listo", label: "Listo" },
    ],
  },
  { id: "assignees", name: "Encargado(s)", type: "people", options: [] },
];

function card(values: Card["values"], title = "Revisar la weekly"): Card {
  return {
    id: "c",
    title,
    markdown: "",
    document: null,
    values,
    weekly: false,
    archived: false,
    archivedStage: null,
    rank: 1024,
    version: 1,
    createdAt: "",
    updatedAt: "",
    sourceId: null,
    bodyMissing: false,
  };
}
const matches = (c: Card, search: Record<string, unknown>) =>
  matchesFilters(c, fields, search);

describe("filtros del tablero", () => {
  test("sin filtros pasa todo", () => {
    expect(matches(card({}), {})).toBe(true);
  });

  test("varios valores del mismo campo son un O", () => {
    expect(matches(card({ status: "qa" }), { status: "qa,listo" })).toBe(true);
    expect(matches(card({ status: "otro" }), { status: "qa,listo" })).toBe(
      false,
    );
  });

  test("campos distintos son un Y", () => {
    const c = card({ status: "qa", assignees: ["ana"] });
    expect(matches(c, { status: "qa", assignees: "ana" })).toBe(true);
    expect(matches(c, { status: "qa", assignees: "beto" })).toBe(false);
  });

  test("multiSelect coincide si tiene alguno de los pedidos", () => {
    const c = card({ assignees: ["ana", "beto"] });
    expect(matches(c, { assignees: "beto" })).toBe(true);
    expect(matches(c, { assignees: "carla" })).toBe(false);
  });

  test("el valor vacío encuentra las que no tienen ese campo", () => {
    expect(matches(card({}), { status: EMPTY })).toBe(true);
    expect(matches(card({ status: null }), { status: EMPTY })).toBe(true);
    expect(matches(card({ assignees: [] }), { assignees: EMPTY })).toBe(true);
    expect(matches(card({ status: "qa" }), { status: EMPTY })).toBe(false);
  });

  test("la búsqueda por título no distingue mayúsculas y es parcial", () => {
    expect(matches(card({}), { q: "WEEKLY" })).toBe(true);
    expect(matches(card({}), { q: "  weekly " })).toBe(true);
    expect(matches(card({}), { q: "daily" })).toBe(false);
  });

  test("el campo de agrupación no se filtra: eso lo muestran las columnas", () => {
    const all: Field[] = [
      ...fields,
      { id: "notas", name: "Notas", type: "text", options: [] },
    ];
    expect(filterableFields(all, "status").map((f) => f.id)).toEqual([
      "assignees",
    ]);
    // Un parámetro viejo del campo agrupador queda inerte, no filtra a ciegas.
    expect(
      matchesFilters(card({ status: "qa" }), filterableFields(all, "status"), {
        status: "listo",
      }),
    ).toBe(true);
  });

  test("un filtro vacío en la URL no filtra nada", () => {
    expect(activeFilter({ status: "" }, "status")).toEqual([]);
    expect(activeFilter({}, "status")).toEqual([]);
    expect(matches(card({ status: "qa" }), { status: "" })).toBe(true);
  });
});
