import * as boards from "../boards/services";
import * as cards from "../cards/services";
import { implement } from "../kernel";
import { FieldCreated, FieldRemoved, FieldUpdated } from "./events";
import { fieldsRouter } from "./router";
import * as fields from "./services";

export const fieldsOrchestrator = implement(fieldsRouter, {
  async create(input, { tx, deps }) {
    const board = await boards.requireBoard(tx);
    const field = await fields.create(tx, deps, board.id, input);
    return {
      output: field,
      event: FieldCreated({
        fieldId: field.id,
        name: field.name,
        type: field.type,
      }),
    };
  },
  async update(input, { tx, deps, resource }) {
    const field = await fields.update(tx, resource, {
      name: input.name,
      options: input.options,
    });
    if (fields.hasOptions(field)) await cards.pruneOptions(tx, deps, field);
    return {
      output: field,
      event: FieldUpdated({
        fieldId: field.id,
        name: field.name,
        optionIds: field.options.map((option) => option.id),
      }),
    };
  },
  async remove(input, { tx, deps }) {
    await fields.remove(tx, input.id);
    await cards.removeProperty(tx, deps, input.id);
    return {
      output: { ok: true } as const,
      event: FieldRemoved({ fieldId: input.id }),
    };
  },
});
