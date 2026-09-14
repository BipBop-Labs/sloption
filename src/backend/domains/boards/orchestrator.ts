import * as auth from "../auth/services";
import * as cards from "../cards/services";
import * as fields from "../fields/services";
import { implement } from "../kernel";
import { boardsRouter } from "./router";
import * as boards from "./services";

export const boardsOrchestrator = implement(boardsRouter, {
  async read(input, { tx }) {
    const board = await boards.first(tx);
    return {
      output: {
        board,
        fields: await fields.ordered(tx),
        profiles: await auth.listProfiles(tx),
        cards: await cards.listForView(tx, input.view),
      },
      event: { entityId: board?.id ?? null },
    };
  },
  async configure(input, { tx }) {
    const field = await fields.requireField(tx, input.groupingId);
    const board = await boards.groupBy(tx, await boards.requireMain(tx), field);
    return {
      output: board,
      event: { boardId: board.id, groupingId: board.groupingId },
    };
  },
});
