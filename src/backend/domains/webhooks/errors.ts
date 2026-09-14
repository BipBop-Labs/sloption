import { defineErrors } from "../../lib/errors";

export const webhookErrors = defineErrors({
  UNKNOWN_EVENT: { kind: "INVALID_INPUT", message: "Unknown event" },
});
