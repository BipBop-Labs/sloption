import { raise } from "../../lib/errors";
import type { Board } from "../boards/model";
import type { Field } from "../fields/model";
import * as fields from "../fields/services";
import type { Deps, Tx } from "../kernel";
import { cardErrors } from "./errors";
import type { Card } from "./model";

export const byId = (tx: Tx, cardId: string) => tx.get("cards", cardId);

/** Toda escritura sube la versión: es lo que `cards.update` compara. */
export async function save(tx: Tx, deps: Deps, card: Card) {
  card.version += 1;
  card.updatedAt = deps.now().toISOString();
  await tx.put("cards", card);
  return card;
}

export async function listForView(tx: Tx, view: "week" | "all" | "archived") {
  return (await tx.list("cards"))
    .filter((card) =>
      view === "archived"
        ? card.archived
        : !card.archived && (view === "all" || card.weekly),
    )
    .sort((a, b) => a.rank - b.rank)
    .map(({ document: _document, markdown: _markdown, ...card }) => card);
}

export async function create(
  tx: Tx,
  deps: Deps,
  input: { title: string; values: Card["values"]; weekly: boolean },
) {
  await fields.validateValues(tx, input.values);
  const now = deps.now().toISOString();
  const cards = await tx.list("cards");
  const card: Card = {
    id: deps.newId(),
    ...input,
    markdown: "",
    document: null,
    archived: false,
    archivedStage: null,
    rank: Math.max(0, ...cards.map((card) => card.rank)) + 1024,
    version: 1,
    createdAt: now,
    updatedAt: now,
    sourceId: null,
    bodyMissing: false,
  };
  await tx.put("cards", card);
  return card;
}

/** Si nunca se abrió en el editor, el documento Yjs nace de su Markdown. */
export async function withDocument(tx: Tx, deps: Deps, card: Card) {
  if (!card.document) {
    card.document = deps.documents.initialize(card.markdown);
    await tx.put("cards", card);
  }
  return card;
}

export async function update(
  tx: Tx,
  deps: Deps,
  card: Card,
  changes: { version: number; title?: string; values?: Card["values"] },
) {
  if (card.version !== changes.version) raise(cardErrors, "STALE_VERSION");
  if (changes.title !== undefined) card.title = changes.title;
  if (changes.values) {
    await fields.validateValues(tx, changes.values);
    card.values = { ...card.values, ...changes.values };
  }
  return save(tx, deps, card);
}

export async function setWeekly(tx: Tx, deps: Deps, card: Card, weekly: boolean) {
  card.weekly = weekly;
  return save(tx, deps, card);
}

export async function archive(
  tx: Tx,
  deps: Deps,
  card: Card,
  archived: boolean,
  board: Board,
  grouping: Field | null,
) {
  // Archivada, la etapa deja de ser un valor del campo que agrupa y pasa a
  // ser una etiqueta copiada: la tarjeta no referencia ninguna columna, así
  // que borrar una columna no la toca ni queda bloqueado por el archivo.
  if (archived) {
    const current = card.values[board.groupingId];
    card.archivedStage =
      grouping?.options.find((option) => option.id === current)?.label ?? null;
    card.values[board.groupingId] = null;
  } else {
    // Al restaurar vuelve a su etapa si todavía existe con ese nombre.
    card.values[board.groupingId] =
      grouping?.options.find((option) => option.label === card.archivedStage)
        ?.id ?? null;
    card.archivedStage = null;
  }
  card.archived = archived;
  return save(tx, deps, card);
}

/** Cambia de columna y renumera la columna destino para dejarla antes de `beforeId`. */
export async function move(
  tx: Tx,
  deps: Deps,
  card: Card,
  board: Board,
  optionId: string | null,
  beforeId: string | null,
) {
  await fields.validateValues(tx, { [board.groupingId]: optionId });
  const siblings = (await tx.list("cards"))
    .filter(
      (item) =>
        item.id !== card.id &&
        item.archived === card.archived &&
        (item.values[board.groupingId] ?? null) === optionId,
    )
    .sort((a, b) => a.rank - b.rank);
  const position =
    beforeId === null
      ? siblings.length
      : siblings.findIndex((item) => item.id === beforeId);
  if (position < 0) raise(cardErrors, "TARGET_MOVED");
  card.values[board.groupingId] = optionId;
  siblings.splice(position, 0, card);
  for (const [index, sibling] of siblings.entries()) {
    const rank = (index + 1) * 1024;
    if (sibling.id === card.id) {
      card.rank = rank;
    } else if (sibling.rank !== rank) {
      sibling.rank = rank;
      await tx.put("cards", sibling);
    }
  }
  return save(tx, deps, card);
}

export async function applyDocument(
  tx: Tx,
  deps: Deps,
  card: Card,
  update: string,
) {
  try {
    Object.assign(
      card,
      deps.documents.merge(card.document, card.markdown, update),
    );
  } catch {
    raise(cardErrors, "INVALID_DOCUMENT");
  }
  card.bodyMissing = false;
  return save(tx, deps, card);
}

/** Una opción que ya no existe deja de ser el valor de las tarjetas que la tenían. */
export async function pruneOptions(tx: Tx, deps: Deps, field: Field) {
  const valid = new Set(field.options.map((option) => option.id));
  for (const card of await tx.list("cards")) {
    const current = card.values[field.id];
    if (current == null) continue;
    const next = Array.isArray(current)
      ? current.filter((item) => valid.has(item))
      : valid.has(String(current))
        ? current
        : null;
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      card.values[field.id] = next;
      await save(tx, deps, card);
    }
  }
}

export async function removeValue(tx: Tx, deps: Deps, fieldId: string) {
  for (const card of await tx.list("cards"))
    if (fieldId in card.values) {
      delete card.values[fieldId];
      await save(tx, deps, card);
    }
}
