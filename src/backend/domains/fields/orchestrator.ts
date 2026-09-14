import * as boards from "../boards/services";
import * as cards from "../cards/services";
import { implement } from "../kernel";
import { fieldsRouter } from "./router";
import * as fields from "./services";

export const fieldsOrchestrator = implement(fieldsRouter, {
  async create(input, { tx, deps }) {
    const field = await fields.create(tx, deps, input);
    return {
      output: field,
      event: { fieldId: field.id, name: field.name, type: field.type },
    };
  },
  async update(input, { tx, deps, resource: field }) {
    await fields.update(tx, field, {
      name: input.name,
      options: input.options,
    });
    if (fields.hasOptions(field)) await cards.pruneOptions(tx, deps, field);
    return {
      output: field,
      event: {
        fieldId: field.id,
        name: field.name,
        optionIds: field.options.map((option) => option.id),
      },
    };
  },
  async remove(input, { tx, deps, fail }) {
    const board = await boards.requireMain(tx);
    if (board.groupingId === input.id) fail("GROUPING_FIELD");
    await fields.remove(tx, input.id);
    await cards.removeValue(tx, deps, input.id);
    return { output: { ok: true } as const, event: { fieldId: input.id } };
  },
});
