import { describe, expect, test } from "bun:test";
import { filtrarMenu, ADMIN_NAV, TENANT_NAV } from "./nav";
import {
  confirmacaoDesligarIfoodConfere,
  mensagemErroIfood,
  nomeParaConfirmacaoDesligar,
  podeGerirLojasIfood,
  podeVerLojasIfoodEmpresa,
  rotuloSituacaoIfood,
  textoLigadaA,
  TEXTO_SEM_LOJA_EMPRESA,
} from "./ifood-lojas";

describe("ifood-lojas", () => {
  test("só plataforma liga/desliga; gestor vê e confere; supervisor/funcionário não", () => {
    expect(podeGerirLojasIfood("plataforma")).toBe(true);
    expect(podeGerirLojasIfood("gestor")).toBe(false);
    expect(podeVerLojasIfoodEmpresa("gestor")).toBe(true);
    expect(podeVerLojasIfoodEmpresa("plataforma")).toBe(true);
    expect(podeVerLojasIfoodEmpresa("supervisor")).toBe(false);
    expect(podeVerLojasIfoodEmpresa("funcionario")).toBe(false);
  });

  test("menu: plataforma vê Integrações → iFood; gestor vê Configurações → iFood; supervisor não", () => {
    expect(filtrarMenu(ADMIN_NAV, "plataforma").some((i) => i.to === "/ia/ifood")).toBe(true);
    expect(filtrarMenu(TENANT_NAV, "gestor").some((i) => i.to === "/ia/configuracoes/ifood")).toBe(
      true,
    );
    expect(filtrarMenu(TENANT_NAV, "supervisor").some((i) => i.to === "/ia/configuracoes/ifood")).toBe(
      false,
    );
    expect(filtrarMenu(TENANT_NAV, "funcionario").some((i) => i.to === "/ia/configuracoes/ifood")).toBe(
      false,
    );
  });

  test("ligada a: livre ou empresa/unidade", () => {
    expect(textoLigadaA(null, "By Koji")).toBe("livre");
    expect(
      textoLigadaA({ tenant_id: "bykoji", unidade: "patio_guedala", ativo: true }, "By Koji"),
    ).toBe("By Koji · patio_guedala");
    expect(textoLigadaA({ tenant_id: "bykoji", unidade: null, ativo: true }, null)).toBe("bykoji");
  });

  test("desligar: confirmação pelo nome ou merchant_id", () => {
    const comNome = { nome: "Loja Teste A", merchant_id: "loja-a-1" };
    expect(confirmacaoDesligarIfoodConfere("Loja Teste A", comNome)).toBe(true);
    expect(confirmacaoDesligarIfoodConfere(" outra ", comNome)).toBe(false);
    expect(nomeParaConfirmacaoDesligar({ nome: null, merchant_id: "loja-a-1" })).toBe("loja-a-1");
    expect(confirmacaoDesligarIfoodConfere("loja-a-1", { nome: null, merchant_id: "loja-a-1" })).toBe(
      true,
    );
  });

  test("erros: mensagem do gateway; 503 nao_configurado tem texto fixo", () => {
    expect(
      mensagemErroIfood({
        status: 503,
        detalhes: { motivo: "nao_configurado" },
        mensagem: "A integração com o iFood ainda não foi configurada no gateway.",
      }),
    ).toBe("integração não configurada no gateway");
    expect(
      mensagemErroIfood({
        status: 502,
        detalhes: { motivo: "indisponivel" },
        mensagem: "O iFood não respondeu. Tente de novo em instantes.",
      }),
    ).toBe("O iFood não respondeu. Tente de novo em instantes.");
    expect(rotuloSituacaoIfood("sem_permissao")).toBe("Sem permissão");
    expect(TEXTO_SEM_LOJA_EMPRESA).toMatch(/Portal do Parceiro/);
  });
});
