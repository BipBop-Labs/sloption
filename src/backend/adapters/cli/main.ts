#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const HELP = `Sloption CLI — un cliente más de la API HTTP que usa la web.
Todo lo que se puede hacer en el navegador se puede hacer acá.

INSTALACIÓN
  pnpm -s install:cli   deja \`sloption\` en ~/.local/bin apuntando al repo.
  Actualizar es \`git pull\`; el symlink sigue al repo. Otro destino: SLOPTION_BIN=/otro/bin.
  Sin instalar: \`pnpm -s cli <base> <nombre>\` (con -s, o pnpm imprime su encabezado antes del JSON).

USO
  sloption <base> <nombre> '<JSON>'        entrada como argumento
  sloption <base> <nombre> @archivo.json   entrada desde archivo (cuerpos largos, base64)
  sloption <base>.<nombre> '<JSON>'        lo mismo, con punto
  sloption help                           esta ayuda y, con credenciales, los comandos

ENTORNO
  SLOPTION_URL      base del servidor (default http://localhost:5173)
  SLOPTION_API_KEY  clave de agente; viaja como Authorization: Bearer
  SLOPTION_COOKIE   alternativa a la clave: la cookie que imprime session login
  SLOPTION_ORIGIN   solo si apuntás al puerto del backend: el APP_URL que espera el servidor

SALIDA
  stdout es JSON y nada más, indentado. En error imprime
  {"error":{"code","kind","message"}} y sale con código 1.
  kind: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, INVALID_INPUT, CONFLICT o INTERNAL.
  code: el error concreto del dominio, como STALE_VERSION o TARGET_MOVED.

DESCUBRIMIENTO
  sloption catalog read
  Cada endpoint con su doc, JSON Schema de entrada y salida, acceso, errores y el
  evento que emite con su payload. La CLI saca las rutas de ahí.

SESIÓN
  sloption session login '{"email":"...","password":"..."}'   imprime {result, cookie}
  sloption session logout
  sloption session me      quién sos: userId es la persona, agentId el agente

PARA AGENTES
  - Si un flujo de la UI no se puede reproducir acá, falta un endpoint: reportalo.
  - Las lecturas también emiten evento. No se guardan: se consumen por webhook.
  - cards update exige la version de la última lectura; si alguien más tocó la
    tarjeta responde STALE_VERSION: releé con cards read y reintentá.
  - El cuerpo de una tarjeta se edita con cards applyDocument, que recibe una
    actualización Yjs en base64 y devuelve el Markdown resultante.`;

interface Endpoint {
  cli: string;
  doc: string;
  http: { method: "GET" | "POST"; path: string };
}

const server = process.env.SLOPTION_URL ?? "http://localhost:5173";
const credentials: Record<string, string> = {
  ...(process.env.SLOPTION_API_KEY
    ? { Authorization: `Bearer ${process.env.SLOPTION_API_KEY}` }
    : {}),
  ...(process.env.SLOPTION_COOKIE ? { Cookie: process.env.SLOPTION_COOKIE } : {}),
};

function request(method: string, path: string, body?: unknown) {
  return fetch(`${server}${path}`, {
    method,
    headers: {
      Origin: process.env.SLOPTION_ORIGIN ?? server,
      ...credentials,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(kind: string, message: string): never {
  print({ error: { code: kind, kind, message } });
  process.exit(1);
}

/** Las rutas salen del servidor, así la CLI nunca se desincroniza. Sin credenciales, null. */
async function endpoints(): Promise<Endpoint[] | null> {
  const response = await request("POST", "/api/catalog/read", {});
  return response.ok
    ? ((await response.json()) as { endpoints: Endpoint[] }).endpoints
    : null;
}

const args = process.argv.slice(2);
if (!args[0] || ["help", "--help", "-h"].includes(args[0])) {
  console.log(HELP);
  const list = Object.keys(credentials).length ? await endpoints() : null;
  if (list) {
    console.log("\nCOMANDOS");
    for (const endpoint of list)
      console.log(`  ${endpoint.cli.padEnd(26)} ${endpoint.doc}`);
  }
  process.exit(0);
}

const [command, raw = "{}"] = args[0].includes(".")
  ? [args[0].replace(".", " "), args[1]]
  : [`${args[0]} ${args[1] ?? ""}`, args[2]];
let input: Record<string, unknown>;
try {
  input = JSON.parse(
    raw.startsWith("@") ? await readFile(raw.slice(1), "utf8") : raw,
  );
} catch {
  fail("INVALID_INPUT", "La entrada no es JSON válido");
}

if (command === "session login" || command === "session logout") {
  const response = await request(
    "POST",
    command === "session login" ? "/api/auth/sign-in/email" : "/api/auth/sign-out",
    input,
  );
  const output: unknown = await response.json().catch(() => ({}));
  print(
    command === "session login" && response.ok
      ? {
          result: output,
          cookie: response.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; "),
        }
      : output,
  );
  process.exit(response.ok ? 0 : 1);
}

// Sin catálogo —sin credenciales o con una clave revocada— vale la ruta por
// defecto: alcanza para los públicos, como invitations accept, y el servidor
// responde el error de autenticación para el resto.
const [group, name] = command.split(" ");
const known = await endpoints();
const endpoint = known
  ? known.find((item) => item.cli === command)
  : { http: { method: "POST", path: `/api/${group}/${name}` } };
if (!endpoint)
  fail("NOT_FOUND", `No existe \`${command}\`. Mirá sloption help.`);

const path = endpoint.http.path.replace(/:(\w+)/g, (_, key: string) => {
  const value = encodeURIComponent(String(input[key]));
  delete input[key];
  return value;
});
const query = new URLSearchParams(
  Object.entries(input).map(([key, value]) => [key, String(value)]),
).toString();
const response =
  endpoint.http.method === "GET"
    ? await request("GET", query ? `${path}?${query}` : path)
    : await request("POST", path, input);
if (response.headers.get("content-type")?.includes("application/json"))
  print(await response.json());
else process.stdout.write(Buffer.from(await response.arrayBuffer()));
process.exitCode = response.ok ? 0 : 1;
