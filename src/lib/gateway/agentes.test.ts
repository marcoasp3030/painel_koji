// Executar: bun test src/lib/gateway
import { describe, expect, test } from "bun:test";
import {
  AVISO_PILOTO_VAZIO,
  conferirIaReal,
  conferirPiloto,
  problemaPiloto,
  explicarConflitoAgente,
  normalizarPatchAgente,
  type EstadoAgente,
} from "./agentes";
import { GatewayErro, interpretarErro, mensagemParaUsuario } from "./erros";

const MOCK: EstadoAgente = {
  provedor: "mock",
  agente_mode: "mock",
  agente_mode_efetivo: "mock",
  skyone_webhook_url: null,
  skyone_auth_tipo: "nenhuma",
  skyone_auth_configurado: false,
  skyone_auth_usuario_configurado: false,
};
const URL_FLUXO = "https://luxtia.api.integrasky.cloud/FLUXO";

const mensagem = (f: () => unknown) => {
  try {
    f();
    return null;
  } catch (e) {
    return (e as GatewayErro).message;
  }
};

describe("campos obrigatórios", () => {
  test("vazio em campo obrigatório é recusado com o nome do campo", () => {
    expect(mensagem(() => normalizarPatchAgente({ timeout_s: null }))).toContain("Tempo limite");
    expect(mensagem(() => normalizarPatchAgente({ provedor: null }))).toContain("Provedor");
    expect(mensagem(() => normalizarPatchAgente({ skyone_auth_tipo: "" }))).toContain(
      "Autenticação",
    );
  });

  test("instruções vazias viram texto vazio, não NULL", () => {
    expect(normalizarPatchAgente({ instrucoes_agente: null })).toEqual({ instrucoes_agente: "" });
    expect(normalizarPatchAgente({ fallback: null })).toEqual({ fallback: null });
  });
});

describe("ativar IA real", () => {
  test("agente sem URL nem senha: diz exatamente o que falta", () => {
    const m = mensagem(() =>
      conferirIaReal(MOCK, { provedor: "skyone", agente_mode: "live" }, false),
    );
    expect(m).toBe(
      "Para usar a IA real, cadastre antes a URL do fluxo e o usuário e a senha do fluxo (autenticação Basic) no Skyone.",
    );
  });

  test("falta só a senha", () => {
    const m = mensagem(() =>
      conferirIaReal(
        MOCK,
        {
          provedor: "skyone",
          agente_mode: "live",
          skyone_webhook_url: URL_FLUXO,
          skyone_auth_tipo: "basic",
          skyone_auth_usuario: "flow-1@luxtia",
        },
        false,
      ),
    );
    expect(m).toBe("Para usar a IA real, cadastre antes a senha do fluxo no Skyone.");
  });

  test("com URL, usuário e senha passa", () => {
    const dados = {
      provedor: "skyone",
      agente_mode: "live",
      skyone_webhook_url: URL_FLUXO,
      skyone_auth_tipo: "basic",
      skyone_auth_usuario: "flow-1@luxtia",
      skyone_auth: "segredo",
    };
    expect(mensagem(() => conferirIaReal(MOCK, dados, false))).toBeNull();
  });

  test("credencial já salva vale; empresa de teste dispensa credencial", () => {
    const salvo = {
      ...MOCK,
      provedor: "skyone",
      skyone_webhook_url: URL_FLUXO,
      skyone_auth_tipo: "basic",
      skyone_auth_configurado: true,
      skyone_auth_usuario_configurado: true,
    };
    expect(mensagem(() => conferirIaReal(salvo, { agente_mode: "live" }, false))).toBeNull();
    const semSenha = { ...MOCK, provedor: "skyone", skyone_webhook_url: URL_FLUXO };
    expect(mensagem(() => conferirIaReal(semSenha, { agente_mode: "live" }, true))).toBeNull();
  });

  test("URL fora do formato aceito é recusada antes do gateway", () => {
    expect(
      mensagem(() => conferirIaReal(MOCK, { skyone_webhook_url: "http://x.example/f" }, false)),
    ).toContain("https://");
    expect(
      mensagem(() =>
        conferirIaReal(MOCK, { skyone_webhook_url: "https://u:p@x.example/f" }, false),
      ),
    ).toContain("usuário ou senha");
  });

  test("voltar para simulação não exige nada", () => {
    expect(
      mensagem(() =>
        conferirIaReal({ ...MOCK, agente_mode: "live" }, { agente_mode: "mock" }, false),
      ),
    ).toBeNull();
  });
});

describe("mensagens do gateway", () => {
  test("409 sem detalhes ao gravar agente vira explicação", () => {
    const erro = interpretarErro(409, {
      erro: { codigo: "CONFLICT", mensagem: "CONFLICT", detalhes: {} },
    });
    const explicado = explicarConflitoAgente(erro) as GatewayErro;
    expect(explicado.message).toContain("campo obrigatório do agente ficou vazio");
  });

  test("detalhes.campo vira orientação, nunca só a mensagem genérica", () => {
    const erro = interpretarErro(400, {
      erro: {
        codigo: "VALIDATION_ERROR",
        mensagem: "Confira os campos informados.",
        detalhes: { campo: "skyone_auth" },
      },
    });
    expect(mensagemParaUsuario(erro)).toBe(
      "Para usar a IA real, cadastre antes o usuário e a senha do fluxo no Skyone.",
    );
    const desconhecido = interpretarErro(400, {
      erro: {
        codigo: "VALIDATION_ERROR",
        mensagem: "Confira os campos informados.",
        detalhes: { campo: "plano" },
      },
    });
    expect(mensagemParaUsuario(desconhecido)).toBe("Confira os campos informados. Campo: plano.");
  });

  test("mensagem própria do painel é mantida", () => {
    const erro = new GatewayErro({
      codigo: "VALIDATION_ERROR",
      status: 400,
      mensagem: "O campo “Tempo limite” não pode ficar vazio.",
      detalhes: { campo: "timeout_s" },
    });
    expect(mensagemParaUsuario(erro)).toBe("O campo “Tempo limite” não pode ficar vazio.");
  });
});

describe("piloto com a lista vazia", () => {
  const efetiva = (extra: Record<string, unknown> = {}) => ({
    modo_piloto: false,
    contatos_permitidos: [],
    origem_config: { modo_piloto: "plataforma", contatos_permitidos: "plataforma" },
    ...extra,
  });

  test("ligar o piloto sem números é recusado", () => {
    expect(problemaPiloto(efetiva(), { modo_piloto: true })).toBe(AVISO_PILOTO_VAZIO);
    expect(mensagem(() => conferirPiloto(efetiva(), { modo_piloto: true }))).toContain(
      "Inclua pelo menos um número",
    );
  });

  test("ligar com um número passa; desligar passa", () => {
    expect(
      problemaPiloto(efetiva(), { modo_piloto: true, contatos_permitidos: ["5511999999999"] }),
    ).toBeNull();
    const ligado = efetiva({ modo_piloto: true, contatos_permitidos: ["5511999999999"] });
    expect(problemaPiloto(ligado, { modo_piloto: false, contatos_permitidos: null })).toBeNull();
  });

  test("apagar a lista com o piloto já ligado é recusado", () => {
    const ligado = efetiva({
      modo_piloto: true,
      contatos_permitidos: ["5511999999999"],
      origem_config: { modo_piloto: "agente", contatos_permitidos: "agente" },
    });
    expect(problemaPiloto(ligado, { contatos_permitidos: [] })).toBe(AVISO_PILOTO_VAZIO);
    expect(problemaPiloto(ligado, { contatos_permitidos: null })).toBe(AVISO_PILOTO_VAZIO);
  });

  test("lista herdada da empresa conta", () => {
    const daEmpresa = efetiva({
      contatos_permitidos: ["5511988887777"],
      origem_config: { modo_piloto: "plataforma", contatos_permitidos: "tenant" },
    });
    expect(problemaPiloto(daEmpresa, { modo_piloto: true })).toBeNull();
  });
});

describe("campos do gateway novo", () => {
  test("provedor, usuário do fluxo e envio real viram orientação", () => {
    for (const [campo, trecho] of [
      ["provedor", "configure antes a conexão com o Skyone"],
      ["skyone_auth_usuario", "usuário do fluxo"],
      ["send_mode", "envio aos clientes deste agente está real"],
    ] as const) {
      const erro = interpretarErro(400, {
        erro: {
          codigo: "VALIDATION_ERROR",
          mensagem: "Confira os campos informados.",
          detalhes: { campo },
        },
      });
      expect(mensagemParaUsuario(erro)).toContain(trecho);
    }
  });
});
