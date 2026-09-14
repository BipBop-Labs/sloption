import { defineErrors } from "../../lib/errors";

export const boardErrors = defineErrors({
  BOARD_NOT_FOUND: { kind: "NOT_FOUND", message: "Board not found" },
  STATE_NOT_FOUND: { kind: "INVALID_INPUT", message: "Unknown state" },
  DUPLICATE_STATE: { kind: "INVALID_INPUT", message: "Duplicate state" },
});
