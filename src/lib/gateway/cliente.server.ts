/**
 * Único ponto do painel que fala HTTP com a API administrativa do gateway.
 * Roda só no servidor: a chave vem do ambiente e nunca é registrada em log,
 * em mensagem de erro nem em resposta ao navegador.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { LIMITE_ARQUIVO_BYTES } from "./documentos";
import { GatewayErro, interpretarErro } from "./erros";

export type MetodoGateway = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequisicaoGateway = {
  metodo: MetodoGateway;
  /** Segmentos do caminho, cada um codificado como segmento de URL. */
  caminho: string[];
  /** Usuário logado no painel, enviado em X-Actor. */
  ator: string;
  papel: "plataforma" | "gestor" | "supervisor" | "funcionario";
  /**
   * X-Unidades montado no servidor. "*" para plataforma e gestor.
   * Códigos separados por vírgula para supervisor e funcionário.
   */
  unidades?: string;
  /**
   * Empresa da sessão (MULTI1-a). Obrigatório para quem não é plataforma.
   * Vem de resolverTenant — nunca do texto cru enviado pelo navegador.
   */
  escopoEmpresa?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  corpo?: unknown;
  /** Tempo máximo em ms; /testar do agente pode levar mais que o padrão. */
  tempoLimiteMs?: number;
  /**
   * Resposta binária (download de documento). O navegador recebe nome, tipo
   * e o arquivo em base64 — nunca vai para log.
   */
  arquivo?: boolean;
  /**
   * Envio multipart (simulador com arquivo). O corpo JSON não vai junto.
   * `base64` não entra em log.
   */
  formulario?: {
    arquivo: { nome: string; tipo: string; base64: string };
    campos: Record<string, string>;
  };
};

export type ClienteGateway = {
  requisitar<T = unknown>(req: RequisicaoGateway): Promise<{ status: number; dados: T }>;
};

type Dependencias = {
  url: string;
  /** Chave de empresa (CHAVES1). A plataforma usa esta chave só enquanto a de plataforma estiver vazia. */
  chave: string;
  /** Chave de plataforma. Quando preenchida, só ela entra no Bearer do papel plataforma. */
  chavePlataforma?: string;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  /** Esperas de 429 até este limite são feitas no servidor, uma única vez. */
  esperaMaximaS?: number;
  tempoLimitePadraoMs?: number;
  /** Aviso de chave ausente. O texto não pode incluir a chave. */
  avisar?: (mensagem: string) => void;
  /** Lembra o dia do último aviso, para não repetir no mesmo dia em Brasília. */
  avisoChave?: { ler: () => string | null; gravar: (dia: string) => void };
};

const ARQUIVO_AVISO_CHAVE = "/tmp/painel-aviso-chave-plataforma";
const AVISO_CHAVE_PLATAFORMA =
  "[gateway] GATEWAY_PLATFORM_KEY vazia; a sessão de plataforma está usando a chave da empresa.";

export function diaEmBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

const avisoChaveEmArquivo = {
  ler: () => {
    try {
      return readFileSync(ARQUIVO_AVISO_CHAVE, "utf8").trim() || null;
    } catch {
      return null;
    }
  },
  gravar: (dia: string) => {
    writeFileSync(ARQUIVO_AVISO_CHAVE, dia, { mode: 0o600 });
  },
};

const SEGMENTO_PROIBIDO = new Set(["", ".", ".."]);

function montarUrl(base: string, req: RequisicaoGateway) {
  const partes = req.caminho.map((parte) => {
    if (SEGMENTO_PROIBIDO.has(parte)) {
      throw new GatewayErro({ codigo: "VALIDATION_ERROR", status: 400 });
    }
    return encodeURIComponent(parte);
  });
  const url = new URL(`${base.replace(/\/+$/, "")}/${partes.join("/")}`);
  for (const [chave, valor] of Object.entries(req.query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, String(valor));
    }
  }
  return url;
}

/** Retry-After em segundos ou data HTTP. */
export function lerTentarApos(valor: string | null, agora = Date.now()): number | null {
  if (!valor) return null;
  const segundos = Number(valor);
  if (Number.isFinite(segundos) && segundos >= 0) return Math.ceil(segundos);
  const data = Date.parse(valor);
  if (Number.isNaN(data)) return null;
  return Math.max(0, Math.ceil((data - agora) / 1000));
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** Remove caracteres que não podem ir em cabeçalho HTTP. */
function atorSeguro(ator: string) {
  const limpo = ator
    .replace(/[^\x20-\x7e]/g, "")
    .trim()
    .slice(0, 200);
  if (!limpo) throw new GatewayErro({ codigo: "UNAUTHORIZED", status: 401 });
  return limpo;
}

function montarFormulario(formulario: NonNullable<RequisicaoGateway["formulario"]>) {
  const limpo = formulario.arquivo.base64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) {
    throw new GatewayErro({
      codigo: "VALIDATION_ERROR",
      status: 400,
      mensagem: "Não foi possível ler o arquivo.",
    });
  }
  const bytes = Buffer.from(limpo, "base64");
  if (bytes.byteLength === 0) {
    throw new GatewayErro({
      codigo: "VALIDATION_ERROR",
      status: 400,
      mensagem: "O arquivo está vazio.",
    });
  }
  if (bytes.byteLength > LIMITE_ARQUIVO_BYTES) {
    throw new GatewayErro({
      codigo: "VALIDATION_ERROR",
      status: 413,
      mensagem: "O arquivo é grande demais.",
    });
  }
  const nome = formulario.arquivo.nome.replace(/[\\/]/g, "").slice(0, 120) || "documento";
  const form = new FormData();
  form.append("arquivo", new Blob([bytes], { type: formulario.arquivo.tipo }), nome);
  for (const [chave, valor] of Object.entries(formulario.campos)) {
    if (valor) form.append(chave, valor);
  }
  return form;
}

export function criarClienteGateway(deps: Dependencias): ClienteGateway {
  const executar = deps.fetch ?? fetch;
  const esperar = deps.esperar ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const esperaMaximaS = deps.esperaMaximaS ?? 5;
  const tempoLimitePadraoMs = deps.tempoLimitePadraoMs ?? 30_000;
  const avisar = deps.avisar ?? ((mensagem: string) => console.error(mensagem));
  const avisoChave = deps.avisoChave ?? avisoChaveEmArquivo;
  let diaAvisado: string | null = null;

  function avisarChaveAusente() {
    const hoje = diaEmBrasilia();
    if (diaAvisado === hoje) return;
    diaAvisado = hoje;
    if (avisoChave.ler() === hoje) return;
    try {
      avisoChave.gravar(hoje);
    } catch {
      // A memória deste processo evita repetir o aviso.
    }
    avisar(AVISO_CHAVE_PLATAFORMA);
  }

  return {
    async requisitar<T>(req: RequisicaoGateway) {
      const url = montarUrl(deps.url, req);
      const chavePlataforma = deps.chavePlataforma?.trim() ?? "";
      const chaveEmpresa = deps.chave?.trim() ?? "";
      if (req.papel === "plataforma" && !chavePlataforma) avisarChaveAusente();
      const chave = req.papel === "plataforma" && chavePlataforma ? chavePlataforma : chaveEmpresa;
      if (!chave) {
        throw new GatewayErro({
          codigo: "UNAVAILABLE",
          status: 503,
          mensagem: "A chave da empresa não está configurada neste servidor.",
        });
      }
      const cabecalhos: Record<string, string> = {
        Authorization: `Bearer ${chave}`,
        "X-Actor": atorSeguro(req.ator),
        "X-Role": req.papel,
        Accept: "application/json",
      };
      if (req.unidades) cabecalhos["X-Unidades"] = req.unidades;
      // Escopo da sessão: o gateway confere a empresa; plataforma pode omitir.
      if (req.escopoEmpresa) cabecalhos["X-Tenant-Scope"] = req.escopoEmpresa;
      if (req.arquivo) cabecalhos["Accept"] = "application/octet-stream";
      const formulario = req.formulario ? montarFormulario(req.formulario) : null;
      if (!formulario && req.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
      // Para log: só método e caminho, sem query (busca pode ter telefone).
      const rotulo = `${req.metodo} ${url.pathname}`;

      for (let tentativa = 1; ; tentativa += 1) {
        let resposta: Response;
        try {
          resposta = await executar(url, {
            method: req.metodo,
            headers: cabecalhos,
            ...(formulario
              ? { body: formulario }
              : req.corpo === undefined
                ? {}
                : { body: JSON.stringify(req.corpo) }),
            signal: AbortSignal.timeout(req.tempoLimiteMs ?? tempoLimitePadraoMs),
            redirect: "error",
          });
        } catch (erro) {
          const tempo = erro instanceof Error && erro.name === "TimeoutError";
          console.error(`[gateway] ${rotulo} falhou: ${tempo ? "tempo esgotado" : "sem conexão"}`);
          throw new GatewayErro({ codigo: "UNAVAILABLE", status: 503 });
        }

        if (resposta.ok && req.arquivo) {
          const bytes = new Uint8Array(await resposta.arrayBuffer());
          // 12 MiB cobre o original (até 10 MiB) com folga, sem segurar um corpo absurdo.
          if (bytes.byteLength > 12 * 1024 * 1024) {
            throw new GatewayErro({
              codigo: "VALIDATION_ERROR",
              status: 413,
              mensagem: "O arquivo passou do tamanho que o painel consegue baixar.",
            });
          }
          const disp = resposta.headers.get("content-disposition") ?? "";
          const bruto = /filename="([^"]+)"/.exec(disp)?.[1] ?? "documento";
          const nome = bruto.replace(/[\\/]/g, "").slice(0, 180) || "documento";
          return {
            status: resposta.status,
            dados: {
              nome,
              tipo: resposta.headers.get("content-type") ?? "application/octet-stream",
              base64: Buffer.from(bytes).toString("base64"),
            } as T,
          };
        }
        if (resposta.ok) {
          return { status: resposta.status, dados: (await lerCorpo(resposta)) as T };
        }

        const tentarApos =
          resposta.status === 429 ? lerTentarApos(resposta.headers.get("Retry-After")) : null;
        if (
          resposta.status === 429 &&
          tentativa === 1 &&
          tentarApos !== null &&
          tentarApos <= esperaMaximaS
        ) {
          // 429 significa que a operação não foi feita; repetir uma vez é seguro.
          await lerCorpo(resposta);
          await esperar(tentarApos * 1000);
          continue;
        }

        const erro = interpretarErro(resposta.status, await lerCorpo(resposta), tentarApos);
        if (resposta.status >= 500 || resposta.status === 401) {
          console.error(`[gateway] ${rotulo} → ${resposta.status} ${erro.codigo}`);
        }
        throw erro;
      }
    },
  };
}

let padrao: ClienteGateway | undefined;

/** Cliente configurado por GATEWAY_ADMIN_URL e GATEWAY_PANEL_KEY. */
export function clienteGatewayPadrao(): ClienteGateway {
  if (padrao) return padrao;
  const url = process.env["GATEWAY_ADMIN_URL"];
  const chave = process.env["GATEWAY_PANEL_KEY"];
  const chavePlataforma = process.env["GATEWAY_PLATFORM_KEY"]?.trim();
  if (!url || !chave) {
    console.error("[gateway] GATEWAY_ADMIN_URL ou GATEWAY_PANEL_KEY ausente no servidor.");
    throw new GatewayErro({ codigo: "UNAVAILABLE", status: 503 });
  }
  padrao = criarClienteGateway({
    url,
    chave,
    ...(chavePlataforma ? { chavePlataforma } : {}),
  });
  return padrao;
}
