import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { DocumentosTela } from "@/components/luxtia/documentos/Documentos";
import {
  apagarDocumento,
  baixarDocumento,
  listarDocumentos,
  obterDocumento,
  textoDocumento,
} from "@/lib/gateway-documentos.functions";
import {
  FILTRO_DOCUMENTOS_VAZIO,
  periodoDocumentosValido,
  type DocumentoResumo,
  type FiltroDocumentos,
  type TextoPagina,
} from "@/lib/gateway/documentos";

export const Route = createFileRoute("/_authenticated/ia/documentos")({
  validateSearch: (s: Record<string, unknown>): { documento?: string } =>
    typeof s["documento"] === "string" && /^anx_[0-9a-f]{24}$/.test(s["documento"])
      ? { documento: s["documento"] }
      : {},
  head: () => ({ meta: [{ title: "Documentos | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Documentos"
      descricao="Arquivos recebidos pelo formulário ou pelo n8n, com a leitura e a confiança de cada campo."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <Tela key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

function baixarArquivo(nome: string, tipo: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function Tela({ ctx }: { ctx: ContextoGateway }) {
  const listar = useServerFn(listarDocumentos);
  const obter = useServerFn(obterDocumento);
  const texto = useServerFn(textoDocumento);
  const baixarFn = useServerFn(baixarDocumento);
  const apagarFn = useServerFn(apagarDocumento);
  const cache = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroDocumentos>(FILTRO_DOCUMENTOS_VAZIO);
  const [extras, setExtras] = useState<DocumentoResumo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [temMais, setTemMais] = useState(false);
  const { documento } = Route.useSearch();
  const [aberto, setAberto] = useState<string | null>(documento ?? null);
  const [pagina, setPagina] = useState<TextoPagina | null>(null);
  const podeApagar = ctx.papel === "plataforma" || ctx.papel === "admin";
  const periodoOk = periodoDocumentosValido(filtro);
  const consulta = {
    empresa: ctx.empresa,
    acao: "listar" as const,
    ...(filtro.estado ? { estado: filtro.estado } : {}),
    ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
    ...(filtro.desde ? { desde: filtro.desde } : {}),
    ...(filtro.ate ? { ate: filtro.ate } : {}),
  };
  const lista = useQuery({
    queryKey: ["documentos", ctx.empresa, filtro],
    enabled: periodoOk,
    queryFn: async () => {
      const r = await listar({ data: consulta });
      setExtras([]);
      setCursor(r.proximo_cursor);
      setTemMais(Boolean(r.proximo_cursor));
      return r.itens;
    },
  });
  const detalhe = useQuery({
    queryKey: ["documento", ctx.empresa, aberto],
    enabled: Boolean(aberto),
    queryFn: async () => {
      const d = await obter({
        data: { empresa: ctx.empresa, acao: "detalhe", id: aberto },
      });
      const paginaLida = await texto({
        data: { empresa: ctx.empresa, acao: "texto", id: aberto, pagina: 1 },
      }).catch(() => null);
      setPagina(paginaLida);
      return d;
    },
  });
  const mais = useMutation({
    mutationFn: () => listar({ data: { ...consulta, cursor } }),
    onSuccess: (r) => {
      setExtras((a) => [...a, ...r.itens]);
      setCursor(r.proximo_cursor);
      setTemMais(Boolean(r.proximo_cursor));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const baixar = useMutation({
    mutationFn: (id: string) => baixarFn({ data: { empresa: ctx.empresa, acao: "baixar", id } }),
    onSuccess: (r) => baixarArquivo(r.nome, r.tipo, r.base64),
    onError: (e: Error) => toast.error(e.message),
  });
  const apagar = useMutation({
    mutationFn: (id: string) => apagarFn({ data: { empresa: ctx.empresa, acao: "apagar", id } }),
    onSuccess: () => {
      toast.success("Documento apagado.");
      setAberto(null);
      void cache.invalidateQueries({ queryKey: ["documentos", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const itens = [...(lista.data ?? []), ...extras];
  return (
    <DocumentosTela
      itens={itens}
      filtro={filtro}
      onFiltro={(f) => {
        setFiltro(f);
        setExtras([]);
        setCursor(null);
        setTemMais(false);
      }}
      carregando={lista.isLoading}
      erro={lista.error instanceof Error ? lista.error.message : undefined}
      temMais={temMais}
      carregandoMais={mais.isPending}
      onMais={() => mais.mutate()}
      detalhe={detalhe.data ?? null}
      pagina={pagina}
      carregandoDetalhe={detalhe.isLoading}
      podeApagar={podeApagar}
      onAbrir={(id) => {
        setPagina(null);
        setAberto(id);
      }}
      onFechar={() => setAberto(null)}
      onPagina={(n) => {
        void texto({ data: { empresa: ctx.empresa, acao: "texto", id: aberto, pagina: n } }).then(
          (t) => setPagina(t),
          (e: Error) => toast.error(e.message),
        );
      }}
      onBaixar={(id) => baixar.mutate(id)}
      onApagar={(id) => apagar.mutate(id)}
    />
  );
}
