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
test("board, collaborative editor, settings and mobile", async ({
  page,
  browser,
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
  await expect(page.locator(".card").first()).toBeVisible();
  await page.request.post("/api/actions/profile.preferences", {
    data: { theme: "light" },
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: "test-results/board-desktop.png",
    fullPage: false,
  });
  const title = `E2E collaboration ${Date.now()}`;
  await page
    .getByLabel("Nueva tarjeta en no comenzado", { exact: true })
    .fill(title);
  await page
    .getByRole("button", { name: "Crear tarjeta en no comenzado", exact: true })
    .click();
  const tile = page.getByRole("button", {
    name: `Abrir ${title}`,
    exact: true,
  });
  await expect(tile).toBeVisible();
  await tile.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  const drawer = await page.getByRole("dialog").boundingBox();
  expect(Math.round(drawer!.x + drawer!.width)).toBe(
    page.viewportSize()!.width,
  );
  await page.getByRole("button", { name: "Prioridad", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "alta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Prioridad", exact: true }),
  ).toContainText("alta");
  const editor = page.getByRole("textbox", { name: "Contenido de la tarjeta" });
  await expect(editor).toBeVisible();
  await page.screenshot({
    path: "test-results/card-drawer.png",
    fullPage: false,
  });
  await editor.fill("Primer texto compartido");
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  const second = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  const other = await second.newPage();
  await other.goto(page.url());
  const otherEditor = other.getByRole("textbox", {
    name: "Contenido de la tarjeta",
  });
  await expect(otherEditor).toContainText("Primer texto compartido");
  await otherEditor.press("End");
  await otherEditor.pressSequentially(" desde otro cliente");
  await expect(other.getByText("Guardado", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(editor).toContainText("desde otro cliente", { timeout: 20000 });
  await page.getByRole("button", { name: "Esta semana", exact: true }).click();
  await page.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restaurar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar tarjeta" }).click();
  await second.close();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Usuarios e invitaciones" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar configuración" }).click();
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/board-dark.png",
    fullPage: false,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Activar modo claro" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/board-mobile.png",
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
