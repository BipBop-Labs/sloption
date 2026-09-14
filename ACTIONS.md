# Action catalog v1

The source of truth is `catalog.read` (`sloption catalog read`): every endpoint with its
doc, input/output JSON Schema, access, declared errors and the event it emits, with its
payload schema. This file is only a map.

Endpoints live in `src/backend/domains/<domain>/router.ts`. Action `cards.move` is
`POST /api/cards/move` and CLI `sloption cards move`.

Events live in `src/backend/domains/<domain>/events.ts`, named on their own
(`cards.moved.v1`), not after the endpoint: one event can be emitted by several
endpoints, and renaming an endpoint does not break webhook subscribers. Failures do not
emit. Events never include passwords, invitation tokens or API keys, and they are not
stored: webhooks consume them.

| Endpoints | Access | Events |
|---|---|---|
| boards.read, boards.setStates | member / admin | boards.viewed, boards.statesChanged |
| cards.read, cards.create, cards.update | member | cards.viewed, cards.created, cards.updated |
| cards.assign | member | cards.assigneesChanged (with added and removed) |
| cards.week, cards.archive, cards.move | member | cards.weeklyChanged, cards.archivedChanged, cards.moved |
| cards.applyDocument | member | cards.bodyEdited |
| fields.create, fields.update, fields.remove | admin | fields.created, fields.updated, fields.removed |
| profiles.list, profiles.preferences | member | profiles.listed, profiles.themeChanged |
| profiles.update | admin | profiles.roleChanged |
| invitations.create / invitations.accept | admin / public | invitations.created, invitations.accepted |
| keys.list, keys.create, keys.revoke | member, owner for revoke | keys.listed, keys.created, keys.revoked |
| webhooks.list, webhooks.create, webhooks.update, webhooks.remove | admin | webhooks.listed, .created, .updated, .removed |
| assets.create, assets.read | member | assets.uploaded, assets.viewed; read is `GET /api/assets/:id` |
| session.me | member | none |
| catalog.read | member | catalog.viewed |

A card's columns are the board's states (`stateId`); its assignees are a relation
(`cards.assign`); the rest are board-defined properties (`properties`). All events are
`.v1`. Sign-in and sign-out go through BetterAuth (`/api/auth/*`, CLI `session login` and
`session logout`) and emit `auth.signedIn.v1` and `auth.signedOut.v1` with IP and user
agent.
