import { randomUUID } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { profiles } from "../src/backend/domains/auth/models";
import { boardStates, boards } from "../src/backend/domains/boards/models";
import { fieldOptions, fields } from "../src/backend/domains/fields/models";
import type { Tx } from "../src/backend/domains/kernel";
import { pool, store } from "../src/backend/server/context";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 12 characters)",
  );

const findAdmin = (tx: Tx) =>
  tx.sql
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.role, "admin"), isNotNull(profiles.authUserId)))
    .limit(1);

/** El admin inicial y un tablero base. Solo corre si todavía no hay un admin con acceso. */
const existing = (await store.transaction(findAdmin)).length > 0;
if (!existing) {
  await store.transaction(async (tx) => {
    if ((await findAdmin(tx)).length) return;
    const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
    const authUserId = await tx.createAccount(email, password, name);
    await tx.sql.insert(profiles).values({
      id: randomUUID(),
      name,
      role: "admin",
      kind: "person",
      theme: null,
      authUserId,
      ownerId: null,
    });
    await tx.sql.insert(boards).values({ id: "main", name: "Tareas" });
    await tx.sql.insert(boardStates).values(
      ["not started", "in progress", "done"].map((label, position) => ({
        id: randomUUID(),
        boardId: "main",
        label,
        position,
      })),
    );
    await tx.sql.insert(fields).values({
      id: "priority",
      boardId: "main",
      name: "Prioridad",
      type: "select",
      position: 0,
    });
    await tx.sql.insert(fieldOptions).values(
      ["alta", "media", "baja"].map((label, position) => ({
        fieldId: "priority",
        id: randomUUID(),
        label,
        position,
      })),
    );
  });
}
await pool.end();
console.log(
  existing ? "Administrator already exists" : "Administrator created",
);
