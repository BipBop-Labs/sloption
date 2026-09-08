#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const [name, argument = "{}"] = process.argv.slice(2);
if (!name) {
  console.log(
    "Usage: pnpm cli <action.name|auth.login|auth.logout|invitation.accept> <JSON|@file>\nSet SLOPTION_URL and SLOPTION_API_KEY (or SLOPTION_COOKIE). Use catalog.read to inspect schemas.",
  );
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
