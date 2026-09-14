import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/** Cada archivo de src/backend con sus imports relativos, resueltos desde src/backend. */
const root = resolve("src/backend");
const sources = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".ts"))
  .map((file) => ({ file, text: readFileSync(join(root, file), "utf8") }));
const imports = sources.flatMap(({ file, text }) =>
  [...text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)].map((match) => ({
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

  test("lib no define modelos: no toca Drizzle", () => {
    expect(
      sources
        .filter(
          ({ file, text }) =>
            file.startsWith("lib/") && text.includes("drizzle-orm"),
        )
        .map(({ file }) => file),
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

  test("los modelos solo importan otros modelos", () => {
    expect(
      imports.filter(
        ({ file, target }) =>
          file.endsWith("models.ts") && !target.endsWith("models"),
      ),
    ).toEqual([]);
  });

  test("los esquemas solo importan otros esquemas", () => {
    expect(
      imports.filter(
        ({ file, target }) =>
          file.endsWith("schemas.ts") && !target.endsWith("schemas"),
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
