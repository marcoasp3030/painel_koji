// Espera autenticação e API REST antes de subir o painel.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function esperar(url) {
  for (let tentativa = 1; tentativa <= 60; tentativa += 1) {
    try {
      const resposta = await fetch(url);
      if (resposta.status < 500) return;
    } catch {
      // serviço ainda não aceita conexão
    }
    await sleep(2000);
  }
  console.error(`Tempo esgotado aguardando ${url}`);
  process.exit(1);
}

await esperar(process.env.AUTH_HEALTH_URL || "http://autenticacao:9999/health");
await esperar(process.env.REST_HEALTH_URL || "http://api-rest:3000/");
