# Action catalog v1

All authenticated actions use the same core dispatcher from HTTP, web, and CLI.
Each success emits `<action>.v1` with a strict action-specific payload; failures do
not emit a success event. Events never include passwords, invitation tokens or API keys.

| Actions | Access | Purpose |
|---|---|---|
| board.read, board.configure | member / admin | Read board; change shared grouping |
| card.read, card.create, card.update, card.move, card.archive, card.week | member | Card lifecycle and ordering |
| document.apply | member | Merge a collaborative document update |
| field.create, field.update, field.remove | admin | Shared property schema and option ordering |
| profile.list, profile.preferences | member | Assignable identities and persisted theme |
| profile.update, invitation.create | admin | Roles and invitations |
| key.list, key.create, key.revoke | owner | Agent credentials |
| webhook.list, webhook.create, webhook.update, webhook.remove | admin | Event subscriptions |
| history.list | member | Durable audit history |
| asset.create, asset.read | member | Embedded images |
| import.apply | admin | Idempotent Notion import |

Authentication emits auth.login.v1, auth.logout.v1 and auth.session.v1. Invitation
acceptance emits invitation.accept.v1, provisioning system.seed.v1, and opening the
stream emits stream.open.v1. Authentication uses BetterAuth endpoints; invitation
acceptance and its account/profile transaction live in the core identity service.
The CLI exposes auth.login, auth.logout and invitation.accept as named operations.
