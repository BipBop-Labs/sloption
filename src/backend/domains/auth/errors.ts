import { defineErrors } from "../../lib/errors";

export const profileErrors = defineErrors({
  PROFILE_NOT_FOUND: { kind: "NOT_FOUND", message: "Profile not found" },
  UNKNOWN_PROFILE: { kind: "INVALID_INPUT", message: "Unknown person" },
  LAST_ADMIN: {
    kind: "CONFLICT",
    message: "Keep at least one active administrator",
  },
});

export const invitationErrors = defineErrors({
  IDENTITY_LINKED: { kind: "CONFLICT", message: "Identity already linked" },
  INVALID_INVITATION: { kind: "FORBIDDEN", message: "Invalid invitation" },
});
