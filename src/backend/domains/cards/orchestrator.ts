import * as boards from "../boards/services";
import * as fields from "../fields/services";
import { implement } from "../kernel";
import { cardsRouter } from "./router";
import * as cards from "./services";

export const cardsOrchestrator = implement(cardsRouter, {
  async read(_input, { tx, deps, resource }) {
    const card = await cards.withDocument(tx, deps, resource);
    return { output: card, event: { entityId: card.id } };
  },
  async create(input, { tx, deps }) {
    const card = await cards.create(tx, deps, input);
    return {
      output: card,
      event: { cardId: card.id, title: card.title, weekly: card.weekly },
    };
  },
  async update(input, { tx, deps, resource }) {
    const card = await cards.update(tx, deps, resource, input);
    return {
      output: card,
      event: {
        cardId: card.id,
        version: card.version,
        changedFields: [
          ...(input.title === undefined ? [] : ["title"]),
          ...Object.keys(input.values ?? {}),
        ],
      },
    };
  },
  async week(input, { tx, deps, resource }) {
    const card = await cards.setWeekly(tx, deps, resource, input.weekly);
    return { output: card, event: { cardId: card.id, weekly: card.weekly } };
  },
  async archive(input, { tx, deps, resource }) {
    const board = await boards.requireMain(tx);
    const grouping = await fields.byId(tx, board.groupingId);
    const stage = input.archived
      ? null
      : resource.archivedStage;
    const card = await cards.archive(
      tx,
      deps,
      resource,
      input.archived,
      board,
      grouping,
    );
    return {
      output: card,
      event: {
        cardId: card.id,
        archived: card.archived,
        stage: card.archivedStage ?? stage,
      },
    };
  },
  async move(input, { tx, deps, resource }) {
    const board = await boards.requireMain(tx);
    const from = resource.values[board.groupingId] ?? null;
    const card = await cards.move(
      tx,
      deps,
      resource,
      board,
      input.optionId,
      input.beforeId,
    );
    return {
      output: card,
      event: {
        cardId: card.id,
        fromOptionId: typeof from === "string" ? from : null,
        toOptionId: input.optionId,
        beforeId: input.beforeId,
      },
    };
  },
  async applyDocument(input, { tx, deps, resource }) {
    const card = await cards.applyDocument(tx, deps, resource, input.update);
    return { output: card, event: { cardId: card.id, version: card.version } };
  },
});
