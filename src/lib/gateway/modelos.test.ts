import { expect, test } from "bun:test";
import {
  agruparVersoes,
  camposAlterados,
  filtrarModelos,
  formDoModelo,
  idDeRotulo,
  problemaDoModelo,
} from "./modelos";
import type { ModeloAgenteCompleto } from "./tipos";

const modelo = (d: Partial<ModeloAgenteCompleto>) =>
  ({
    id: "delivery",
    versao: 1,
    nome: "Delivery",
    tipo: "atendimento",
    segmento: "delivery",
    ativo: true,
    skyone_ref: null,
    modulos_permitidos: ["catalogo", "pedidos"],
    modulos_padrao: ["catalogo"],
    motivos_transferencia: [{ id: "pagamento", rotulo: "Pagamento" }],
    tipos_solicitacao: [],
    ...d,
  }) as ModeloAgenteCompleto;

test("a situação do modelo é a da versão mais recente, não a de uma antiga", () => {
  const grupos = agruparVersoes([
    modelo({ versao: 1, ativo: true }),
    modelo({ versao: 2, ativo: false, nome: "Delivery novo" }),
    modelo({ id: "abc", nome: "Abc" }),
  ]);
  expect(grupos.map((g) => g.id)).toEqual(["abc", "delivery"]);
  expect(grupos[1]!.versoes.map((v) => v.versao)).toEqual([2, 1]);
  expect(filtrarModelos(grupos, { situacao: "ativos" }).map((g) => g.id)).toEqual(["abc"]);
  expect(filtrarModelos(grupos, { situacao: "inativos" }).map((g) => g.id)).toEqual(["delivery"]);
  expect(filtrarModelos(grupos, { busca: "NOVO" }).map((g) => g.id)).toEqual(["delivery"]);
});

test("id de item novo vem do rótulo, sem repetir", () => {
  expect(idDeRotulo("Restrição alimentar: glúten", [])).toBe("restricao_alimentar_gluten");
  expect(idDeRotulo("Pagamento", ["pagamento"])).toBe("pagamento_2");
  expect(idDeRotulo("Pagamento", ["pagamento", "pagamento_2"])).toBe("pagamento_3");
  expect(idDeRotulo("?", [])).toBe("item");
  expect(idDeRotulo("x", [])).toBe("x_item");
  expect(idDeRotulo("a".repeat(60), []).length).toBeLessThanOrEqual(40);
});

test("salvar envia só o que mudou", () => {
  const base = formDoModelo(modelo({}));
  expect(camposAlterados(base, { ...base })).toEqual({});
  expect(camposAlterados(base, { ...base, modulos_permitidos: ["pedidos", "catalogo"] })).toEqual(
    {},
  );
  expect(camposAlterados(base, { ...base, skyone_ref: "  " })).toEqual({});
  expect(camposAlterados(base, { ...base, nome: " Novo " })).toEqual({ nome: "Novo" });
  const motivos = [{ id: "pagamento", rotulo: "Pagamento: Pix" }];
  expect(camposAlterados(base, { ...base, motivos_transferencia: motivos })).toEqual({
    motivos_transferencia: motivos,
  });
});

test("limites do gateway barram antes de enviar", () => {
  const base = formDoModelo(modelo({}));
  expect(problemaDoModelo(base)).toBeNull();
  expect(problemaDoModelo({ ...base, nome: " " })).toContain("nome");
  expect(problemaDoModelo({ ...base, segmento: "Com Espaço" })).toContain("Segmento");
  expect(problemaDoModelo({ ...base, tipos_solicitacao: [{ id: "ab", rotulo: "x" }] })).toContain(
    "rótulo",
  );
});
