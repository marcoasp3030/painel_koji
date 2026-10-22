// Prints e verificações do CAT2 sobre o gateway em memória (gateway-falso.ts).
const { chromium } = require("/tmp/browser/node_modules/playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  const base = "http://127.0.0.1:18173";
  const pasta = "/app/docs/prints-cardapio/";
  const foto = async (nome, { avisos = false } = {}) => {
    if (!avisos)
      await page.waitForFunction(() => !document.querySelector("[data-sonner-toast]"), null, {
        timeout: 15000,
      });
    await page.waitForTimeout(500);
    await page.screenshot({ animations: "disabled", path: pasta + nome });
  };
  const painel = () => page.getByRole("dialog");
  const abrir = async (nome) => {
    await page.getByRole("button", { name: `Abrir ${nome}`, exact: true }).click();
    await painel().waitFor();
    await painel().getByText("Carregando dados atuais…").waitFor({ state: "detached" });
  };

  await page.goto(base);
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).waitFor();
  const lista = await page.locator("main").innerText();
  assert.doesNotMatch(lista, /a confirmar/i);
  assert.match(lista, /Agora: indisponível · fora do horário/);
  assert.match(lista, /Agora: indisponível · inativo/);
  assert.match(lista, /Agora: indisponível · fora do dia/);
  assert.match(await page.locator("body").innerText(), /calculada pelo gateway em 13\/10 às 20:36/);

  // 1. Painel lateral: preço e categoria (último item de "Petiscos").
  await abrir("Edamame");
  await painel().getByPlaceholder("Sem preço").fill("36,50");
  await painel().getByLabel("Categoria").selectOption("Entradas");
  const texto1 = await painel().innerText();
  assert.match(texto1, /A categoria Petiscos vai deixar de existir\./);
  assert.match(texto1, /R\$\s36,50/);
  assert.match(texto1, /\d+\/120/);
  assert.match(texto1, /\d+\/300/);
  await foto("cat2-01-painel-preco-categoria.png");
  await painel().getByRole("button", { name: "Salvar", exact: true }).click();
  const confirma = page.getByRole("alertdialog");
  await confirma.getByText("A categoria Petiscos vai deixar de existir.").waitFor();
  await confirma.getByRole("button", { name: "Voltar", exact: true }).click();
  await confirma.waitFor({ state: "hidden" });
  assert.match(await painel().innerText(), /A categoria Petiscos vai deixar de existir/);
  await painel().getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Salvar mesmo assim" }).click();
  await painel().waitFor({ state: "detached" });
  assert.match(
    await page.getByRole("button", { name: "Editar preço de Edamame" }).innerText(),
    /36,50/,
  );
  assert.equal(await page.getByRole("region", { name: "Petiscos" }).count(), 0);

  // Aviso de preço vazio no painel, sem salvar.
  await abrir("Sashimi de salmão");
  await painel().getByPlaceholder("Sem preço").fill("");
  assert.match(await painel().innerText(), /Sem preço, o item sai do cardápio do atendimento\./);
  page.once("dialog", (d) => void d.accept());
  await painel().getByRole("button", { name: "Cancelar", exact: true }).click();
  await painel().waitFor({ state: "detached" });

  // 2. Edição rápida na lista: unidade sem preços.
  await page.getByRole("button", { name: /^Pinheiros/ }).click();
  await page.getByRole("button", { name: "Sem preço", exact: true }).click();
  const semPreco = await page.getByRole("button", { name: /^Abrir / }).count();
  await page.getByRole("button", { name: "Editar preço de Tempurá de legumes" }).click();
  await page.getByLabel("Preço de Tempurá de legumes").fill("38");
  await page.keyboard.press("Enter");
  await page.getByText(/Preço de Tempurá de legumes salvo: R\$\s38,00\./).waitFor();
  assert.equal(await page.getByRole("button", { name: /^Abrir / }).count(), semPreco - 1);
  await page.getByRole("button", { name: "Editar preço de Sunomono" }).click();
  await page.getByLabel("Preço de Sunomono").fill("5");
  await page.keyboard.press("Escape");
  assert.match(
    await page.getByRole("button", { name: "Editar preço de Sunomono" }).innerText(),
    /Sem preço/,
  );
  await page.getByRole("button", { name: "Editar preço de Executivo de frango" }).click();
  await page.getByLabel("Preço de Executivo de frango").fill("49,90");
  await foto("cat2-02-preco-rapido-lista.png", { avisos: true });
  await page.keyboard.press("Enter");
  await page.getByText(/Preço de Executivo de frango salvo: R\$\s49,90\./).waitFor();

  // 3. Conflito 409 e "Reaplicar minha alteração".
  await page.getByRole("button", { name: /^Jardins/ }).click();
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await abrir("Guioza de porco");
  await painel().getByPlaceholder("Sem preço").fill("36");
  await painel().getByRole("button", { name: "Salvar", exact: true }).click();
  await painel().getByText("Este item foi alterado por outra pessoa").waitFor();
  const conflito = await painel().innerText();
  assert.match(conflito, /R\$\s34,00/);
  assert.match(conflito, /Sua alteração: R\$\s36,00/);
  assert.match(conflito, /Oito unidades/);
  await foto("cat2-03-conflito-409.png");
  await painel().getByRole("button", { name: "Reaplicar minha alteração" }).click();
  await painel().waitFor({ state: "detached" });
  assert.match(
    await page.getByRole("button", { name: "Editar preço de Guioza de porco" }).innerText(),
    /36,00/,
  );

  // 4. Prévia ao vivo do rascunho.
  await abrir("Executivo de salmão");
  const previa = painel().getByText("Prévia ao vivo").locator("..");
  await previa.getByText("Agora: indisponível · fora do horário").waitFor();
  await painel().getByLabel("Fim da faixa 1").fill("21:00");
  await previa.getByText("Agora: disponível", { exact: true }).waitFor();
  assert.match(await previa.innerText(), /segunda a sexta, 11h30–21h, exceto feriados/);
  await previa.scrollIntoViewIfNeeded();
  await painel().getByText("Faixas de horário · 24 horas").scrollIntoViewIfNeeded();
  await foto("cat2-04-previa-ao-vivo.png");

  // 5. Histórico do item.
  const historico = painel().getByRole("region", { name: "Histórico" });
  await historico.getByText("marina@restaurantejardim.com.br").waitFor();
  const h = await historico.innerText();
  assert.match(h, /12\/10\/2026.*18:18/);
  assert.match(h, /R\$\s64,90/);
  assert.match(h, /Sempre disponível/);
  await historico.evaluate((e) => e.scrollIntoView({ block: "end" }));
  await foto("cat2-05-historico.png");
  page.once("dialog", (d) => void d.accept());
  await painel().getByRole("button", { name: "Cancelar", exact: true }).click();
  await painel().waitFor({ state: "detached" });
  assert.equal(await page.locator("input[type=time]").count(), 0);

  // 6. Visão do atendente: tudo só leitura.
  await page.goto(base + "?papel=membro");
  await page.getByRole("button", { name: "Abrir Executivo de salmão", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /^Editar preço/ }).count(), 0);
  assert.equal(await page.getByRole("checkbox").count(), 0);
  await foto("cat2-06-atendente-lista.png");
  await abrir("Executivo de salmão");
  assert.equal(await painel().getByRole("button", { name: "Salvar" }).count(), 0);
  assert.equal(await painel().getByRole("switch").count(), 0);
  assert.equal(await painel().locator("input, textarea, select").count(), 0);
  assert.equal(await painel().getByRole("region", { name: "Histórico" }).count(), 0);
  assert.match(await painel().innerText(), /Agora: indisponível · fora do horário/);
  await foto("cat2-07-atendente-item.png");

  assert.deepEqual(erros, []);
  console.log(JSON.stringify({ ok: true, prints: 7, erros_js: erros.length }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
