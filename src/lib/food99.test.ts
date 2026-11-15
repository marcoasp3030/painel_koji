import { describe, expect, test } from "bun:test";
import { filtrarMenu, ADMIN_NAV, TENANT_NAV } from "./nav";
import {
  TEXTO_AJUDA_FOOD99,
  TEXTO_PLATAFORMA_NAO_CONFIGUROU,
  confirmacaoDesconectarFood99Confere,
  mensagemErroFood99,
  nomeParaConfirmacaoDesconectar,
  podeGerirLojasFood99,
  podeVerCredenciaisFood99,
  rotuloSituacaoFood99,
  textoStatusCredenciaisFood99,
} from "./food99";
import { autorizar, AcessoNegado } from "./gateway/modulo.server";

describe("99food (99FOOD1-a)", () => {
  test("menu: plataforma vê /ia/99food; gestor vê Loja → 99Food; gestor não vê tela de credenciais", () => {
    expect(filtrarMenu(ADMIN_NAV, "plataforma").some((i) => i.to === "/ia/99food")).toBe(true);
    expect(filtrarMenu(TENANT_NAV, "gestor").some((i) => i.to === "/ia/99food")).toBe(false);
    expect(filtrarMenu(TENANT_NAV, "gestor").some((i) => i.to === "/ia/configuracoes/99food")).toBe(
      true,
    );
    expect(
      filtrarMenu(TENANT_NAV, "supervisor").some((i) => i.to === "/ia/configuracoes/99food"),
    ).toBe(false);
    expect(podeVerCredenciaisFood99("plataforma")).toBe(true);
    expect(podeVerCredenciaisFood99("gestor")).toBe(false);
    expect(podeGerirLojasFood99("gestor")).toBe(true);
    expect(podeGerirLojasFood99("supervisor")).toBe(false);
  });

  test("status das credenciais: Configurado/Não configurado sem Secret", () => {
    expect(
      textoStatusCredenciaisFood99({
        configurado: false,
        app_id_final: null,
        webhook_url: "https://x/webhooks/99food",
        atualizado_por: null,
        atualizado_em: null,
      }),
    ).toBe("Não configurado");
    expect(
      textoStatusCredenciaisFood99({
        configurado: true,
        app_id_final: "7890",
        webhook_url: "https://x/webhooks/99food",
        atualizado_por: "admin@luxbrain.local",
        atualizado_em: "2026-11-15T12:00:00-03:00",
      }),
    ).toMatch(/^Configurado \(App ID …7890\)/);
    expect(TEXTO_AJUDA_FOOD99).toMatch(/Callback Address/);
  });

  test("situações e confirmação de desconectar: nome da loja ou código da unidade", () => {
    expect(rotuloSituacaoFood99("aguardando_autorizacao")).toBe("Aguardando autorização");
    expect(rotuloSituacaoFood99("conectada")).toBe("Conectada");
    expect(rotuloSituacaoFood99("sem_permissao")).toBe("Sem permissão");
    const comNome = { nome: "Loja Teste 99", unidade: "morumbi" };
    expect(confirmacaoDesconectarFood99Confere("Loja Teste 99", comNome)).toBe(true);
    expect(confirmacaoDesconectarFood99Confere("morumbi", comNome)).toBe(true);
    expect(confirmacaoDesconectarFood99Confere("outra", comNome)).toBe(false);
    expect(nomeParaConfirmacaoDesconectar({ nome: null, unidade: "consolacao" })).toBe(
      "consolacao",
    );
  });

  test("erros: formato, credenciais_recusadas, indisponivel, papel_sem_credencial, nao_desvinculou", () => {
    expect(
      mensagemErroFood99({
        status: 403,
        detalhes: { motivo: "papel_sem_credencial" },
      }),
    ).toMatch(/chave de plataforma/);
    expect(
      mensagemErroFood99({
        status: 400,
        detalhes: { motivo: "credenciais_recusadas", campo: "app_id" },
      }),
    ).toMatch(/App ID/);
    expect(
      mensagemErroFood99({
        status: 400,
        detalhes: { motivo: "formato", campo: "app_secret" },
      }),
    ).toMatch(/Secret/);
    expect(
      mensagemErroFood99({
        status: 502,
        detalhes: { motivo: "indisponivel" },
      }),
    ).toMatch(/não respondeu/i);
    expect(
      mensagemErroFood99({
        status: 502,
        detalhes: { motivo: "nao_desvinculou" },
        mensagem: "A 99Food não desvinculou a loja.",
      }),
    ).toMatch(/desvinculou|gateway/);
    expect(
      mensagemErroFood99({
        status: 503,
        detalhes: { motivo: "nao_configurado" },
      }),
    ).toBe(TEXTO_PLATAFORMA_NAO_CONFIGUROU);
  });

  test("autorizar: gestor conecta e confere; supervisor não; desconectar pede confirmação no corpo", () => {
    autorizar("gestor", "GET", ["99food", "lojas"]);
    autorizar("gestor", "POST", ["99food", "lojas"], { unidade: "morumbi" });
    autorizar("gestor", "POST", ["99food", "lojas", "nn0123456789abcdef", "conferir"]);
    autorizar("gestor", "DELETE", ["99food", "lojas", "nn0123456789abcdef"], {
      confirmacao: "morumbi",
    });
    autorizar("gestor", "DELETE", ["99food", "lojas", "nn0123456789abcdef"], {
      confirmacao: "Loja",
      so_no_gateway: true,
    });
    expect(() => autorizar("supervisor", "GET", ["99food", "lojas"])).toThrow(AcessoNegado);
    expect(() =>
      autorizar("funcionario", "POST", ["99food", "lojas"], { unidade: "morumbi" }),
    ).toThrow(AcessoNegado);
    // Plataforma passa em tudo (bypass).
    autorizar("plataforma", "GET", ["99food", "credenciais"]);
  });
});
