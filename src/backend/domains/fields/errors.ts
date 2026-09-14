import { defineErrors } from "../../lib/errors";

export const fieldErrors = defineErrors({
  FIELD_NOT_FOUND: { kind: "NOT_FOUND", message: "Property not found" },
  DUPLICATE_OPTION: { kind: "INVALID_INPUT", message: "Duplicate option" },
  NO_OPTIONS: {
    kind: "INVALID_INPUT",
    message: "This property has no options",
  },
});

/** Los lanza `validateProperties`: todo endpoint que escribe propiedades los declara. */
export const valueErrors = defineErrors({
  UNKNOWN_PROPERTY: { kind: "INVALID_INPUT", message: "Unknown property" },
  INVALID_VALUE: { kind: "INVALID_INPUT", message: "Invalid property value" },
});
