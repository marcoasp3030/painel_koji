/**
 * Único ponto do painel que fala HTTP com a API administrativa do gateway.
 * Roda só no servidor: a chave vem do ambiente e nunca é registrada em log,
 * em mensagem de erro nem em resposta ao navegador.
 */
import { GatewayErro, interpretarErro } from "./erros";

export type MetodoGateway = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequisicaoGateway = {
  metodo: MetodoGateway;
  /** Segmentos do caminho, cada um codificado como segmento de URL. */
  caminho: string[];
  /** Usuário logado no painel, enviado em X-Actor. */
  ator: string;
  papel: "plataforma" | "admin" | "membro";
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
};

export type ClienteGateway = {
  requisitar<T = unknown>(req: RequisicaoGateway): Promise<{ status: number; dados: T }>;
};

type Dependencias = {
  url: string;
  chave: string;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  /** Esperas de 429 até este limite são feitas no servidor, uma única vez. */
  esperaMaximaS?: number;
  tempoLimitePadraoMs?: number;
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

export function criarClienteGateway(deps: Dependencias): ClienteGateway {
  const executar = deps.fetch ?? fetch;
  const esperar = deps.esperar ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const esperaMaximaS = deps.esperaMaximaS ?? 5;
  const tempoLimitePadraoMs = deps.tempoLimitePadraoMs ?? 30_000;

  return {
    async requisitar<T>(req: RequisicaoGateway) {
      const url = montarUrl(deps.url, req);
      const cabecalhos: Record<string, string> = {
        Authorization: `Bearer ${deps.chave}`,
        "X-Actor": atorSeguro(req.ator),
        "X-Role": ["plataforma", "admin", "membro"].includes(req.papel) ? req.papel : "membro",
        Accept: "application/json",
      };
      // Escopo da sessão: o gateway confere a empresa; plataforma pode omitir.
      if (req.escopoEmpresa) cabecalhos["X-Tenant-Scope"] = req.escopoEmpresa;
      if (req.arquivo) cabecalhos["Accept"] = "application/octet-stream";
      if (req.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
      // Para log: só método e caminho, sem query (busca pode ter telefone).
      const rotulo = `${req.metodo} ${url.pathname}`;

      for (let tentativa = 1; ; tentativa += 1) {
        let resposta: Response;
        try {
          resposta = await executar(url, {
            method: req.metodo,
            headers: cabecalhos,
            ...(req.corpo === undefined ? {} : { body: JSON.stringify(req.corpo) }),
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
  if (!url || !chave) {
    console.error("[gateway] GATEWAY_ADMIN_URL ou GATEWAY_PANEL_KEY ausente no servidor.");
    throw new GatewayErro({ codigo: "UNAVAILABLE", status: 503 });
  }
  padrao = criarClienteGateway({ url, chave });
  return padrao;
}
