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
  // No depende de datos previos: la base de desarrollo puede estar vacía.
  await page.request.post("/api/cards/create", {
    data: { title: `E2E semana ${Date.now()}`, weekly: true },
  });
  await expect(page.locator(".card").first()).toBeVisible();
  await page.request.post("/api/profiles/preferences", {
    data: { theme: "light" },
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: "test-results/board-desktop.png",
    fullPage: false,
  });
  const title = `E2E collaboration ${Date.now()}`;
  // La primera columna, se llame como se llame: las etapas las define el seed.
  await page
    .getByRole("textbox", { name: /^Nueva tarjeta en / })
    .first()
    .fill(title);
  await page
    .getByRole("button", { name: /^Crear tarjeta en / })
    .first()
    .click();
  const tile = page.getByRole("button", {
    name: `Abrir ${title}`,
    exact: true,
  });
  await expect(tile).toBeVisible();
  // Crear desde el composer ya abre el drawer. Un Enter sobre la tarjeta mueve el
  // foco fuera del panel mientras abre, y a veces lo cierra.
  await expect(page.getByRole("dialog")).toBeVisible();
  // El drawer entra deslizando: se mide cuando la animación terminó, no en el
  // primer frame, donde todavía está fuera de la pantalla. Se compara contra
  // clientWidth y no contra el viewport: si hay barra de scroll, el borde
  // derecho del área de layout no coincide con el del sistema.
  const layoutWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  await expect
    .poll(async () => {
      const box = await page.getByRole("dialog").boundingBox();
      return Math.round(box!.x + box!.width);
    })
    .toBe(layoutWidth);
  // La barra de filtros del tablero también tiene un control "Prioridad": esta
  // parte edita la tarjeta, así que se acota al panel.
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Prioridad", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "alta", exact: true }).click();
  await expect(
    drawer.getByRole("button", { name: "Prioridad", exact: true }),
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
  // Archivar pide confirmación desde 120c86d; el test nunca la aceptaba.
  await page
    .getByRole("dialog", { name: "¿Archivar esta tarjeta?" })
    .getByRole("button", { name: "Archivar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restaurar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar tarjeta" }).click();
  await second.close();
  await page.getByRole("button", { name: /^Cuenta de / }).click();
  await page.getByRole("menuitem", { name: "Configuración" }).click();
  await page.getByRole("button", { name: "Usuarios" }).click();
  await expect(
    page.getByRole("heading", { name: "Usuarios e invitaciones" }),
  ).toBeVisible();
  // El tema es una preferencia, no un botón de la cabecera: vive en General.
  await page.getByRole("button", { name: "General" }).click();
  await page.getByRole("button", { name: "Apariencia" }).click();
  await page.getByRole("menuitemradio", { name: "Oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Cerrar configuración" }).click();
  await page.screenshot({
    path: "test-results/board-dark.png",
    fullPage: false,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /^Cuenta de / }).click();
  await page.getByRole("menuitem", { name: "Configuración" }).click();
  await page.getByRole("button", { name: "Apariencia" }).click();
  await page.getByRole("menuitemradio", { name: "Claro" }).click();
  await page.getByRole("button", { name: "Cerrar configuración" }).click();
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
