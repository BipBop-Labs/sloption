import { setTimeout as sleep } from "node:timers/promises";
import { Client, type Notification } from "pg";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { serveStatic } from "@hono/node-server/serve-static";
import { z } from "zod";
import { ActionError, httpStatus } from "../../lib/errors";
import type { Credential } from "../../lib/ports";
import {
  auth,
  authenticator,
  catalog,
  pool,
  recordSession,
} from "../../server/context";

/**
 * Lo único que este adaptador decide es de dónde sale la credencial: la cabecera
 * `Authorization` o la cookie de sesión. Qué identidad significa lo decide auth.
 */
function credentialFrom(headers: Headers): Credential | null {
  const bearer = headers.get("authorization");
  if (bearer?.startsWith("Bearer "))
    return { kind: "apiKey", token: bearer.slice(7) };
  const cookie = headers.get("cookie");
  return cookie ? { kind: "session", cookie } : null;
}

/**
 * En producción la conexión es del proxy de Coolify: la IP real es el último
 * valor de X-Forwarded-For, el que agrega el proxy. El primero lo escribe el
 * cliente y se puede falsificar. Asume que el puerto nunca se publica directo.
 */
function clientIp(c: Context) {
  const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || (getConnInfo(c).remote.address ?? null);
}

async function jsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ActionError("INVALID_INPUT", "El cuerpo no es JSON");
  }
}

export const app = new Hono();
app.use("*", secureHeaders());
app.use("/api/*", bodyLimit({ maxSize: 20 * 1024 * 1024 }));
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin && origin !== process.env.APP_URL)
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            kind: "FORBIDDEN",
            message: "Origen no permitido",
          },
        },
        403,
      );
  }
  await next();
});
app.onError((error, c) => {
  if (error instanceof ActionError)
    return c.json(
      {
        error: { code: error.code, kind: error.kind, message: error.message },
      },
      httpStatus[error.kind],
    );
  if (error instanceof z.ZodError)
    return c.json(
      {
        error: {
          code: "INVALID_INPUT",
          kind: "INVALID_INPUT",
          message: "Parámetros inválidos",
        },
      },
      400,
    );
  console.error(error);
  return c.json(
    {
      error: {
        code: "INTERNAL",
        kind: "INTERNAL",
        message: "No pudimos completar la operación",
      },
    },
    500,
  );
});
app.get("/api/health", async (c) => {
  await pool.query("select 1");
  return c.json({ ok: true });
});

/**
 * Login y logout los maneja BetterAuth y quedan fuera del catálogo: así
 * conservan su rate limit y la cookie HttpOnly. Los eventos de sesión sí salen,
 * con IP y dispositivo, para poder alertar por webhook.
 */
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
      {
        error: {
          code: "FORBIDDEN",
          kind: "FORBIDDEN",
          message: "Solo por invitación",
        },
      },
      403,
    );
  const signOut = path === "/api/auth/sign-out";
  const ip = clientIp(c);
  const leaving = signOut
    ? await authenticator.resolve(credentialFrom(c.req.raw.headers))
    : null;
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-sloption-client-ip", ip ?? "unknown");
  const response = await auth.handler(new Request(c.req.raw, { headers }));
  if (response.ok && path !== "/api/auth/get-session") {
    // Resolve the signed cookie returned by BetterAuth, not an unsigned token.
    const actor = signOut
      ? leaving
      : await authenticator.resolve({
          kind: "session",
          cookie: response.headers
            .getSetCookie()
            .map((cookie) => cookie.split(";")[0])
            .join("; "),
        });
    if (actor)
      await recordSession(signOut ? "logout" : "login", actor, {
        ip,
        userAgent: c.req.header("user-agent") ?? null,
      });
  }
  return response;
});

/** Una ruta por endpoint del catálogo. Toda la lógica está detrás de `execute`. */
for (const entry of catalog.entries)
  app.on(entry.http.method, entry.http.path, async (c) => {
    const input =
      entry.http.method === "GET"
        ? { ...c.req.query(), ...c.req.param() }
        : await jsonBody(c.req.raw);
    const output = await catalog.execute(
      entry.name,
      input,
      credentialFrom(c.req.raw.headers),
    );
    if (entry.http.response === "file") {
      const file = output as { mime: string; content: string };
      c.header("Content-Type", file.mime);
      c.header("Cache-Control", "private, max-age=3600");
      return c.body(Buffer.from(file.content, "base64"));
    }
    return c.json(output as object);
  });

/**
 * Avisa a los navegadores que el tablero cambió. No hay cursor ni historial:
 * al conectar o reconectar llega `ready` y el cliente recarga todo.
 */
app.get("/api/events", async (c) => {
  const credential = credentialFrom(c.req.raw.headers);
  if (!(await authenticator.resolve(credential)))
    throw new ActionError("UNAUTHENTICATED", "Inicia sesión");
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache");
  return streamSSE(c, async (stream) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const abort = new AbortController();
    const notify = (message: Notification) => {
      void stream.writeSSE({
        event: "change",
        data: JSON.stringify({ type: message.payload ?? null }),
      });
    };
    client.on("notification", notify);
    client.on("error", () => abort.abort());
    stream.onAbort(() => abort.abort());
    try {
      await client.query("LISTEN sloption_events");
      await stream.writeSSE({ event: "ready", data: "{}" });
      // Cada 15 s: una key revocada o una sesión cerrada cortan el stream, y el
      // ping mantiene viva la conexión detrás del proxy.
      while (!abort.signal.aborted) {
        await sleep(15_000, undefined, { signal: abort.signal }).catch(() => {});
        if (abort.signal.aborted || !(await authenticator.resolve(credential)))
          break;
        await stream.writeSSE({ event: "ping", data: "{}" });
      }
    } finally {
      client.removeListener("notification", notify);
      await client.end();
    }
  });
});
app.use("/assets/*", serveStatic({ root: "./dist/web" }));
app.get("*", serveStatic({ path: "./dist/web/index.html" }));
