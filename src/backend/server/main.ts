import { serve } from "@hono/node-server";
import { app } from "../adapters/http/app";
import { pool } from "./context";
const server = serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
});
console.log("Sloption server ready");
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
