import { createWakeSignal } from "./wake-signal";
import { Client } from "pg";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { serveStatic } from "@hono/node-server/serve-static";
import { z } from "zod";
import { ActionError } from "../../core/actions";
import {
  auth,
  identity,
  pool,
  resolveActor,
  service,
} from "../../server/context";

export const app = new Hono();
app.use("*", secureHeaders());
app.use("/api/*", bodyLimit({ maxSize: 20 * 1024 * 1024 }));
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin && origin !== process.env.APP_URL)
      return c.json(
        { error: { code: "FORBIDDEN", message: "Origen no permitido" } },
        403,
      );
  }
  await next();
});
app.onError((error, c) => {
  if (error instanceof ActionError)
    return c.json(
      { error: { code: error.code, message: error.message } },
      (
        {
          UNAUTHENTICATED: 401,
          FORBIDDEN: 403,
          NOT_FOUND: 404,
          INVALID_INPUT: 400,
          CONFLICT: 409,
        } as const
      )[error.code],
    );
  if (error instanceof z.ZodError)
    return c.json(
      { error: { code: "INVALID_INPUT", message: "Parámetros inválidos" } },
      400,
    );
  console.error(error);
  return c.json(
    {
      error: { code: "INTERNAL", message: "No pudimos completar la operación" },
    },
    500,
  );
});
app.get("/api/health", async (c) => {
  await pool.query("select 1");
  return c.json({ ok: true });
});
app.post("/api/invitations/accept", async (c) =>
  c.json(await identity.accept(await c.req.json())),
);
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const path = new URL(c.req.url).pathname;
  if (
    ![
      "/api/auth/sign-in/email",
      "/api/auth/sign-out",
      "/api/auth/get-session",
    ].includes(path)
  )
    return c.json(
      { error: { code: "FORBIDDEN", message: "Solo por invitación" } },
      403,
    );
  const previous = await resolveActor(c.req.raw.headers);
  const headers = new Headers(c.req.raw.headers);
  headers.set(
    "x-sloption-client-ip",
    getConnInfo(c).remote.address ?? "unknown",
  );
  const response = await auth.handler(new Request(c.req.raw, { headers }));
  if (response.ok) {
    let actor = previous;
    if (path.endsWith("sign-in/email")) {
      const data = (await response.clone().json()) as { token?: string };
      if (data.token) {
        const headers = new Headers(c.req.raw.headers);
        headers.set("cookie", `better-auth.session_token=${data.token}`);
        // Resolve the signed cookie returned by BetterAuth, not an unsigned token.
        const cookies = response.headers
          .getSetCookie()
          .map((cookie) => cookie.split(";")[0])
          .join("; ");
        headers.set("cookie", cookies);
        actor = await resolveActor(headers);
      }
    }
    if (actor)
      await identity.audit(
        path.endsWith("sign-out")
          ? "auth.logout.v1"
          : path.endsWith("get-session")
            ? "auth.session.v1"
            : "auth.login.v1",
        actor,
      );
  }
  return response;
});
app.get("/api/me", async (c) => {
  const actor = await resolveActor(c.req.raw.headers);
  if (!actor) throw new ActionError("UNAUTHENTICATED", "Inicia sesión");
  await identity.audit("auth.session.v1", actor);
  return c.json(actor);
});
app.post("/api/actions/:name", async (c) => {
  const actor = await resolveActor(c.req.raw.headers);
  return c.json(
    await service.execute(c.req.param("name"), await c.req.json(), actor),
  );
});
app.get("/api/assets/:id", async (c) => {
  const result = (await service.execute(
    "asset.read",
    { id: c.req.param("id") },
    await resolveActor(c.req.raw.headers),
  )) as { mime: string; content: string };
  c.header("Content-Type", result.mime);
  c.header("Cache-Control", "private, max-age=3600");
  return c.body(Buffer.from(result.content, "base64"));
});
app.get("/api/events", async (c) => {
  const actor = await resolveActor(c.req.raw.headers);
  if (!actor) throw new ActionError("UNAUTHENTICATED", "Inicia sesión");
  await identity.audit("stream.open.v1", actor);
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache");
  return streamSSE(c, async (stream) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const signal = createWakeSignal();
    const abort = new AbortController();
    const notify = () => signal.notify();
    client.on("notification", notify);
    client.on("error", () => abort.abort());
    stream.onAbort(() => abort.abort());
    try {
      await client.query("LISTEN sloption_events");
      const supplied = c.req.header("last-event-id");
      let cursor =
        supplied && /^\d+$/.test(supplied)
          ? Number(supplied)
          : Number(
              (
                await client.query(
                  "select coalesce(max(sequence),0) as cursor from events",
                )
              ).rows[0].cursor,
            );
      await stream.writeSSE({ event: "ready", data: "{}", id: String(cursor) });
      while (!stream.aborted && !abort.signal.aborted) {
        const observed = signal.revision;
        if (!(await resolveActor(c.req.raw.headers))) break;
        const rows = (
          await client.query(
            "select sequence,payload from events where sequence > $1 order by sequence limit 100",
            [cursor],
          )
        ).rows;
        for (const row of rows) {
          cursor = Number(row.sequence);
          if (row.payload.data.changed)
            await stream.writeSSE({
              event: "change",
              id: String(cursor),
              data: JSON.stringify(row.payload),
            });
        }
        if (rows.length === 100) continue;
        await stream.writeSSE({
          event: "cursor",
          id: String(cursor),
          data: "{}",
        });
        await signal.wait(observed, abort.signal);
      }
    } finally {
      client.removeListener("notification", notify);
      await client.end();
    }
  });
});
app.use("/assets/*", serveStatic({ root: "./dist/web" }));
app.get("*", serveStatic({ path: "./dist/web/index.html" }));
