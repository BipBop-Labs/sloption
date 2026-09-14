import { randomUUID } from "node:crypto";
import { pool, store } from "../src/backend/server/context";
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 12 characters)",
  );
const existing = await store.transaction(async (tx) =>
  (await tx.list("profiles")).some(
    (profile) => profile.role === "admin" && profile.authUserId,
  ),
);
if (!existing) {
  await store.transaction(async (tx) => {
    if (
      (await tx.list("profiles")).some(
        (profile) => profile.role === "admin" && profile.authUserId,
      )
    )
      return;
    const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
    const authUserId = await tx.createAccount(email, password, name);
    const profile = {
      id: randomUUID(),
      name,
      role: "admin" as const,
      authUserId,
      kind: "person" as const,
      ownerId: null,
    };
    await tx.put("profiles", profile);
    await tx.put("boards", {
      id: "main",
      name: "Tareas",
      groupingId: "status",
    });
    await tx.put("fields", {
      id: "status",
      name: "Estado",
      type: "select",
      options: ["not started", "in progress", "done"].map((label) => ({
        id: label,
        label,
      })),
    });
    await tx.put("fields", {
      id: "priority",
      name: "Prioridad",
      type: "select",
      options: ["alta", "media", "baja"].map((label) => ({ id: label, label })),
    });
    await tx.put("fields", {
      id: "assignees",
      name: "Encargado(s)",
      type: "people",
      options: [],
    });
  });
}
await pool.end();
console.log(
  existing ? "Administrator already exists" : "Administrator created",
);
