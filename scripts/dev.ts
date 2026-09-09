import { execFileSync } from "node:child_process";
import { createServer, type ViteDevServer } from "vite";
function backendUrl() {
  const address = execFileSync(
    "docker",
    ["compose", "-f", "docker-compose.dev.yml", "port", "backend", "3000"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
    .trim()
    .split("\n")[0]!;
  return `http://127.0.0.1:${address.split(":").at(-1)}`;
}
let target = backendUrl();
let server: ViteDevServer;
async function start() {
  process.env.BACKEND_URL = target;
  server = await createServer({
    server: {
      // El origen debe coincidir con APP_URL: el backend rechaza los POST de otro
      // origen, y "127.0.0.1" no es "localhost" para el navegador.
      host: "localhost",
      proxy: { "/api": { target, changeOrigin: false } },
    },
  });
  await server.listen();
  server.printUrls();
}
await start();
let restarting = false;
const timer = setInterval(async () => {
  if (restarting) return;
  try {
    const next = backendUrl();
    if (next === target) return;
    restarting = true;
    target = next;
    await server.close();
    await start();
  } catch {
    /* Compose may temporarily have no published port during a rebuild. */
  } finally {
    restarting = false;
  }
}, 3000);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(timer);
    void server.close().then(() => process.exit(0));
  });
