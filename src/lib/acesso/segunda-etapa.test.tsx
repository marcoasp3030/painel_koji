import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FaixaSeguranca } from "@/components/luxtia/Seguranca";
import { gerarCodigosRecuperacao, sessaoPrecisaDoCodigo } from "./codigos-recuperacao";
import {
  EMAIL_CONTA_EMERGENCIA,
  PRAZO_SEGUNDA_ETAPA_MS,
  contaEmergencia,
  decidirSegundaEtapa,
} from "./segunda-etapa";

const agora = new Date("2026-10-28T18:00:00Z");

describe("segunda etapa", () => {
  test("a conta de emergência é reconhecida pelo e-mail ou pela marca", () => {
    expect(contaEmergencia(EMAIL_CONTA_EMERGENCIA, false)).toBe(true);
    expect(contaEmergencia("Outra@Exemplo.com", true)).toBe(true);
    expect(contaEmergencia("marco.santos@ticway.com.br", false)).toBe(false);
  });

  test("emergência sem fator bloqueia na hora, sem gravar prazo", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: true,
      fatores: 0,
      prazoAte: null,
      agora,
    });
    expect(d.bloqueado).toBe(true);
    expect(d.obrigatorio).toBe(true);
    expect(d.prazo_ate).toBeNull();
    expect(d.gravarPrazo).toBeNull();
  });

  test("emergência com fator entra", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: true,
      fatores: 1,
      prazoAte: null,
      agora,
    });
    expect(d.bloqueado).toBe(false);
    expect(d.gravarPrazo).toBeNull();
  });

  test("as outras contas de plataforma ganham 7 dias", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: false,
      fatores: 0,
      prazoAte: null,
      agora,
    });
    expect(d.bloqueado).toBe(false);
    expect(new Date(d.gravarPrazo ?? 0).getTime() - agora.getTime()).toBe(PRAZO_SEGUNDA_ETAPA_MS);
  });

  test("plataforma com prazo vencido fica bloqueada", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: false,
      fatores: 0,
      prazoAte: new Date(agora.getTime() - 1000).toISOString(),
      agora,
    });
    expect(d.bloqueado).toBe(true);
    expect(d.gravarPrazo).toBeNull();
  });

  test("o aviso da plataforma continua obrigatório e ganha o atalho", () => {
    const prazo = renderToStaticMarkup(
      <FaixaSeguranca
        prazo="2026-11-04T21:14:00.000Z"
        bloqueado={false}
        onAtivar={() => undefined}
      />,
    );
    expect(prazo).toContain("Ativar agora");
    expect(prazo).toContain("04/11/2026");
    expect(prazo).toContain("Ative a segunda etapa até");
    const bloqueado = renderToStaticMarkup(
      <FaixaSeguranca prazo="2026-11-04T21:14:00.000Z" bloqueado onAtivar={() => undefined} />,
    );
    expect(bloqueado).toContain("A segunda etapa é obrigatória para a plataforma");
    expect(bloqueado).toContain("Ativar agora");
  });

  test("códigos de recuperação e a sessão que ainda precisa do código", () => {
    const codigos = gerarCodigosRecuperacao();
    expect(codigos).toHaveLength(8);
    expect(new Set(codigos).size).toBe(8);
    for (const codigo of codigos) expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(sessaoPrecisaDoCodigo({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(sessaoPrecisaDoCodigo({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(sessaoPrecisaDoCodigo(null)).toBe(false);
  });

  test("gestor não é obrigado", () => {
    const d = decidirSegundaEtapa({
      plataforma: false,
      emergencia: false,
      fatores: 0,
      prazoAte: null,
      agora,
    });
    expect(d.obrigatorio).toBe(false);
    expect(d.bloqueado).toBe(false);
  });
});
