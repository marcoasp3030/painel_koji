import { describe, expect, test } from "bun:test";
import { filtrarMenu, ADMIN_NAV, TENANT_NAV } from "./nav";
import {
  TEXTO_AJUDA_META,
  avisoSituacaoMeta,
  formatarNumeroMeta,
  gerarTokenVerificacaoMeta,
  marcaStatusProvedor,
  mensagemErroMeta,
  rotuloQualidadeMeta,
  textoConectadoMeta,
  textoStatusCredenciaisMeta,
} from "./meta";

describe("meta (META1-a)", () => {
  test("menu: plataforma vê Integrações → WhatsApp oficial; gestor não", () => {
    expect(filtrarMenu(ADMIN_NAV, "plataforma").some((i) => i.to === "/ia/meta")).toBe(true);
    expect(filtrarMenu(TENANT_NAV, "gestor").some((i) => i.to === "/ia/meta")).toBe(false);
    expect(filtrarMenu(TENANT_NAV, "supervisor").some((i) => i.to === "/ia/meta")).toBe(false);
  });

  test("token de verificação: 32 caracteres aleatórios no alfabeto seguro", () => {
    const t = gerarTokenVerificacaoMeta(32);
    expect(t).toHaveLength(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(gerarTokenVerificacaoMeta(32)).not.toBe(t);
  });

  test("status das credenciais: Configurado/Não configurado sem segredo", () => {
    expect(
      textoStatusCredenciaisMeta({
        configurado: false,
        app_id: null,
        nome_do_app: null,
        webhook_url: "https://x/webhooks/meta",
        atualizado_por: null,
        atualizado_em: null,
      }),
    ).toBe("Não configurado");
    expect(
      textoStatusCredenciaisMeta({
        configurado: true,
        app_id: "1234567890",
        nome_do_app: "Luxbrain WA",
        webhook_url: "https://x/webhooks/meta",
        atualizado_por: "admin@luxbrain.local",
        atualizado_em: "2026-11-14T12:00:00-03:00",
      }),
    ).toMatch(/^Configurado — Luxbrain WA \(1234567890\)/);
  });

  test("conectado: número formatado + nome + qualidade", () => {
    expect(
      textoConectadoMeta({
        numero: "5511999999999",
        nome_verificado: "By Koji",
        qualidade: "GREEN",
      }),
    ).toBe("Conectado: +55 11 99999-9999 — By Koji — qualidade alta");
    expect(formatarNumeroMeta("5511999999999")).toBe("+55 11 99999-9999");
    expect(rotuloQualidadeMeta("YELLOW")).toBe("qualidade média");
  });

  test("avisos de situação e app não configurado", () => {
    expect(avisoSituacaoMeta("conectado")).toBeNull();
    expect(avisoSituacaoMeta("token_invalido")).toBe("token inválido");
    expect(avisoSituacaoMeta("credenciais_ausentes")).toBe("credenciais ausentes");
    expect(avisoSituacaoMeta("meta_indisponivel")).toBe("Meta indisponível");
  });

  test("erros: formato, credenciais_recusadas, meta_indisponivel, papel_sem_credencial, 409", () => {
    expect(
      mensagemErroMeta({
        status: 403,
        detalhes: { motivo: "papel_sem_credencial" },
      }),
    ).toMatch(/chave de plataforma/);
    expect(
      mensagemErroMeta({
        status: 400,
        detalhes: { motivo: "credenciais_recusadas" },
      }),
    ).toBe("A Meta recusou estas credenciais. Nada foi gravado.");
    expect(
      mensagemErroMeta({
        status: 502,
        detalhes: { motivo: "meta_indisponivel" },
      }),
    ).toMatch(/não respondeu/i);
    expect(
      mensagemErroMeta({
        status: 400,
        detalhes: { motivo: "formato", campo: "app_id" },
      }),
    ).toMatch(/ID do app/);
    expect(
      mensagemErroMeta({
        status: 400,
        detalhes: { motivo: "formato", campo: "credenciais.token" },
      }),
    ).toMatch(/ID do número/);
    expect(
      mensagemErroMeta({
        status: 409,
        detalhes: { campo: "credenciais.phone_number_id" },
      }),
    ).toBe("Este número já está ligado a outro canal.");
  });

  test("status_provedor: enviada ✓, entregue ✓✓, lida ✓✓ azul, falhou ⚠", () => {
    expect(marcaStatusProvedor(null)).toBeNull();
    expect(marcaStatusProvedor("enviada")).toEqual({ texto: "✓", tom: "neutro" });
    expect(marcaStatusProvedor("entregue")).toEqual({ texto: "✓✓", tom: "ok" });
    expect(marcaStatusProvedor("lida")).toEqual({ texto: "✓✓", tom: "lida" });
    expect(marcaStatusProvedor("falhou")).toEqual({ texto: "⚠", tom: "falhou" });
  });

  test("texto de ajuda aponta webhook e campo messages", () => {
    expect(TEXTO_AJUDA_META).toMatch(/Webhook/);
    expect(TEXTO_AJUDA_META).toMatch(/messages/);
  });
});
