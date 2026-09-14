import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const cli = (args: string[], apiKey: string) =>
  spawnSync("pnpm", ["-s", "cli", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      SLOPTION_URL: "http://localhost:5173",
      SLOPTION_API_KEY: apiKey,
    },
  });

test("invitation, member authorization, CLI parity and revocation", async ({
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:5173",
    extraHTTPHeaders: { Origin: "http://localhost:5173" },
  });
  expect(
    (
      await admin.post("/api/auth/sign-in/email", {
        data: {
          email: env.SEED_ADMIN_EMAIL,
          password: env.SEED_ADMIN_PASSWORD,
        },
      })
    ).ok(),
  ).toBeTruthy();
  const call = (name: string, data: unknown = {}) =>
    admin.post(`/api/${name.replace(".", "/")}`, { data });
  const email = `test-${Date.now()}@sloption.local`;
  const password = "Local integration test password 42";
  const invitation = await (
    await call("invitations.create", { email, role: "member", profileId: null })
  ).json();
  const member = await playwright.request.newContext({
    baseURL: "http://localhost:5173",
    extraHTTPHeaders: { Origin: "http://localhost:5173" },
  });
  const accepted = await member.post("/api/invitations/accept", {
    data: { token: invitation.token, name: "Integration member", password },
  });
  expect(accepted.status(), await accepted.text()).toBe(200);
  const again = await member.post("/api/invitations/accept", {
    data: { token: invitation.token, name: "Again", password },
  });
  expect(again.status()).toBe(403);
  expect((await again.json()).error.code).toBe("INVALID_INVITATION");
  expect(
    (
      await member.post("/api/auth/sign-in/email", {
        data: { email, password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await member.post("/api/fields/create", {
        data: { name: "Forbidden", type: "text", options: [] },
      })
    ).status(),
  ).toBe(403);
  const key = await (
    await member.post("/api/keys/create", {
      data: { name: "Integration agent" },
    })
  ).json();
  const me = cli(["session", "me"], key.token);
  expect(me.status, me.stderr).toBe(0);
  expect(JSON.parse(me.stdout).agentId).toBe(key.agentId);
  const created = cli(
    ["cards", "create", JSON.stringify({ title: "E2E API card" })],
    key.token,
  );
  expect(created.status, created.stderr).toBe(0);
  const card = JSON.parse(created.stdout);
  const field = await (
    await call("fields.create", {
      name: "E2E selection",
      type: "select",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    })
  ).json();
  const edited = await (
    await call("cards.update", {
      id: card.id,
      version: card.version,
      properties: { [field.id]: "a" },
    })
  ).json();
  expect(edited.properties[field.id]).toBe("a");
  const stale = await call("cards.update", {
    id: card.id,
    version: card.version,
    title: "stale",
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.code).toBe("STALE_VERSION");
  expect(
    (
      await call("fields.update", {
        id: field.id,
        name: field.name,
        options: [{ id: "b", label: "B" }],
      })
    ).ok(),
  ).toBeTruthy();
  const cleared = await (await call("cards.read", { id: card.id })).json();
  expect(cleared.properties[field.id]).toBeNull();
  await call("fields.remove", { id: field.id });
  await call("cards.archive", { id: card.id, archived: true });
  expect(
    (await admin.post("/api/keys/revoke", { data: { id: key.id } })).status(),
  ).toBe(403);
  expect(
    (await member.post("/api/keys/revoke", { data: { id: key.id } })).ok(),
  ).toBeTruthy();
  expect(cli(["boards", "read", '{"view":"all"}'], key.token).status).toBe(1);
  await admin.dispose();
  await member.dispose();
});

test("webhook outbox retries, signs the body and names the agent", async ({
  playwright,
}) => {
  const { createServer } = await import("node:http");
  const { createHmac } = await import("node:crypto");
  const { execFileSync } = await import("node:child_process");
  // El backend corre en Docker y el receptor en esta máquina. Con Docker Desktop el
  // gateway de la red queda dentro de la VM: al host se llega por host.docker.internal.
  const gateway = "host.docker.internal";
  const received: { body: string; signature?: string; timestamp?: string }[] =
    [];
  const receiver = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    received.push({
      body,
      signature: request.headers["x-sloption-signature"] as string,
      timestamp: request.headers["x-sloption-timestamp"] as string,
    });
    response.writeHead(received.length === 1 ? 503 : 204);
    response.end();
  });
  await new Promise<void>((resolve) => receiver.listen(0, "0.0.0.0", resolve));
  const address = receiver.address() as { port: number };
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:5173",
    extraHTTPHeaders: { Origin: "http://localhost:5173" },
  });
  await admin.post("/api/auth/sign-in/email", {
    data: { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD },
  });
  let hook: { id: string; secret: string } | undefined;
  let keyId: string | undefined;
  try {
    hook = await (
      await admin.post("/api/webhooks/create", {
        data: {
          url: `http://${gateway}:${address.port}`,
          events: ["cards.created.v1"],
          enabled: true,
        },
      })
    ).json();
    const key = await (
      await admin.post("/api/keys/create", { data: { name: "Webhook agent" } })
    ).json();
    keyId = key.id;
    const card = JSON.parse(
      cli(["cards", "create", '{"title":"E2E webhook"}'], key.token).stdout,
    );
    await expect
      .poll(() => received.length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(2);
    const message = received[1]!;
    expect(message.signature).toBe(
      `sha256=${createHmac("sha256", hook!.secret).update(`${message.timestamp}.${message.body}`).digest("hex")}`,
    );
    const event = JSON.parse(message.body);
    expect(event.type).toBe("cards.created.v1");
    expect(event.data).toEqual({
      cardId: card.id,
      title: "E2E webhook",
      weekly: false,
    });
    expect(event.actor.agentId).toBe(key.agentId);
    expect(JSON.parse(received[0]!.body).id).toBe(event.id);
    await admin.post("/api/cards/archive", {
      data: { id: card.id, archived: true },
    });
  } finally {
    if (hook)
      await admin.post("/api/webhooks/remove", { data: { id: hook.id } });
    if (keyId) await admin.post("/api/keys/revoke", { data: { id: keyId } });
    await admin.dispose();
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
  }
});
