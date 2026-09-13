import { createHmac } from "node:crypto";
import type { Pool } from "pg";

/** Durable outbox. Recipients deduplicate using X-Sloption-Event-Id. */
export function startWebhookWorker(pool: Pool) {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const delivery = (
        await client.query(
          "select * from deliveries where status='pending' and next_attempt <= now() order by next_attempt limit 1 for update skip locked",
        )
      ).rows[0];
      if (!delivery) {
        await client.query("COMMIT");
        return;
      }
      const hook = (
        await client.query(
          "select payload from records where collection='webhooks' and id=$1",
          [delivery.webhook_id],
        )
      ).rows[0]?.payload;
      if (!hook?.enabled) {
        await client.query(
          "update deliveries set status='cancelled' where id=$1",
          [delivery.id],
        );
        await client.query("COMMIT");
        return;
      }
      const event = (
        await client.query("select payload from events where sequence=$1", [
          delivery.event_sequence,
        ])
      ).rows[0].payload;
      const body = JSON.stringify(event);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", hook.secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      let success = false;
      let message = "";
      try {
        const response = await fetch(hook.url, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          headers: {
            "Content-Type": "application/json",
            "X-Sloption-Event-Id": event.id,
            "X-Sloption-Timestamp": timestamp,
            "X-Sloption-Signature": `sha256=${signature}`,
          },
          body,
        });
        success = response.ok;
        message = `HTTP ${response.status}`;
        await response.body?.cancel();
      } catch (error) {
        message = error instanceof Error ? error.message : "Delivery failed";
      }
      const attempts = delivery.attempts + 1;
      await client.query(
        "update deliveries set attempts=$2,status=$3,last_error=$4,next_attempt=now()+($5::text || ' seconds')::interval where id=$1",
        [
          delivery.id,
          attempts,
          success ? "delivered" : attempts >= 10 ? "failed" : "pending",
          success ? null : message.slice(0, 500),
          Math.min(3600, 2 ** attempts),
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Webhook worker failed", error);
    } finally {
      client.release();
      busy = false;
    }
  }, 1000);
  return () => clearInterval(timer);
}
