import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { AbasDocumentos } from "@/components/luxtia/documentos/AbasDocumentos";
import { LoteDetalhe, type EnvioItem } from "@/components/luxtia/documentos/Lotes";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import {
  apagarLote,
  enviarArquivoLote,
  fecharLote,
  listarArquivosLote,
  listarNotasLote,
  obterLote,
} from "@/lib/gateway-lotes.functions";
import {
  INTERVALO_PROGRESSO_LOTE_MS,
  ROTULO_MOTIVO_LOTE,
  mensagemArquivoLoteInvalido,
} from "@/lib/gateway/lotes";

export const Route = createFileRoute("/_authenticated/ia/documentos/lotes/$loteId")({
  validateSearch: (): Record<string, never> => ({}),
  head: () => ({ meta: [{ title: "Lote | Luxbrain" }] }),
  component: DetalhePagina,
});

function DetalhePagina() {
  const { loteId } = Route.useParams();
  return (
    <PaginaGateway
      titulo="Documentos"
      descricao="Progresso do lote, notas lidas e arquivos enviados."
      papeis={["plataforma", "gestor"]}
    >
      {(ctx) => <Tela key={`${ctx.empresa}-${loteId}`} ctx={ctx} loteId={loteId} />}
    </PaginaGateway>
  );
}

function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const r = String(leitor.result ?? "");
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(file);
  });
}

function Tela({ ctx, loteId }: { ctx: ContextoGateway; loteId: string }) {
  const navegar = useNavigate();
  const obter = useServerFn(obterLote);
  const enviar = useServerFn(enviarArquivoLote);
  const listarArq = useServerFn(listarArquivosLote);
  const listarNotas = useServerFn(listarNotasLote);
  const fecharFn = useServerFn(fecharLote);
  const apagarFn = useServerFn(apagarLote);
  const listarAg = useServerFn(listarAgentes);
  const cache = useQueryClient();

  const [aba, setAba] = useState<"notas" | "arquivos">("notas");
  const [filtroArquivo, setFiltroArquivo] = useState("");
  const [envios, setEnvios] = useState<EnvioItem[]>([]);
  const [enviando, setEnviando] = useState(false);

  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });

  const lote = useQuery({
    queryKey: ["lote", ctx.empresa, loteId],
    queryFn: () => obter({ data: { empresa: ctx.empresa, acao: "ver", lote_id: loteId } }),
    refetchInterval: (q) => {
      const naFila = q.state.data?.arquivos.na_fila ?? 0;
      return naFila > 0 ? INTERVALO_PROGRESSO_LOTE_MS : false;
    },
  });

  const notas = useQuery({
    queryKey: ["lote-notas", ctx.empresa, loteId],
    enabled: aba === "notas",
    queryFn: async () => {
      const r = await listarNotas({
        data: { empresa: ctx.empresa, acao: "notas", lote_id: loteId },
      });
      return r.itens;
    },
    refetchInterval: () =>
      (lote.data?.arquivos.na_fila ?? 0) > 0 ? INTERVALO_PROGRESSO_LOTE_MS : false,
  });

  const arquivos = useQuery({
    queryKey: ["lote-arquivos", ctx.empresa, loteId, filtroArquivo],
    enabled: aba === "arquivos",
    queryFn: async () => {
      const r = await listarArq({
        data: {
          empresa: ctx.empresa,
          acao: "arquivos",
          lote_id: loteId,
          ...(filtroArquivo ? { estado: filtroArquivo } : {}),
        },
      });
      return r.itens;
    },
    refetchInterval: () =>
      (lote.data?.arquivos.na_fila ?? 0) > 0 ? INTERVALO_PROGRESSO_LOTE_MS : false,
  });

  useEffect(() => {
    if ((lote.data?.arquivos.na_fila ?? 0) > 0) {
      void cache.invalidateQueries({ queryKey: ["lote-notas", ctx.empresa, loteId] });
      void cache.invalidateQueries({ queryKey: ["lote-arquivos", ctx.empresa, loteId] });
    }
  }, [lote.data?.arquivos.na_fila, lote.data?.arquivos.lido, cache, ctx.empresa, loteId]);

  const nomeAgente =
    agentes.data?.itens.find((a) => a.id === lote.data?.agente_id)?.nome ??
    lote.data?.agente_id ??
    "—";

  const atualizarEnvio = useCallback((chave: string, patch: Partial<EnvioItem>) => {
    setEnvios((atual) => atual.map((e) => (e.chave === chave ? { ...e, ...patch } : e)));
  }, []);

  async function enviarSequencia(files: File[]) {
    if (enviando) return;
    setEnviando(true);
    const base = Date.now();
    const itens: EnvioItem[] = files.map((f, i) => ({
      chave: `${base}-${i}-${f.name}`,
      nome: f.name,
      estado: "aguardando",
      progresso: 0,
    }));
    setEnvios((a) => [...itens, ...a]);

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!;
      const chave = itens[i]!.chave;
      const local = mensagemArquivoLoteInvalido(file.name, file.size);
      if (local) {
        atualizarEnvio(chave, { estado: "erro", progresso: 100, mensagem: local });
        continue;
      }
      atualizarEnvio(chave, { estado: "enviando", progresso: 15 });
      try {
        const base64 = await arquivoParaBase64(file);
        atualizarEnvio(chave, { progresso: 45 });
        const r = await enviar({
          data: {
            empresa: ctx.empresa,
            acao: "enviar",
            lote_id: loteId,
            nome: file.name,
            tipo: file.type || "application/octet-stream",
            base64,
          },
        });
        atualizarEnvio(chave, {
          estado: "ok",
          progresso: 100,
          itensZip: r.arquivos.map((a) => ({
            nome: a.nome,
            estado: a.estado,
            motivo: a.motivo,
          })),
        });
        void cache.setQueryData(["lote", ctx.empresa, loteId], r.lote);
      } catch (e) {
        const mensagem =
          e instanceof Error
            ? e.message
            : ROTULO_MOTIVO_LOTE.tipo_nao_aceito ?? "Não foi possível enviar.";
        atualizarEnvio(chave, { estado: "erro", progresso: 100, mensagem });
      }
    }

    setEnviando(false);
    void cache.invalidateQueries({ queryKey: ["lote", ctx.empresa, loteId] });
    void cache.invalidateQueries({ queryKey: ["lote-notas", ctx.empresa, loteId] });
    void cache.invalidateQueries({ queryKey: ["lote-arquivos", ctx.empresa, loteId] });
    void cache.invalidateQueries({ queryKey: ["lotes", ctx.empresa] });
  }

  const fecharMut = useMutation({
    mutationFn: () =>
      fecharFn({ data: { empresa: ctx.empresa, acao: "fechar", lote_id: loteId } }),
    onSuccess: (l) => {
      toast.success("Lote fechado.");
      void cache.setQueryData(["lote", ctx.empresa, loteId], l);
      void cache.invalidateQueries({ queryKey: ["lotes", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apagarMut = useMutation({
    mutationFn: () =>
      apagarFn({ data: { empresa: ctx.empresa, acao: "apagar", lote_id: loteId } }),
    onSuccess: () => {
      toast.success("Lote apagado.");
      void cache.invalidateQueries({ queryKey: ["lotes", ctx.empresa] });
      void navegar({ to: "/ia/documentos/lotes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (lote.isLoading) {
    return (
      <>
        <AbasDocumentos ativa="lotes" />
        <p className="mt-6 text-ink-500">Carregando…</p>
      </>
    );
  }
  if (lote.error || !lote.data) {
    return (
      <>
        <AbasDocumentos ativa="lotes" />
        <p className="mt-6 text-destructive" role="alert">
          {lote.error instanceof Error ? lote.error.message : "Lote não encontrado."}
        </p>
      </>
    );
  }

  return (
    <>
      <AbasDocumentos ativa="lotes" />
      <LoteDetalhe
        lote={lote.data}
        nomeAgente={nomeAgente}
        notas={notas.data ?? []}
        arquivos={arquivos.data ?? []}
        filtroArquivo={filtroArquivo}
        onFiltroArquivo={setFiltroArquivo}
        aba={aba}
        onAba={setAba}
        enviando={enviando}
        envios={envios}
        onSoltar={(files) => void enviarSequencia(files)}
        onFechar={() => fecharMut.mutate()}
        fechando={fecharMut.isPending}
        onApagar={() => apagarMut.mutate()}
        apagando={apagarMut.isPending}
      />
    </>
  );
}
