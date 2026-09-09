#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const [name, argument = "{}"] = process.argv.slice(2);
if (!name || name === "help" || name === "--help" || name === "-h") {
  console.log(`Sloption CLI — un adaptador más sobre las mismas acciones que usa la UI.
Todo lo que se puede hacer en el navegador se puede hacer acá.

USO
  pnpm -s cli <acción> '<JSON>'        entrada como argumento
  pnpm -s cli <acción> @archivo.json   entrada desde archivo (cuerpos largos, base64)
  pnpm -s cli help

  Usá siempre \`pnpm -s cli\`: sin -s, pnpm imprime su propio encabezado antes del JSON.

ENTORNO
  SLOPTION_URL      base del servidor (default http://localhost:5173)
  SLOPTION_API_KEY  clave de agente; viaja como Authorization: Bearer
  SLOPTION_COOKIE   alternativa a la clave: cookie de sesión que devuelve auth.login
  SLOPTION_ORIGIN   solo si apuntás al puerto del backend: el APP_URL que espera el servidor

SALIDA
  stdout es JSON y nada más, indentado. En error imprime
  {"error":{"code","message"}} y sale con código 1.
  Códigos: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, INVALID_INPUT, CONFLICT, INTERNAL.

DESCUBRIMIENTO
  pnpm -s cli catalog.read '{}'
  Devuelve todas las acciones con su JSON Schema de entrada y salida, el acceso que
  piden (member/admin) y el evento que emiten. Es la fuente de verdad: esta ayuda no
  lista acciones a propósito, para no desincronizarse del catálogo.

SESIÓN (no son acciones del catálogo, son operaciones propias de la CLI)
  auth.login '{"email":"...","password":"..."}'   imprime {result, cookie}
  auth.logout '{}'
  invitation.accept '{"token":"...","password":"...","name":"..."}'

QUIÉN SOY
  No hay whoami. Tu propia huella alcanza:
  pnpm -s cli history.list '{"limit":1,"includeReads":true}'
  En actor: userId es la persona dueña de la clave y agentId el perfil del agente.
  Ese agentId es el que va en un campo de tipo people para asignarte algo.

PARA AGENTES
  - Si un flujo de la UI no se puede reproducir acá, falta una acción: reportalo.
  - Las lecturas también quedan auditadas como evento.
  - card.update exige la version que devolvió la última lectura; si
    alguien más tocó la tarjeta responde CONFLICT: releé con card.read y reintentá.
  - El cuerpo de una tarjeta no es texto plano: se edita con document.apply, que
    recibe una actualización Yjs en base64 y devuelve el Markdown resultante.`);
  process.exit(0);
}
const input = JSON.parse(
  argument.startsWith("@")
    ? await readFile(argument.slice(1), "utf8")
    : argument,
);
const endpoint =
  name === "auth.login"
    ? "/api/auth/sign-in/email"
    : name === "auth.logout"
      ? "/api/auth/sign-out"
      : name === "invitation.accept"
        ? "/api/invitations/accept"
        : `/api/actions/${encodeURIComponent(name)}`;
const response = await fetch(
  `${process.env.SLOPTION_URL ?? "http://localhost:5173"}${endpoint}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin:
        process.env.SLOPTION_ORIGIN ??
        process.env.SLOPTION_URL ??
        "http://localhost:5173",
      ...(process.env.SLOPTION_API_KEY
        ? { Authorization: `Bearer ${process.env.SLOPTION_API_KEY}` }
        : {}),
      ...(process.env.SLOPTION_COOKIE
        ? { Cookie: process.env.SLOPTION_COOKIE }
        : {}),
    },
    body: JSON.stringify(input),
  },
);
const output = await response.json();
if (name === "auth.login" && response.ok)
  console.log(
    JSON.stringify(
      {
        result: output,
        cookie: response.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; "),
      },
      null,
      2,
    ),
  );
else console.log(JSON.stringify(output, null, 2));
if (!response.ok) process.exitCode = 1;
