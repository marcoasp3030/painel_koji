/** Prints das telas de entrada (antes/depois via PRINTS_PREFIX). */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const base = process.env.PREVIEW_URL || "http://127.0.0.1:18180";
  const dir = process.env.PRINTS_DIR || "/home/twadmin/painel_koji/docs/prints-entrada";
  const prefixo = process.env.PRINTS_PREFIX || "depois";
  fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const erros = [];

  async function capturar(largura, altura, sufixo) {
    const ctx = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      viewport: { width: largura, height: altura },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => erros.push(e.message));
    const foto = async (vista, nome) => {
      await page.goto(`${base}/?vista=${vista}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
      await page.screenshot({
        path: path.join(dir, `${prefixo}-${nome}-${sufixo}.png`),
        fullPage: true,
        animations: "disabled",
      });
    };
    await foto("login", "01-login");
    await foto("erro", "02-login-erro");
    await foto("mfa", "03-segundo-fator");
    await foto("convite", "04-criar-senha-convite");
    await foto("esqueci", "05-esqueci-senha");
    await foto("redefinir", "06-nova-senha");
    await ctx.close();
  }

  await capturar(1440, 900, "desktop");
  await capturar(390, 844, "celular");
  await browser.close();
  if (erros.length) {
    console.error(erros.join("\n"));
    process.exit(1);
  }
  console.log("prints ok", prefixo);
})();
