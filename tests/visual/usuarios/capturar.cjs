/** Prints das telas de usuários, com dados fictícios. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

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
  const base = process.env.PREVIEW_URL || "http://127.0.0.1:18176";
  const dir = process.env.PRINTS_DIR || "/home/twadmin/painel_koji/docs/prints-usuarios";
  fs.mkdirSync(dir, { recursive: true });
  const foto = async (nome) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, nome), fullPage: true, animations: "disabled" });
  };
  await page.goto(base + "/?vista=gestor", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Usuários" }).waitFor();
  await page.getByText("Ana Gestora").waitFor();
  await foto("01-gestor-lista.png");
  await page.goto(base + "/?vista=supervisor", { waitUntil: "networkidle" });
  await page.getByText("Carla Funcionária").waitFor();
  const opcoes = await page.locator("form select option").allTextContents();
  if (opcoes.join("|") !== "Funcionário") {
    throw new Error("O supervisor só pode convidar funcionário. Veio: " + opcoes.join("|"));
  }
  await foto("02-supervisor-so-funcionario.png");
  await page.goto(base + "/?vista=menu", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "funcionario" }).waitFor();
  await foto("03-menu-por-papel.png");
  await page.goto(base + "/?vista=prazo", { waitUntil: "networkidle" });
  await page.getByText("Ative a segunda etapa").waitFor();
  await foto("04-prazo-segunda-etapa.png");
  await page.goto(base + "/?vista=link", { waitUntil: "networkidle" });
  await page.getByText("Envie este link só para a pessoa convidada").waitFor();
  await page.getByRole("button", { name: "Revogar convite" }).waitFor();
  await foto("05-link-convite.png");
  await browser.close();
  if (erros.length) {
    console.error(erros.join("\n"));
    process.exit(1);
  }
  console.log("prints ok");
})();
