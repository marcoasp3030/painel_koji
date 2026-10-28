/** Prints das telas de comportamento, com dados fictícios. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  const base = process.env.PREVIEW_URL || "http://127.0.0.1:18175";
  const dir = "/home/twadmin/painel_koji/docs/prints-comportamento/";
  fs.mkdirSync(dir, { recursive: true });
  const foto = async (nome) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: dir + nome, animations: "disabled" });
  };
  const abrir = async (caminho, texto) => {
    await page.goto(base + caminho, { waitUntil: "networkidle" });
    await page.getByText(texto, { exact: false }).first().waitFor();
  };
  const ausente = async (texto) => {
    assert.equal(await page.getByText(texto, { exact: false }).count(), 0, texto);
  };

  await abrir("/?papel=admin", "Há alterações não publicadas desde 20/10");
  await page.getByRole("button", { name: "Ver diferenças" }).waitFor();
  await page.getByRole("button", { name: "Publicar" }).waitFor();
  await ausente("Texto do aviso de demora");
  await ausente("Espera por áudio e imagem");
  await ausente("Aceita pedido agendado");
  await ausente("Domínios do Skyone");
  await ausente("Modo piloto");
  await foto("01-faixa-rascunho-admin.png");

  await page.getByRole("tab", { name: "Comportamentos" }).click();
  await page.getByText("Espera por mais mensagens (s)").waitFor();
  await ausente("Texto do aviso de demora");
  await ausente("Espera por áudio e imagem");
  await ausente("Aceita pedido agendado");
  await ausente("Domínios do Skyone");
  const botoesEmpresa = page.getByRole("switch", { name: "Botões e listas" });
  assert.equal(await botoesEmpresa.isDisabled(), false);
  await foto("02-comportamentos-empresa.png");

  await page.locator("select").first().selectOption("ag_exemplo");
  await page.getByRole("tab", { name: "Comportamentos" }).click();
  await page.getByText("Disponível só em canal WhatsApp").first().waitFor();
  const botoesAgente = page.getByRole("switch", { name: "Botões e listas" });
  await botoesAgente.scrollIntoViewIfNeeded();
  assert.equal(await botoesAgente.isDisabled(), true);
  const reacoes = page.getByRole("switch", { name: "Reações" });
  assert.equal(await reacoes.isDisabled(), true);
  await foto("03-whatsapp-desligado.png");

  await page.getByRole("button", { name: "Ver diferenças" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("O que o agente recebe hoje").waitFor();
  await dialog.getByText("equilibrado").waitFor();
  await dialog.getByText("Espera por mais mensagens (s)").waitFor();
  await foto("04-ver-diferencas.png");

  await abrir("/?papel=membro", "Há alterações não publicadas desde 20/10");
  await page.getByRole("button", { name: "Ver diferenças" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Publicar" }).count(), 0);
  await page.getByText("Somente leitura").waitFor();
  await foto("05-faixa-membro.png");

  await abrir("/?papel=plataforma&aba=comp", "Há alterações não publicadas desde 20/10");
  await page.getByRole("tab", { name: "Comportamentos" }).click();
  await page.getByText("Domínios do Skyone").scrollIntoViewIfNeeded();
  await page.getByText("Só leitura.").waitFor();
  await foto("06-operacao-plataforma.png");

  await abrir("/?tela=ficha&papel=admin", "Abrir Comportamento do agente");
  await ausente("Responder só a alguns contatos");
  await ausente("Espera por mais mensagens");
  await ausente("Mensagem de falha");
  await ausente("Texto do aviso de demora");
  await foto("07-ficha-admin.png");

  await abrir("/?tela=ficha&papel=plataforma", "Responder só a alguns contatos");
  await page.getByText("Telefone para alertas").waitFor();
  await page.getByText("Contatos do piloto").waitFor();
  await ausente("Espera por mais mensagens");
  await ausente("Mensagem de falha");
  await foto("08-ficha-plataforma.png");

  await abrir("/?tela=visao&papel=admin", "Prontidão");
  await ausente("Conexão com o Skyone");
  await ausente("Envio aos clientes");
  await ausente("Respostas");
  await page.getByText("Modelo").waitFor();
  await foto("09-visao-admin.png");

  await abrir("/?tela=visao&papel=plataforma", "Conexão com o Skyone");
  await page.getByText("Envio aos clientes").waitFor();
  await page.getByText("Respostas").waitFor();
  await foto("10-visao-plataforma.png");

  await abrir("/?papel=admin&whatsapp=1", "Há alterações não publicadas desde 20/10");
  await page.locator("select").first().selectOption("ag_exemplo");
  await page.getByRole("tab", { name: "Comportamentos" }).click();
  const comCanal = page.getByRole("switch", { name: "Botões e listas" });
  await comCanal.scrollIntoViewIfNeeded();
  assert.equal(await comCanal.isDisabled(), false);
  assert.equal(await page.getByText("Disponível só em canal WhatsApp").count(), 0);
  await foto("11-whatsapp-ligado.png");

  assert.equal(erros.length, 0, erros.join("\n"));
  await browser.close();
  console.log("prints ok");
})().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
