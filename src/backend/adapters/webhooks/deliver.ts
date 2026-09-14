import { createHmac } from "node:crypto";
import type { ActionEvent } from "../../lib/endpoint";

const MAX_ATTEMPTS = 10;

/**
 * Entrega un evento a sus webhooks, después del commit. Recipients deduplicate
 * using X-Sloption-Event-Id. Hasta diez intentos con espera exponencial.
 */
// ponytail: en memoria, sin outbox; un reinicio pierde lo pendiente. Volver a una tabla de entregas si eso importa.
export function deliver(
  hooks: readonly { url: string; secret: string }[],
  event: ActionEvent,
) {
  const body = JSON.stringify(event);
  for (const hook of hooks) void attempt(hook, event.id, body, 1);
}

async function attempt(
  hook: { url: string; secret: string },
  eventId: string,
  body: string,
  attempts: number,
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", hook.secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  try {
    const response = await fetch(hook.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Sloption-Event-Id": eventId,
        "X-Sloption-Timestamp": timestamp,
        "X-Sloption-Signature": `sha256=${signature}`,
      },
      body,
    });
    await response.body?.cancel();
    if (response.ok) return;
  } catch {
    // Se reintenta abajo, igual que un status de error.
  }
  if (attempts >= MAX_ATTEMPTS) {
    console.error(`Webhook ${hook.url} failed ${attempts} times for ${eventId}`);
    return;
  }
  setTimeout(
    () => void attempt(hook, eventId, body, attempts + 1),
    Math.min(3600, 2 ** attempts) * 1000,
  ).unref();
}
