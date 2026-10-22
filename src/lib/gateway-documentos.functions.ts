/** Documentos e chaves de formulário. A chave em texto sai só na criação. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ChaveFormulario,
  DocumentoDetalhe,
  DocumentoResumo,
  TextoPagina,
} from "./gateway/documentos";

type PaginaDocs = { itens: DocumentoResumo[]; proximo_cursor: string | null };
type Arquivo = { nome: string; tipo: string; base64: string };

async function documentos<T>(context: unknown, data: unknown): Promise<T> {
  const g = await import("./gateway/painel.server");
  const { executarDocumentos } = await import("./gateway/documentos.server");
  return g.executar(context as Parameters<typeof g.executar>[0], (s) =>
    executarDocumentos(s, data),
  ) as Promise<T>;
}

async function chaves<T>(context: unknown, data: unknown): Promise<T> {
  const g = await import("./gateway/painel.server");
  const { executarChaveFormulario } = await import("./gateway/documentos.server");
  return g.executar(context as Parameters<typeof g.executar>[0], (s) =>
    executarChaveFormulario(s, data),
  ) as Promise<T>;
}

export const listarDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => documentos<PaginaDocs>(context, data));

export const obterDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => documentos<DocumentoDetalhe>(context, data));

export const textoDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => documentos<TextoPagina>(context, data));

export const baixarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => documentos<Arquivo>(context, data));

export const apagarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => documentos<DocumentoResumo>(context, data));

export const listarChavesFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => chaves<{ itens: ChaveFormulario[] }>(context, data));

export const criarChaveFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => chaves<ChaveFormulario & { chave: string }>(context, data));

export const revogarChaveFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => chaves<ChaveFormulario>(context, data));
