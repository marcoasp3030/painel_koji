import { describe, expect, test } from "bun:test";
import { filtrarMenu, ADMIN_NAV, TENANT_NAV } from "./nav";
import {
  confirmacaoDesligarIfoodConfere,
  mensagemErroIfood,
  nomeParaConfirmacaoDesligar,
  podeGerirLojasIfood,
  podeTrocarCredenciaisIfood,
  podeVerLojasIfoodEmpresa,
  rotuloSituacaoIfood,
  textoLigadaA,
  textoStatusCredenciaisIfood,
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
    ).toBe("O iFood está indisponível. Tente de novo em instantes.");
    expect(rotuloSituacaoIfood("sem_permissao")).toBe("Sem permissão");
    expect(TEXTO_SEM_LOJA_EMPRESA).toMatch(/Portal do Parceiro/);
  });

  test("credenciais: só plataforma; status sem segredo; erros de gravação", () => {
    expect(podeTrocarCredenciaisIfood("plataforma")).toBe(true);
    expect(podeTrocarCredenciaisIfood("gestor")).toBe(false);
    expect(textoStatusCredenciaisIfood({ configurado: false, origem: null, client_id_final: null, atualizado_por: null, atualizado_em: null })).toBe(
      "Não configurado",
    );
    expect(
      textoStatusCredenciaisIfood({
        configurado: true,
        origem: "painel",
        client_id_final: "este",
        atualizado_por: "marco@exemplo.test",
        atualizado_em: "2026-11-06T21:00:00-03:00",
      }),
    ).toBe("Configurado (Client ID …este), trocado por marco@exemplo.test em 06/11");
    expect(
      textoStatusCredenciaisIfood({
        configurado: true,
        origem: "env",
        client_id_final: "abcd",
        atualizado_por: null,
        atualizado_em: null,
      }),
    ).toBe("Configurado (Client ID …abcd) — pelo .env do gateway");
    expect(
      mensagemErroIfood({
        status: 400,
        detalhes: { motivo: "credenciais_recusadas" },
        mensagem: "O iFood recusou este Client ID e Client Secret. Nada foi gravado.",
      }),
    ).toBe("O iFood recusou essas credenciais. Nada foi gravado.");
    expect(
      mensagemErroIfood({
        status: 403,
        detalhes: { motivo: "papel_sem_credencial" },
        mensagem: "Trocar as credenciais do iFood exige a chave de plataforma do painel.",
      }),
    ).toMatch(/chave de plataforma/);
  });
});
