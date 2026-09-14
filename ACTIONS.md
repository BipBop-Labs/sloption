# Action catalog v1

The source of truth is `catalog.read` (`sloption catalog read`): every endpoint with its
doc, input/output JSON Schema, access, declared errors and event payload schema. This
file is only a map.

Each endpoint lives in `src/backend/domains/<domain>/router.ts`. Action `cards.move`
is `POST /api/cards/move`, CLI `sloption cards move`, event `cards.move.v1`. Failures do
not emit an event. Events never include passwords, invitation tokens or API keys, and
they are not stored: webhooks consume them.

| Endpoints | Access | Purpose |
|---|---|---|
| boards.read, boards.configure | member / admin | Read board; change shared grouping |
| cards.read, cards.create, cards.update, cards.move, cards.archive, cards.week | member | Card lifecycle and ordering |
| cards.applyDocument | member | Merge a collaborative document update |
| fields.create, fields.update, fields.remove | admin | Shared property schema and option ordering |
| profiles.list, profiles.preferences | member | Assignable identities and persisted theme |
| profiles.update, invitations.create | admin | Roles and invitations |
| invitations.accept | public | Redeem an invitation |
| keys.list, keys.create, keys.revoke | member, owner for revoke | Agent credentials |
| webhooks.list, webhooks.create, webhooks.update, webhooks.remove | admin | Event subscriptions |
| assets.create, assets.read | member | Embedded images; read is `GET /api/assets/:id` |
| imports.apply | admin | Idempotent Notion import |
| session.me | member | Who is calling; no event |
| catalog.read | member | This catalog |

Sign-in and sign-out go through BetterAuth (`/api/auth/*`, CLI `session login` and
`session logout`) and emit `auth.login.v1` and `auth.logout.v1` with IP and user agent.
