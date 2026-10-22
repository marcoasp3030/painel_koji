const { chromium } = require("/tmp/browser/node_modules/playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1540, height: 1120 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("dialog", (d) => d.accept());
  const base = "http://127.0.0.1:18173",
    dir = "/app/docs/prints-cat3-enc1/";
  const foto = async (nome) => {
    await page.waitForTimeout(650);
    await page.screenshot({
      path: dir + nome,
      animations: "disabled",
      fullPage: nome === "08-cardapio-celular.png",
    });
  };
  await page.goto(base);
  await page.getByRole("button", { name: "Arrastar categoria Entradas", exact: true }).waitFor();
  await foto("01-cardapio-categorias.png");
  // Reordenação real de componentes, via arrastar; alternativa por teclado também disponível.
  await page
    .getByRole("button", { name: "Arrastar categoria Pratos da casa", exact: true })
    .dragTo(page.locator("#cat-1 header"));
  await page.waitForFunction(() => document.querySelector('section[id^="cat-"]')?.id === "cat-2");
  await page.getByRole("button", { name: "Subir categoria Entradas", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('section[id^="cat-"]')?.id === "cat-1");
  const edamame = page
    .locator("article")
    .filter({ has: page.getByRole("button", { name: /^Edamame/ }) });
  await edamame.getByRole("button", { name: "Esgotado hoje", exact: true }).click();
  await edamame.getByRole("button", { name: "Repor", exact: true }).waitFor();
  await foto("02-item-esgotado.png");
  await edamame.getByRole("button", { name: "Repor", exact: true }).click();
  await edamame.getByRole("button", { name: /^Edamame/ }).click();
  const sheet = page.getByRole("dialog").first();
  await sheet.getByLabel("Nome", { exact: true }).waitFor();
  await sheet.getByText("Carregando dados atuais…").waitFor({ state: "detached" });
  await sheet.getByLabel("Preço (R$)", { exact: true }).fill("36,50");
  await sheet.getByRole("button", { name: "Salvar", exact: true }).click();
  const scope = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Onde aplicar a alteração?" }) });
  await scope.getByLabel("Em todas as unidades com este prato").check();
  await foto("03-item-aplicar-todas.png");
  await scope.getByRole("button", { name: "Confirmar e salvar" }).click();
  await sheet.waitFor({ state: "detached" });
  await page.getByRole("checkbox", { name: "Selecionar todos de Entradas", exact: true }).check();
  await page.getByRole("button", { name: "Ações em lote", exact: true }).click();
  const lote = page.getByRole("dialog");
  await lote.getByLabel("Valor do reajuste").fill("10");
  await lote.getByRole("button", { name: "Simular alterações" }).click();
  await lote.getByText("Prévia do gateway · nada alterado ainda").waitFor();
  await foto("04-lote-previa.png");
  assert.match(await lote.innerText(), /Item sem preço/);
  await lote.getByLabel("Valor do reajuste").fill("15");
  assert.equal(await lote.getByRole("button", { name: "Confirmar e aplicar" }).count(), 0);
  await lote.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Pratos iguais nas unidades", exact: true }).click();
  await page
    .getByText("Preços diferentes entre unidades. Ligar os itens não altera os preços.")
    .waitFor();
  await foto("05-sugestoes-pratos.png");
  await page.getByRole("checkbox", { name: "Selecionar Edamame", exact: true }).check();
  await page.getByRole("button", { name: "Ignorar", exact: true }).click();
  await page.getByText("Nenhuma sugestão pendente.").waitFor();
  await page.getByLabel("Mostrar ignorados").check();
  await page.getByRole("checkbox", { name: "Selecionar Edamame", exact: true }).check();
  await page.getByRole("button", { name: "Restaurar ignorados" }).click();
  await page.goto(base + "?tela=conversa");
  await page.getByText("Histórico de atendimentos", { exact: true }).click();
  await page.getByText("Pedido #481 recebido e confirmado pela unidade.").waitFor();
  await page.getByRole("combobox", { name: "Mensagens do atendimento" }).selectOption("at_b");
  await foto("06-conversa-atendimentos.png");
  assert.match(await page.locator("main").innerText(), /Sim, a unidade confirmou/);
  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).click();
  await page.getByRole("button", { name: "Reabrir último atendimento", exact: true }).waitFor();
  await page.getByRole("button", { name: "Reabrir último atendimento", exact: true }).click();
  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).waitFor();
  await page.goto(base + "?papel=membro");
  await page.getByRole("button", { name: "Esgotado hoje", exact: true }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Novo item", exact: true }).count(), 0);
  assert.equal(await page.getByRole("checkbox").count(), 0);
  assert.equal(await page.getByRole("button", { name: /Editar preço/ }).count(), 0);
  await foto("07-visao-atendente.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole("button", { name: "Arrastar categoria Entradas" }).waitFor();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "sem transbordamento no celular",
  );
  await foto("08-cardapio-celular.png");
  await page.getByRole("button", { name: /^Edamame/ }).click();
  await page.getByRole("dialog").getByLabel("Nome", { exact: true }).waitFor();
  await page.getByText("Carregando dados atuais…").waitFor({ state: "detached" });
  await page.getByRole("dialog").getByLabel("Nome", { exact: true }).fill("Edamame especial");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.deepEqual(erros, []);
  console.log(
    "CAT3/ENC1: 8 prints pt-BR, arrastar/teclado, esgotar/repor, alcance, lote/invalidar prévia, ignorar/restaurar, histórico e encerrar/reabrir, membro e celular aprovados; zero erros JS.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
