import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  max,
  sql,
} from "drizzle-orm";
import { raise } from "../../lib/errors";
import * as auth from "../auth/services";
import type { BoardState } from "../boards/schemas";
import * as boards from "../boards/services";
import type { Field, Properties } from "../fields/schemas";
import * as fields from "../fields/services";
import type { Deps, Tx } from "../kernel";
import { cardErrors } from "./errors";
import { cardAssignees, cards } from "./models";
import type { Card, CardSummary, NewCard } from "./schemas";

type CardRow = typeof cards.$inferSelect;

async function assigneesOf(tx: Tx, cardIds: string[]) {
  const byCard = new Map<string, string[]>();
  if (!cardIds.length) return byCard;
  const rows = await tx.sql
    .select()
    .from(cardAssignees)
    .where(inArray(cardAssignees.cardId, cardIds));
  for (const row of rows)
    byCard.set(row.cardId, [...(byCard.get(row.cardId) ?? []), row.profileId]);
  return byCard;
}

function toCard(row: CardRow, assignees: string[]): Card {
  return {
    ...row,
    assignees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function byId(tx: Tx, cardId: string): Promise<Card | null> {
  const [row] = await tx.sql.select().from(cards).where(eq(cards.id, cardId));
  if (!row) return null;
  return toCard(row, (await assigneesOf(tx, [row.id])).get(row.id) ?? []);
}

/** Las tarjetas de una vista, sin cuerpo: esta semana, todas o las archivadas. */
export async function listForView(
  tx: Tx,
  boardId: string,
  view: "week" | "all" | "archived",
): Promise<CardSummary[]> {
  const { markdown: _markdown, document: _document, ...summary } =
    getTableColumns(cards);
  const rows = await tx.sql
    .select(summary)
    .from(cards)
    .where(
      and(
        eq(cards.boardId, boardId),
        eq(cards.archived, view === "archived"),
        view === "week" ? eq(cards.weekly, true) : undefined,
      ),
    )
    .orderBy(asc(cards.rank));
  const assignees = await assigneesOf(
    tx,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...row,
    assignees: assignees.get(row.id) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** Toda escritura sube la versión: es lo que `cards.update` compara. */
async function save(tx: Tx, deps: Deps, card: Card): Promise<Card> {
  const updatedAt = deps.now();
  const next = {
    ...card,
    version: card.version + 1,
    updatedAt: updatedAt.toISOString(),
  };
  await tx.sql
    .update(cards)
    .set({
      title: next.title,
      markdown: next.markdown,
      document: next.document,
      stateId: next.stateId,
      rank: next.rank,
      weekly: next.weekly,
      archived: next.archived,
      archivedStage: next.archivedStage,
      properties: next.properties,
      version: next.version,
      updatedAt,
    })
    .where(eq(cards.id, card.id));
  return next;
}

async function writeAssignees(tx: Tx, cardId: string, profileIds: string[]) {
  await tx.sql.delete(cardAssignees).where(eq(cardAssignees.cardId, cardId));
  if (profileIds.length)
    await tx.sql
      .insert(cardAssignees)
      .values(profileIds.map((profileId) => ({ cardId, profileId })));
}

export async function create(
  tx: Tx,
  deps: Deps,
  boardId: string,
  input: NewCard,
): Promise<Card> {
  const assignees = [...new Set(input.assignees)];
  await boards.assertState(tx, boardId, input.stateId);
  await fields.validateProperties(tx, boardId, input.properties);
  await auth.assertProfiles(tx, assignees);
  const [last] = await tx.sql
    .select({ rank: max(cards.rank) })
    .from(cards)
    .where(eq(cards.boardId, boardId));
  const now = deps.now();
  const row: CardRow = {
    id: deps.newId(),
    boardId,
    title: input.title,
    markdown: "",
    document: null,
    stateId: input.stateId,
    rank: (last?.rank ?? 0) + 1024,
    weekly: input.weekly,
    archived: false,
    archivedStage: null,
    properties: input.properties,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await tx.sql.insert(cards).values(row);
  await writeAssignees(tx, row.id, assignees);
  return toCard(row, assignees);
}

/** Si nunca se abrió en el editor, el documento Yjs nace de su Markdown. */
export async function withDocument(tx: Tx, deps: Deps, card: Card) {
  if (card.document) return card;
  const document = deps.documents.initialize(card.markdown);
  await tx.sql.update(cards).set({ document }).where(eq(cards.id, card.id));
  return { ...card, document };
}

export async function update(
  tx: Tx,
  deps: Deps,
  card: Card,
  changes: { version: number; title?: string; properties?: Properties },
) {
  if (card.version !== changes.version) raise(cardErrors, "STALE_VERSION");
  let next = card;
  if (changes.title !== undefined) next = { ...next, title: changes.title };
  if (changes.properties) {
    await fields.validateProperties(tx, card.boardId, changes.properties);
    next = { ...next, properties: { ...next.properties, ...changes.properties } };
  }
  return save(tx, deps, next);
}

/** Reemplaza a las personas asignadas. Devuelve también quién entró y quién salió. */
export async function assign(
  tx: Tx,
  deps: Deps,
  card: Card,
  profileIds: string[],
) {
  const assignees = [...new Set(profileIds)];
  await auth.assertProfiles(tx, assignees);
  await writeAssignees(tx, card.id, assignees);
  return {
    card: await save(tx, deps, { ...card, assignees }),
    added: assignees.filter((id) => !card.assignees.includes(id)),
    removed: card.assignees.filter((id) => !assignees.includes(id)),
  };
}

export const setWeekly = (tx: Tx, deps: Deps, card: Card, weekly: boolean) =>
  save(tx, deps, { ...card, weekly });

/**
 * Archivada, la etapa deja de ser una referencia y pasa a ser una etiqueta
 * copiada: la tarjeta no apunta a ninguna columna, así que borrar una etapa no
 * la toca. Al restaurar vuelve a la etapa que se llame igual, si todavía existe.
 */
export function archiveTransition(
  card: Pick<Card, "stateId" | "archivedStage">,
  archived: boolean,
  states: readonly BoardState[],
): Pick<Card, "stateId" | "archivedStage"> {
  return archived
    ? {
        stateId: null,
        archivedStage:
          states.find((state) => state.id === card.stateId)?.label ?? null,
      }
    : {
        stateId:
          states.find((state) => state.label === card.archivedStage)?.id ?? null,
        archivedStage: null,
      };
}

export async function archive(
  tx: Tx,
  deps: Deps,
  card: Card,
  archived: boolean,
) {
  const states = await boards.states(tx, card.boardId);
  return save(tx, deps, {
    ...card,
    ...archiveTransition(card, archived, states),
    archived,
  });
}

/** Cambia de etapa y renumera la columna destino para dejarla antes de `beforeId`. */
export async function move(
  tx: Tx,
  deps: Deps,
  card: Card,
  stateId: string | null,
  beforeId: string | null,
) {
  await boards.assertState(tx, card.boardId, stateId);
  const siblings = (
    await tx.sql
      .select({ id: cards.id, rank: cards.rank })
      .from(cards)
      .where(
        and(
          eq(cards.boardId, card.boardId),
          eq(cards.archived, card.archived),
          stateId === null ? isNull(cards.stateId) : eq(cards.stateId, stateId),
        ),
      )
      .orderBy(asc(cards.rank))
  ).filter((sibling) => sibling.id !== card.id);
  const position =
    beforeId === null
      ? siblings.length
      : siblings.findIndex((sibling) => sibling.id === beforeId);
  if (position < 0) raise(cardErrors, "TARGET_MOVED");
  siblings.splice(position, 0, { id: card.id, rank: card.rank });
  let rank = card.rank;
  for (const [index, sibling] of siblings.entries()) {
    const next = (index + 1) * 1024;
    if (sibling.id === card.id) rank = next;
    else if (sibling.rank !== next)
      await tx.sql.update(cards).set({ rank: next }).where(eq(cards.id, sibling.id));
  }
  return save(tx, deps, { ...card, stateId, rank });
}

export async function applyDocument(
  tx: Tx,
  deps: Deps,
  card: Card,
  update: string,
) {
  let merged: { document: string; markdown: string };
  try {
    merged = deps.documents.merge(card.document, card.markdown, update);
  } catch {
    return raise(cardErrors, "INVALID_DOCUMENT");
  }
  return save(tx, deps, { ...card, ...merged });
}

/** Una opción que ya no existe deja de ser el valor de las tarjetas que la tenían. */
export async function pruneOptions(tx: Tx, deps: Deps, field: Field) {
  const valid = new Set(field.options.map((option) => option.id));
  const rows = await tx.sql
    .select()
    .from(cards)
    .where(sql`${cards.properties} ? ${field.id}`);
  for (const row of rows) {
    const current = row.properties[field.id];
    if (current == null) continue;
    const next = Array.isArray(current)
      ? current.filter((item) => valid.has(item))
      : valid.has(String(current))
        ? current
        : null;
    if (JSON.stringify(next) !== JSON.stringify(current))
      await save(
        tx,
        deps,
        toCard({ ...row, properties: { ...row.properties, [field.id]: next } }, []),
      );
  }
}

/** Una propiedad borrada desaparece de todas las tarjetas que la tenían. */
export async function removeProperty(tx: Tx, deps: Deps, fieldId: string) {
  await tx.sql
    .update(cards)
    .set({
      properties: sql`${cards.properties} - ${fieldId}`,
      version: sql`${cards.version} + 1`,
      updatedAt: deps.now(),
    })
    .where(sql`${cards.properties} ? ${fieldId}`);
}
