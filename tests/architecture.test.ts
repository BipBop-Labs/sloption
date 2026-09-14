import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/** Cada import relativo de src/backend, resuelto a una ruta desde src/backend. */
const root = resolve("src/backend");
const imports = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".ts"))
  .flatMap((file) =>
    [
      ...readFileSync(join(root, file), "utf8").matchAll(
        /from\s+"(\.{1,2}\/[^"]+)"/g,
      ),
    ].map((match) => ({
      file,
      target: relative(root, resolve(root, dirname(file), match[1]!)),
    })),
  );

describe("dependencias del backend", () => {
  test("encontró imports que revisar", () => {
    expect(imports.length).toBeGreaterThan(50);
  });

  test("lib no conoce los dominios", () => {
    expect(
      imports.filter(
        ({ file, target }) =>
          file.startsWith("lib/") && target.startsWith("domains/"),
      ),
    ).toEqual([]);
  });

  test("solo el composition root importa orquestadores", () => {
    expect(
      imports.filter(
        ({ file, target }) =>
          target.endsWith("/orchestrator") && !file.startsWith("server/"),
      ),
    ).toEqual([]);
  });

  test("los servicios no importan routers", () => {
    expect(
      imports.filter(
        ({ file, target }) =>
          file.endsWith("services.ts") && target.endsWith("/router"),
      ),
    ).toEqual([]);
  });
});
