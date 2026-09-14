import { describe, expect, test } from "vitest";
import { archiveTransition } from "../src/backend/domains/cards/services";

const states = [
  { id: "qa", label: "QA" },
  { id: "done", label: "Listo" },
];

describe("archivar una tarjeta", () => {
  test("guarda la etapa como etiqueta y suelta la columna", () => {
    expect(
      archiveTransition({ stateId: "qa", archivedStage: null }, true, states),
    ).toEqual({ stateId: null, archivedStage: "QA" });
  });

  test("restaurar la devuelve a su etapa si sigue existiendo", () => {
    expect(
      archiveTransition({ stateId: null, archivedStage: "QA" }, false, states),
    ).toEqual({ stateId: "qa", archivedStage: null });
  });

  test("si la etapa ya no existe, queda sin estado", () => {
    expect(
      archiveTransition({ stateId: null, archivedStage: "QA" }, false, [
        { id: "done", label: "Listo" },
      ]),
    ).toEqual({ stateId: null, archivedStage: null });
  });

  test("sin etapa, archiva sin etiqueta", () => {
    expect(
      archiveTransition({ stateId: null, archivedStage: null }, true, states),
    ).toEqual({ stateId: null, archivedStage: null });
  });
});
