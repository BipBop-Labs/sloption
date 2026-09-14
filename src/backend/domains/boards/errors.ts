import { defineErrors } from "../../lib/errors";

export const boardErrors = defineErrors({
  BOARD_NOT_FOUND: { kind: "NOT_FOUND", message: "Board not found" },
  GROUPING_NOT_SELECT: {
    kind: "INVALID_INPUT",
    message: "Group by a single selection property",
  },
});
