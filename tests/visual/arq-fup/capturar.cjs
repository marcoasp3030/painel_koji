/** Prints das telas de documentos e follow-up, com dados fictícios. */
const { chromium } = require("/tmp/browser/node_modules/playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 1200 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  const base = "http://127.0.0.1:18174";
  const dir = "/home/twadmin/painel_koji/docs/prints-arq-fup/";
  const foto = async (nome, alvo = page) => {
    await page.waitForTimeout(400);
    await alvo.screenshot({ path: dir + nome, animations: "disabled" });
  };
  const abrir = async (caminho, texto) => {
    await page.goto(base + caminho);
    await page.getByText(texto, { exact: false }).first().waitFor();
  };

  await abrir("/?tela=escopos", "Enviar documentos");
  const callback = page.getByRole("checkbox", { name: /Resposta assíncrona/ });
  assert.equal(await callback.isDisabled(), true);
  assert.equal(await callback.isChecked(), false);
  assert.equal(await page.getByRole("checkbox", { name: /Enviar documentos/ }).isChecked(), false);
  await foto("01-escopo-documentos.png");

  await abrir("/?tela=chaves", "Site da loja");
  await foto("02-chaves-formulario.png");
  await page.getByRole("button", { name: "Nova chave" }).click();
  const form = page.getByRole("dialog");
  await form.getByText("Nova chave de formulário").waitFor();
  await foto("03-chave-criar.png", form);

  await abrir("/?tela=chaves&segredo=1", "gwf_exemplo_nao_usar_123");
  const segredo = page.getByRole("dialog");
  await foto("04-chave-uma-vez.png", segredo);

  await abrir("/?tela=documentos", "boleto-outubro.pdf");
  await page.getByPlaceholder("dd/mm/aaaa").first().waitFor();
  assert.equal(
    await page.getByText("Tipo e data filtram só os documentos já carregados nesta lista.").count(),
    0,
  );
  await foto("05-documentos-lista.png");

  await abrir("/?tela=documentos&detalhe=boleto", "Linha digitável");
  const boleto = page.getByRole("dialog");
  await boleto.getByText("R$").first().waitFor();
  await boleto.getByText("25/10/2026").first().waitFor();
  await boleto.getByText("Apagado automaticamente em 20/11/2026").waitFor();
  await boleto.getByRole("button", { name: "Copiar" }).first().waitFor();
  await boleto.getByRole("button", { name: "Apagar" }).waitFor();
  await foto("06-documento-boleto.png", boleto);
  await boleto.getByRole("button", { name: "Apagar" }).click();
  const apagar = page.getByRole("alertdialog");
  await apagar.getByRole("button", { name: "Apagar" }).waitFor();
  await foto("14-apagar-documento.png", apagar);

  await abrir("/?tela=documentos&detalhe=nfe", "Itens");
  const nfe = page.getByRole("dialog");
  await nfe.getByText("Temaki salmão").waitFor();
  await nfe.getByText("1.890,50").first().waitFor();
  await foto("11-documento-nfe.png", nfe);

  await abrir("/?tela=documentos&detalhe=pix", "Pagamento não verificado");
  const pix = page.getByRole("dialog");
  await pix.getByText("ID da transação").waitFor();
  await pix.getByText("21/10/2026 14:32").first().waitFor();
  await pix.getByRole("button", { name: "Copiar" }).waitFor();
  await foto("12-documento-pix.png", pix);

  await abrir("/?tela=webhooks", "sistema.exemplo.com.br");
  await page.getByText("Segredo anterior válido até 23/10 14:32").waitFor();
  await page.getByRole("button", { name: "Gerar novo segredo" }).click();
  const gerar = page.getByRole("alertdialog");
  await gerar.getByText("continua valendo por mais 24 horas").waitFor();
  await foto("16-gerar-segredo.png", gerar);

  await abrir("/?tela=webhooks", "sistema.exemplo.com.br");
  await page.getByRole("button", { name: "Novo webhook" }).click();
  const webhook = page.getByRole("dialog");
  await webhook.getByText("Follow-up em ensaio").waitFor();
  const ativo = webhook.getByRole("switch", { name: "Ativo" });
  assert.equal(await ativo.isChecked(), true);
  await page.addStyleTag({
    content: '[role="dialog"]{max-height:none !important; overflow:visible !important}',
  });
  await foto("08-webhook-eventos.png", webhook);

  await abrir("/?tela=webhooks&segredo=1", "Copie agora");
  const segredoWh = page.getByRole("dialog");
  await segredoWh.getByRole("button", { name: "Já copiei, fechar" }).waitFor();
  await foto("13-webhook-segredo.png", segredoWh);

  await abrir("/?tela=followup", "By Koji");
  await page.getByText("Enquanto estiver em ensaio, só o 1º é registrado.").waitFor();
  await page.getByPlaceholder("00:00").first().waitFor();
  await foto("09-followup-config.png");

  await abrir("/?tela=conversa", "não quer follow-up");
  await page.getByText("Agendado").waitFor();
  await page.getByText("Cancelado").waitFor();
  await page.getByText("Ensaio").waitFor();
  await page.getByRole("button", { name: "Cancelar este" }).waitFor();
  await foto("10-conversa-followup.png");
  await page.getByRole("button", { name: "Reativar" }).click();
  const reativar = page.getByRole("dialog");
  await reativar.getByText("Reativar só com o pedido dele.").waitFor();
  await reativar.getByLabel("Motivo").fill("Pedido do cliente por telefone");
  await foto("15-reativar-followup.png", reativar);

  assert.equal(erros.length, 0, erros.join("\n"));
  await browser.close();
  console.log("prints ok");
})().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
