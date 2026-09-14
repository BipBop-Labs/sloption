import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";

// Cada componente trae su propia hoja: se cargan todas para que la prueba siga
// midiendo las reglas reales aunque una regla cambie de archivo.
function allStyles() {
  return readdirSync("src/frontend", { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(`src/frontend/${file}`, "utf8"))
    .join("\n");
}

// No necesita servidor ni base: monta las reglas reales sobre una columna.
// Cubre las dos cosas que pueden romperse en silencio en el hueco de destino:
// que ocupe espacio real (las vecinas se corren) y que el hit-test lo vea. Lo
// segundo es lo que corta el ciclo de parpadeo: si el hueco fuera invisible al
// hit-test, el cursor caería en la columna, el destino saltaría al final y el
// layout oscilaría.
test("el hueco de destino abre espacio y es visible al hit-test", async ({
  page,
}) => {
  const css = allStyles();
  await page.setContent(
    `<style>${css}</style>
     <section class="column" data-option="qa" style="width:280px">
       <div class="cards">
         <article class="card" data-card-id="a"><h3>A</h3></article>
         <article class="card" data-card-id="b"><h3>B</h3></article>
       </div>
     </section>`,
  );
  const b = page.locator('[data-card-id="b"]');
  const before = (await b.boundingBox())!;

  const height = 96;
  await page.locator(".cards").evaluate((list, h) => {
    const slot = document.createElement("div");
    slot.className = "drop-slot";
    slot.style.height = `${h}px`;
    list.insertBefore(slot, list.children[1]!);
  }, height);

  // La vecina se corre: el hueco más el gap de 8px de .cards.
  const after = (await b.boundingBox())!;
  expect(Math.round(after.y - before.y)).toBe(height + 8);

  const slot = page.locator(".drop-slot");
  await expect(slot).toHaveCSS("border-top-style", "dashed");

  // El hit-test tiene que encontrar el hueco, no atravesarlo.
  const box = (await slot.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) =>
      document
        .elementsFromPoint(x, y)
        .map((element) => element.className)
        .join(" "),
    [box.x + box.width / 2, box.y + box.height / 2] as [number, number],
  );
  expect(hit).toContain("drop-slot");
});

// Lo mismo para las columnas: el hueco entre columnas tiene que empujar a la
// vecina y ser visible al hit-test. Cuelga del tablero, no de .cards, así que
// columnDropAt lo reconoce por su clase y no por la columna que lo contiene.
test("el hueco entre columnas abre espacio y es visible al hit-test", async ({
  page,
}) => {
  const css = allStyles();
  await page.setContent(
    `<style>${css}</style>
     <div class="board" style="width:900px">
       <section class="column" data-option="qa" style="flex:0 0 280px">
         <header class="column-header draggable"><h2>QA</h2></header>
       </section>
       <section class="column" data-option="listo" style="flex:0 0 280px">
         <header class="column-header draggable"><h2>Listo</h2></header>
       </section>
     </div>`,
  );
  const listo = page.locator('[data-option="listo"]');
  const before = (await listo.boundingBox())!;

  const width = 280;
  await page.locator(".board").evaluate((board, w) => {
    const slot = document.createElement("div");
    slot.className = "drop-slot";
    slot.style.flex = `0 0 ${w}px`;
    slot.style.height = "120px";
    board.insertBefore(slot, board.children[1]!);
  }, width);

  // La vecina se corre: el hueco más el gap de 20px de .board en escritorio.
  const after = (await listo.boundingBox())!;
  expect(Math.round(after.x - before.x)).toBe(width + 20);

  const box = (await page.locator(".drop-slot").boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) =>
      document
        .elementsFromPoint(x, y)
        .map((element) => element.className)
        .join(" "),
    [box.x + box.width / 2, box.y + box.height / 2] as [number, number],
  );
  expect(hit).toContain("drop-slot");
});
