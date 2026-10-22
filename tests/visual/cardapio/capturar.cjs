const { chromium } = require("/tmp/browser/node_modules/playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = "http://127.0.0.1:18173";
  const path = "/app/docs/prints-cardapio/";
  await page.goto(base);
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.language), "pt-BR");
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() =>
      Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
    ),
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  await page.waitForTimeout(650);
  await page.screenshot({
    animations: "disabled",
    path: path + "01-lista-computador.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(650);
  await page.screenshot({ animations: "disabled", path: path + "03-item-disponibilidade.png" });
  await page.getByRole("button", { name: "Fim de semana", exact: true }).click();
  assert.match(await page.getByRole("dialog").innerText(), /sábado e domingo/);
  assert.equal(await page.locator("input[type=time]").count(), 0);
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Sem preço", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: /^Abrir / }).count(), 3);
  await page.waitForTimeout(650);
  await page.screenshot({ animations: "disabled", path: path + "05-sem-preco.png" });
  await page.reload();
  await page.getByRole("button", { name: "Abrir Tempurá de legumes", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /^Abrir / }).count(), 3);
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Selecionar todos de Almoço executivo", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "Selecionar todos de Entradas", exact: true }).check();
  await page.getByRole("button", { name: "Definir disponibilidade", exact: true }).click();
  await page.getByRole("button", { name: "Dias úteis", exact: true }).click();
  await page.getByRole("button", { name: "Aplicar aos itens", exact: true }).click();
  await page.getByText(/2 de 7 processados/).waitFor();
  await page.waitForTimeout(650);
  await page.screenshot({ animations: "disabled", path: path + "04-lote-em-andamento.png" });
  await page.getByText("Resultado da atualização", { exact: true }).waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /6 atualizados · 1 falharam/);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.waitForTimeout(650);
  await page.screenshot({
    animations: "disabled",
    path: path + "02-lista-celular.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).click();
  assert.ok(await page.getByRole("dialog").evaluate((e) => e.getBoundingClientRect().width <= 390));
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(base + "?papel=membro");
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).waitFor();
  assert.equal(await page.getByRole("checkbox").count(), 0);
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Salvar", exact: true }).count(), 0);
  assert.equal(await page.getByRole("switch").count(), 0);
  await page.waitForTimeout(650);
  await page.screenshot({ animations: "disabled", path: path + "06-visao-atendente.png" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      ok: true,
      locale: "pt-BR",
      screenshots: 6,
      checks: [
        "filtros e URL após reload",
        "prévia",
        "cancelar rascunho",
        "sem input AM/PM",
        "lote parcial 6/7",
        "mobile sem overflow",
        "atendente sem edição",
        "zero erros de browser",
      ],
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
