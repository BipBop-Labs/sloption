import * as auth from "../auth/services";
import * as cards from "../cards/services";
import * as fields from "../fields/services";
import { implement } from "../kernel";
import { BoardStatesChanged, BoardViewed } from "./events";
import { boardsRouter } from "./router";
import * as boards from "./services";

export const boardsOrchestrator = implement(boardsRouter, {
  async read(input, { tx }) {
    const board = await boards.first(tx);
    const profiles = await auth.listProfiles(tx);
    return {
      output: board
        ? {
            board,
            states: await boards.states(tx, board.id),
            fields: await fields.list(tx, board.id),
            profiles,
            cards: await cards.listForView(tx, board.id, input.view),
          }
        : { board: null, states: [], fields: [], profiles, cards: [] },
      event: BoardViewed({ boardId: board?.id ?? null }),
    };
  },
  async setStates(input, { tx }) {
    const board = await boards.requireBoard(tx);
    const states = await boards.setStates(tx, board.id, input.states);
    return {
      output: states,
      event: BoardStatesChanged({
        boardId: board.id,
        stateIds: states.map((state) => state.id),
      }),
    };
  },
});
