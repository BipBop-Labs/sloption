import { expect, test } from "vitest";
import { reorderStages } from "@/frontend/lib/stages";

const stages = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];
const ids = (options: { id: string }[]) => options.map((item) => item.id);

test("mueve la etapa justo antes del destino", () => {
  expect(ids(reorderStages(stages, "c", "b"))).toEqual(["a", "c", "b"]);
});
test("moverse a la derecha no se pasa de largo", () => {
  // Soltar sobre la vecina de la derecha las intercambia, no las deja igual.
  expect(ids(reorderStages(stages, "a", "c"))).toEqual(["b", "a", "c"]);
});
test("sin destino, al final", () => {
  expect(ids(reorderStages(stages, "a", ""))).toEqual(["b", "c", "a"]);
});
test("una etapa que no existe no cambia nada", () => {
  expect(ids(reorderStages(stages, "z", "a"))).toEqual(["a", "b", "c"]);
});
