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
test("invitation, member authorization, CLI parity, key attribution and revocation", async ({
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
    admin.post(`/api/actions/${name}`, { data });
  const email = `test-${Date.now()}@sloption.local`;
  const password = "Local integration test password 42";
  const invitation = await (
    await call("invitation.create", { email, role: "member", profileId: null })
  ).json();
  const member = await playwright.request.newContext({
    baseURL: "http://localhost:5173",
    extraHTTPHeaders: { Origin: "http://localhost:5173" },
  });
  const accepted = await member.post("/api/invitations/accept", {
    data: { token: invitation.token, name: "Integration member", password },
  });
  expect(accepted.status(), await accepted.text()).toBe(200);
  expect(
    (
      await member.post("/api/invitations/accept", {
        data: { token: invitation.token, name: "Again", password },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await member.post("/api/auth/sign-in/email", {
        data: { email, password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await member.post("/api/actions/field.create", {
        data: { name: "Forbidden", type: "text", options: [] },
      })
    ).status(),
  ).toBe(403);
  const key = await (
    await member.post("/api/actions/key.create", {
      data: { name: "Integration agent" },
    })
  ).json();
  const cli = spawnSync(
    "pnpm",
    [
      "cli",
      "card.create",
      JSON.stringify({ title: "E2E API card", weekly: false }),
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SLOPTION_URL: "http://localhost:5173",
        SLOPTION_API_KEY: key.token,
      },
    },
  );
  expect(cli.status, cli.stderr).toBe(0);
  const card = JSON.parse(cli.stdout.slice(cli.stdout.indexOf("{")));
  const history = await (await call("history.list", { limit: 100 })).json();
  const created = history.find(
    (event: { type: string; data: { entityId: string } }) =>
      event.type === "card.create.v1" && event.data.entityId === card.id,
  );
  expect(created.actor.agentId).toBe(key.agentId);
  const field = await (
    await call("field.create", {
      name: "E2E selection",
      type: "select",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    })
  ).json();
  const edited = await (
    await call("card.update", {
      id: card.id,
      version: card.version,
      values: { [field.id]: "a" },
    })
  ).json();
  expect(edited.values[field.id]).toBe("a");
  expect(
    (
      await call("card.update", {
        id: card.id,
        version: card.version,
        title: "stale",
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await call("field.update", {
        id: field.id,
        name: field.name,
        options: [{ id: "b", label: "B" }],
      })
    ).ok(),
  ).toBeTruthy();
  const cleared = await (await call("card.read", { id: card.id })).json();
  expect(cleared.values[field.id]).toBeNull();
  await call("field.remove", { id: field.id });
  await call("card.archive", { id: card.id, archived: true });
  expect(
    (
      await member.post("/api/actions/key.revoke", { data: { id: key.id } })
    ).ok(),
  ).toBeTruthy();
  const revoked = spawnSync("pnpm", ["cli", "board.read", '{"view":"all"}'], {
    encoding: "utf8",
    env: {
      ...process.env,
      SLOPTION_URL: "http://localhost:5173",
      SLOPTION_API_KEY: key.token,
    },
  });
  expect(revoked.status).toBe(1);
  await admin.dispose();
  await member.dispose();
});

test("webhook outbox retries and signs the exact event body", async ({
  playwright,
}) => {
  const { createServer } = await import("node:http");
  const { createHmac } = await import("node:crypto");
  const { execFileSync } = await import("node:child_process");
  const gateway = JSON.parse(
    execFileSync("docker", ["network", "inspect", "backoffice_default"], {
      encoding: "utf8",
    }),
  )[0].IPAM.Config[0].Gateway;
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
  try {
    hook = await (
      await admin.post("/api/actions/webhook.create", {
        data: {
          url: `http://${gateway}:${address.port}`,
          events: ["card.create.v1"],
          enabled: true,
        },
      })
    ).json();
    const card = await (
      await admin.post("/api/actions/card.create", {
        data: { title: "E2E webhook", weekly: false },
      })
    ).json();
    await expect
      .poll(() => received.length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(2);
    const message = received[1]!;
    expect(message.signature).toBe(
      `sha256=${createHmac("sha256", hook!.secret).update(`${message.timestamp}.${message.body}`).digest("hex")}`,
    );
    expect(JSON.parse(message.body).data.entityId).toBe(card.id);
    expect(JSON.parse(received[0]!.body).id).toBe(JSON.parse(message.body).id);
    await admin.post("/api/actions/card.archive", {
      data: { id: card.id, archived: true },
    });
  } finally {
    if (hook)
      await admin.post("/api/actions/webhook.remove", {
        data: { id: hook.id },
      });
    await admin.dispose();
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
  }
});
