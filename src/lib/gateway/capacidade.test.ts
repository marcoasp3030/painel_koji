import { expect, test } from "bun:test";
import { capacidade } from "./capacidade.server";
import { problemaCapacidade } from "./capacidade";
import { criarModuloGateway } from "./modulo.server";
import { criarClienteGateway } from "./cliente.server";
async function montar(papel: string, respostas: Response[] = []) {
  const chamadas: { caminho: string; metodo: string | undefined; corpo: unknown }[] = [];
  const modulo = criarModuloGateway({
    carregarPerfil: async () => ({
      userId: "u",
      email: null,
      superAdmin: papel === "plataforma",
      vinculos: [{ gatewayTenantId: "bykoji", ativo: true, admin: papel === "gestor" }],
    }),
    cliente: criarClienteGateway({
      url: "http://gateway:8000/admin/v1",
      chave: "sintetica-para-testes-123456789",
      chavePlataforma: "sintetica-para-testes-123456789",
      fetch: (async (url: URL, init: RequestInit) => {
        chamadas.push({
          caminho: url.pathname,
          metodo: init.method,
          corpo: init.body ? JSON.parse(String(init.body)) : null,
        });
        return respostas.shift() ?? Response.json({});
      }) as typeof fetch,
    }),
  });
  return { sessao: await modulo.sessao({ userId: "u", email: null }), chamadas };
}
test("capacidade só plataforma: leituras, gravações e outro tenant recusados antes da rede", async () => {
  for (const papel of ["gestor", "funcionario"])
    for (const empresa of ["bykoji", "outro"])
      for (const agente of [undefined, "ag_1"]) {
        const c = await montar(papel);
        await expect(capacidade(c.sessao, empresa, agente)).rejects.toThrow();
        await expect(capacidade(c.sessao, empresa, agente, { valor: 30 })).rejects.toThrow();
        expect(c.chamadas).toHaveLength(0);
      }
});
test("PUT da empresa e PATCH do agente preservam null e só enviam o campo escolhido; efetivo vem do GET", async () => {
  for (const agente of [undefined, "ag_1"])
    for (const valor of [1, 100, null]) {
      const campo = agente ? "max_concorrencia" : "max_lotes_simultaneos";
      const c = await montar("plataforma", [
        Response.json({}),
        Response.json({ [campo]: valor, configuracao_efetiva: { max_concorrencia: 17 } }),
      ]);
      const r = await capacidade(c.sessao, "bykoji", agente, { valor });
      expect(c.chamadas[0]).toEqual({
        caminho: `/admin/v1/tenants/bykoji/${agente ? "agentes/ag_1" : "config"}`,
        metodo: agente ? "PATCH" : "PUT",
        corpo: { [campo]: valor },
      });
      expect(r).toEqual({ ok: true, valor, efetivo: agente ? 17 : (valor ?? 5) });
    }
});
test("limites inválidos não gravam; erro do gateway fica no campo sem detalhes extras", async () => {
  for (const valor of [0, 101, 1.5, "5", undefined]) {
    expect(problemaCapacidade(valor)).not.toBeNull();
    const c = await montar("plataforma");
    expect((await capacidade(c.sessao, "bykoji", undefined, { valor })).ok).toBe(false);
    expect(c.chamadas).toHaveLength(0);
  }
  for (const agente of [undefined, "ag_1"]) {
    const campo = agente ? "max_concorrencia" : "max_lotes_simultaneos";
    const c = await montar("plataforma", [
      Response.json(
        {
          erro: {
            codigo: "VALIDATION_ERROR",
            mensagem: "Confira este limite.",
            detalhes: { campo, interno: "oculto" },
          },
        },
        { status: 400 },
      ),
    ]);
    expect(await capacidade(c.sessao, "bykoji", agente, { valor: 30 })).toEqual({
      ok: false,
      erro: { campo, mensagem: "Confira este limite." },
    });
  }
});
