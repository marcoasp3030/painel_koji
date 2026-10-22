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
  await foto("05-documentos-lista.png");
  await abrir("/?tela=documentos&detalhe=1", "a conferir");
  const detalhe = page.getByRole("dialog");
  await detalhe.getByText("validado").waitFor();
  await detalhe.getByText("lido do texto").waitFor();
  await foto("06-documento-detalhe.png", detalhe);

  await abrir("/?tela=webhooks", "sistema.exemplo.com.br");
  await foto("07-webhooks-lista.png");
  await page.getByRole("button", { name: "Novo webhook" }).click();
  const webhook = page.getByRole("dialog");
  await webhook.getByText("Follow-up em ensaio").waitFor();
  await page.addStyleTag({
    content: '[role="dialog"]{max-height:none !important; overflow:visible !important}',
  });
  await foto("08-webhook-eventos.png", webhook);

  await abrir("/?tela=followup", "Máximo por dia");
  await page.getByText("Follow-up", { exact: true }).first().waitFor();
  await foto("09-followup-config.png");

  await abrir("/?tela=conversa", "não quer follow-up");
  await page.getByText("Agendado").waitFor();
  await page.getByText("Cancelado").waitFor();
  await page.getByText("Ensaio").waitFor();
  await page.getByRole("button", { name: "Reativar" }).waitFor();
  await page.getByRole("button", { name: "Cancelar", exact: true }).waitFor();
  await foto("10-conversa-followup.png");

  assert.equal(erros.length, 0, erros.join("\n"));
  await browser.close();
  console.log("prints ok");
})().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
