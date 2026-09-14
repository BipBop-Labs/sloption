import { defineErrors } from "../../lib/errors";

export const cardErrors = defineErrors({
  STALE_VERSION: {
    kind: "CONFLICT",
    message: "Card changed; reload before saving",
  },
  TARGET_MOVED: { kind: "CONFLICT", message: "Target card moved" },
  INVALID_DOCUMENT: {
    kind: "INVALID_INPUT",
    message: "Invalid document update",
  },
});
