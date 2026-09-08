import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
// Solo lee: entra, pagina el historial y vuelve. No crea ni modifica tarjetas.
test("historial: vista propia, tabla paginada y lecturas aparte", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Correo", { exact: true }).fill(env.SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Esta semana", exact: true }),
  ).toBeVisible();
  // El historial son eventos, no tareas: no está entre las pestañas del tablero.
  await expect(
    page
      .getByRole("navigation", { name: "Vistas" })
      .getByRole("link", { name: "Historial" }),
  ).toHaveCount(0);
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Historial de eventos" })
    .click();
  await expect(page).toHaveURL(/view=history/);
  await expect(
    page.getByRole("heading", { name: "Historial", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Vistas" })).toHaveCount(0);
  const rows = page.locator(".history tbody tr");
  await expect(rows.first()).toBeVisible();
  const first = (await rows.first().innerText()).replace(/\s+/g, " ").trim();
  // El historial dejó de vivir en el modal de configuración.
  await page.getByRole("button", { name: /^Cuenta de / }).click();
  await page.getByRole("menuitem", { name: "Configuración" }).click();
  await expect(
    page.getByRole("heading", { name: "Configuración" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Historial", level: 3 }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar configuración" }).click();
  // Paginación por cursor: "Anteriores" avanza y "Más recientes" vuelve.
  const older = page.getByRole("button", { name: "Anteriores", exact: true });
  const newer = page.getByRole("button", {
    name: "Más recientes",
    exact: true,
  });
  await expect(newer).toBeDisabled();
  if (await older.isEnabled()) {
    await older.click();
    await expect(rows.first()).not.toHaveText(first, { useInnerText: true });
    await expect(newer).toBeEnabled();
    await newer.click();
    await expect(rows.first()).toHaveText(first, { useInnerText: true });
  }
  // Las lecturas son la mayoría de los eventos y se piden aparte.
  await expect(
    page.locator(".history tbody tr", { hasText: "board.read" }),
  ).toHaveCount(0);
  await page.getByLabel("Mostrar también quién miró qué").check();
  await expect(
    page.locator(".history tbody tr", { hasText: "board.read" }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
