import * as boards from "../boards/services";
import { implement } from "../kernel";
import {
  CardArchivedChanged,
  CardAssigneesChanged,
  CardBodyEdited,
  CardCreated,
  CardMoved,
  CardUpdated,
  CardViewed,
  CardWeeklyChanged,
} from "./events";
import { cardsRouter } from "./router";
import * as cards from "./services";

export const cardsOrchestrator = implement(cardsRouter, {
  async read(_input, { tx, deps, resource }) {
    const card = await cards.withDocument(tx, deps, resource);
    return { output: card, event: CardViewed({ cardId: card.id }) };
  },
  async create(input, { tx, deps }) {
    const board = await boards.requireBoard(tx);
    const card = await cards.create(tx, deps, board.id, input);
    return {
      output: card,
      event: CardCreated({
        cardId: card.id,
        title: card.title,
        weekly: card.weekly,
      }),
    };
  },
  async update(input, { tx, deps, resource }) {
    const card = await cards.update(tx, deps, resource, input);
    return {
      output: card,
      event: CardUpdated({
        cardId: card.id,
        version: card.version,
        changedFields: [
          ...(input.title === undefined ? [] : ["title"]),
          ...Object.keys(input.properties ?? {}),
        ],
      }),
    };
  },
  async assign(input, { tx, deps, resource }) {
    const { card, added, removed } = await cards.assign(
      tx,
      deps,
      resource,
      input.assignees,
    );
    return {
      output: card,
      event: CardAssigneesChanged({
        cardId: card.id,
        assignees: card.assignees,
        added,
        removed,
      }),
    };
  },
  async week(input, { tx, deps, resource }) {
    const card = await cards.setWeekly(tx, deps, resource, input.weekly);
    return {
      output: card,
      event: CardWeeklyChanged({ cardId: card.id, weekly: card.weekly }),
    };
  },
  async archive(input, { tx, deps, resource }) {
    const card = await cards.archive(tx, deps, resource, input.archived);
    return {
      output: card,
      event: CardArchivedChanged({
        cardId: card.id,
        archived: card.archived,
        // Al restaurar, la etiqueta se borra de la tarjeta: sale de la versión anterior.
        stage: card.archivedStage ?? resource.archivedStage,
      }),
    };
  },
  async move(input, { tx, deps, resource }) {
    const card = await cards.move(
      tx,
      deps,
      resource,
      input.stateId,
      input.beforeId,
    );
    return {
      output: card,
      event: CardMoved({
        cardId: card.id,
        fromStateId: resource.stateId,
        toStateId: card.stateId,
        beforeId: input.beforeId,
      }),
    };
  },
  async applyDocument(input, { tx, deps, resource }) {
    const card = await cards.applyDocument(tx, deps, resource, input.update);
    return {
      output: card,
      event: CardBodyEdited({ cardId: card.id, version: card.version }),
    };
  },
});
