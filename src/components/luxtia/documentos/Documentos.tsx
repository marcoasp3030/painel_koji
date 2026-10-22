/** Lista e detalhe dos documentos recebidos. */
import { useState } from "react";
import { CampoData } from "@/components/luxtia/DataHora";
import { Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import { Etiqueta, Vazio } from "@/components/luxtia/Gateway";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AVISO_PIX,
  CAMPOS_COPIAR,
  ESTADOS_DOCUMENTO,
  FILTRO_DOCUMENTOS_VAZIO,
  ROTULO_ESTADO_DOCUMENTO,
  ROTULO_FORMATO,
  ROTULO_MOTIVO_DOCUMENTO,
  SELO_CONFIANCA,
  TIPOS_FILTRO_DOCUMENTO,
  apresentarCampo,
  dataHoraBrasilia,
  ehComprovantePix,
  itensNota,
  periodoDocumentosValido,
  reaisDocumento,
  rotuloCampoDocumento,
  rotuloTipo,
  textoExpira,
  type CampoDocumento,
  type DocumentoDetalhe,
  type DocumentoResumo,
  type FiltroDocumentos,
  type ItemNota,
  type TextoPagina,
} from "@/lib/gateway/documentos";

export function DocumentosTela({
  itens,
  filtro,
  onFiltro,
  carregando,
  erro,
  temMais,
  carregandoMais,
  onMais,
  detalhe,
  pagina,
  carregandoDetalhe,
  podeApagar,
  onAbrir,
  onFechar,
  onPagina,
  onBaixar,
  onApagar,
}: {
  itens: DocumentoResumo[];
  filtro: FiltroDocumentos;
  onFiltro: (f: FiltroDocumentos) => void;
  carregando: boolean;
  erro?: string | undefined;
  temMais: boolean;
  carregandoMais: boolean;
  onMais: () => void;
  detalhe: DocumentoDetalhe | null;
  pagina: TextoPagina | null;
  carregandoDetalhe: boolean;
  podeApagar: boolean;
  onAbrir: (id: string) => void;
  onFechar: () => void;
  onPagina: (n: number) => void;
  onBaixar: (id: string) => void;
  onApagar: (id: string) => void;
}) {
  const periodoInvalido = !periodoDocumentosValido(filtro);
  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-500">
          Estado
          <select
            className="mt-1 block h-10 rounded-md border border-base-200 bg-card px-3 text-sm text-ink-900"
            aria-label="Estado"
            value={filtro.estado}
            onChange={(e) => onFiltro({ ...filtro, estado: e.target.value })}
          >
            <option value="">Todos</option>
            {ESTADOS_DOCUMENTO.map((e) => (
              <option key={e} value={e}>
                {ROTULO_ESTADO_DOCUMENTO[e]?.rotulo ?? e}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-500">
          Tipo
          <select
            className="mt-1 block h-10 rounded-md border border-base-200 bg-card px-3 text-sm text-ink-900"
            aria-label="Tipo"
            value={filtro.tipo}
            onChange={(e) => onFiltro({ ...filtro, tipo: e.target.value })}
          >
            <option value="">Todos</option>
            {TIPOS_FILTRO_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {rotuloTipo(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-500">
          De
          <CampoData
            className="mt-1"
            valor={filtro.desde}
            onChange={(desde) => onFiltro({ ...filtro, desde })}
          />
        </label>
        <label className="text-xs text-ink-500">
          Até
          <CampoData
            className="mt-1"
            valor={filtro.ate}
            onChange={(ate) => onFiltro({ ...filtro, ate })}
          />
        </label>
        {filtro.estado || filtro.tipo || filtro.desde || filtro.ate ? (
          <Button variant="ghost" size="sm" onClick={() => onFiltro(FILTRO_DOCUMENTOS_VAZIO)}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
      {periodoInvalido ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          A data inicial é posterior à final.
        </p>
      ) : null}
      <Cartao className="mt-4">
        {carregando ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : erro ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={erro} />
        ) : itens.length === 0 ? (
          <Vazio
            titulo="Nenhum documento"
            texto="Quando um formulário ou o n8n enviar um arquivo, ele aparece aqui."
          />
        ) : (
          <ul>
            {itens.map((d) => {
              const estado = ROTULO_ESTADO_DOCUMENTO[d.estado] ?? {
                rotulo: d.estado,
                tom: "neutro" as const,
              };
              return (
                <li key={d.id} className="border-b border-base-200 last:border-0">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 px-5 py-4 text-left hover:bg-purple-50/40"
                    onClick={() => onAbrir(d.id)}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-900">{d.nome || "Documento"}</span>
                      <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta>
                      {d.apagado_em ? <Etiqueta tom="perigo">Apagado</Etiqueta> : null}
                      <Etiqueta>{rotuloTipo(d.tipo_documento)}</Etiqueta>
                    </span>
                    <span className="text-xs text-ink-500">
                      {ROTULO_FORMATO[d.formato ?? ""] ?? d.formato ?? "—"} · {d.paginas ?? "—"}{" "}
                      {d.paginas === 1 ? "página" : "páginas"} · {dataHoraBrasilia(d.criado_em)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {temMais ? (
          <div className="border-t border-base-200 p-3">
            <Button variant="ghost" className="w-full" disabled={carregandoMais} onClick={onMais}>
              Carregar mais
            </Button>
          </div>
        ) : null}
      </Cartao>
      <Sheet open={Boolean(detalhe) || carregandoDetalhe} onOpenChange={(v) => !v && onFechar()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{detalhe?.nome || "Documento"}</SheetTitle>
            <SheetDescription>Leitura do arquivo, com a confiança de cada campo.</SheetDescription>
          </SheetHeader>
          {carregandoDetalhe && !detalhe ? (
            <p className="mt-6 text-ink-500">Carregando…</p>
          ) : detalhe ? (
            <Detalhe
              detalhe={detalhe}
              pagina={pagina}
              podeApagar={podeApagar}
              onPagina={onPagina}
              onBaixar={() => onBaixar(detalhe.id)}
              onApagar={() => onApagar(detalhe.id)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Detalhe({
  detalhe,
  pagina,
  podeApagar,
  onPagina,
  onBaixar,
  onApagar,
}: {
  detalhe: DocumentoDetalhe;
  pagina: TextoPagina | null;
  podeApagar: boolean;
  onPagina: (n: number) => void;
  onBaixar: () => void;
  onApagar: () => void;
}) {
  const estado = ROTULO_ESTADO_DOCUMENTO[detalhe.estado];
  const campos = Object.entries(detalhe.conteudo?.campos ?? {});
  const total = detalhe.paginas ?? detalhe.conteudo?.paginas.length ?? 0;
  const [paginaAtual, setPaginaAtual] = useState(pagina?.pagina ?? 1);
  return (
    <div className="mt-4 space-y-5">
      <div className="flex flex-wrap gap-2">
        {estado ? <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta> : null}
        <Etiqueta>{ROTULO_FORMATO[detalhe.formato ?? ""] ?? detalhe.formato ?? "—"}</Etiqueta>
        <Etiqueta>
          {total || "—"} {total === 1 ? "página" : "páginas"}
        </Etiqueta>
        <Etiqueta>{rotuloTipo(detalhe.tipo_documento)}</Etiqueta>
      </div>
      {detalhe.motivo ? (
        <p className="text-sm text-ink-700">
          {ROTULO_MOTIVO_DOCUMENTO[detalhe.motivo] ?? detalhe.motivo}
        </p>
      ) : null}
      <p className="text-xs text-ink-500">Recebido {dataHoraBrasilia(detalhe.criado_em)}</p>
      {textoExpira(detalhe.expira_em) ? (
        <p className="text-sm text-ink-700">{textoExpira(detalhe.expira_em)}</p>
      ) : null}
      {ehComprovantePix(detalhe.tipo_documento) ? (
        <p
          role="note"
          className="rounded-lg border border-gold-500/60 bg-gold-300/20 px-3 py-2 text-sm text-ink-900"
        >
          {AVISO_PIX}
        </p>
      ) : null}
      <section>
        <h3 className="font-medium text-ink-900">Campos</h3>
        {campos.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Nenhum campo lido ainda.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {campos.map(([nome, campo]) => (
              <CampoLido key={nome} nome={nome} campo={campo} />
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="font-medium text-ink-900">Conteúdo por página</h3>
        {total > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={paginaAtual === n ? "default" : "outline"}
                onClick={() => {
                  setPaginaAtual(n);
                  onPagina(n);
                }}
              >
                {n}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 rounded-lg bg-base-50 p-3">
          <p className="whitespace-pre-wrap text-sm text-ink-800">
            {pagina?.texto || "Sem texto nesta página."}
          </p>
          {(pagina?.tabelas ?? []).map((t) => (
            <div key={t.id} className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <tbody>
                  {t.linhas.map((linha, i) => (
                    <tr key={i} className="border-t border-base-200">
                      {linha.map((cel, j) => (
                        <td key={j} className="px-2 py-1">
                          {cel}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={Boolean(detalhe.apagado_em)} onClick={onBaixar}>
          Baixar original
        </Button>
        {podeApagar && !detalhe.apagado_em ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Apagar</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar este documento?</AlertDialogTitle>
                <AlertDialogDescription>
                  O arquivo original e a leitura são apagados. Não dá para desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={onApagar}
                >
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}

function CampoLido({ nome, campo }: { nome: string; campo: CampoDocumento }) {
  const selo = SELO_CONFIANCA[campo.confianca] ?? {
    rotulo: campo.confianca,
    tom: "neutro" as const,
  };
  const itens = nome === "itens" ? itensNota(campo.valor) : null;
  const copiavel =
    (CAMPOS_COPIAR as readonly string[]).includes(nome) &&
    (typeof campo.valor === "string" || typeof campo.valor === "number");
  return (
    <li className="rounded-lg border border-base-200 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">{rotuloCampoDocumento(nome)}</span>
        <Etiqueta tom={selo.tom}>{selo.rotulo}</Etiqueta>
      </div>
      {itens ? (
        <TabelaItens itens={itens} />
      ) : (
        <div className="mt-1 flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-all text-sm text-ink-900">
            {apresentarCampo(nome, campo.valor)}
          </p>
          {copiavel ? <BotaoCopiar valor={String(campo.valor)} /> : null}
        </div>
      )}
    </li>
  );
}

function TabelaItens({ itens }: { itens: ItemNota[] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-ink-500">
            <th className="py-1 pr-2 font-medium">Descrição</th>
            <th className="py-1 pr-2 font-medium">Quantidade</th>
            <th className="py-1 pr-2 font-medium">Valor unitário</th>
            <th className="py-1 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, i) => (
            <tr key={`${item.descricao}-${i}`} className="border-t border-base-200">
              <td className="py-1 pr-2">{item.descricao}</td>
              <td className="py-1 pr-2">{item.quantidade ?? "—"}</td>
              <td className="py-1 pr-2">
                {item.valor_unitario
                  ? (reaisDocumento(item.valor_unitario) ?? item.valor_unitario)
                  : "—"}
              </td>
              <td className="py-1">
                {item.valor_total ? (reaisDocumento(item.valor_total) ?? item.valor_total) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BotaoCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => {
        void navigator.clipboard.writeText(valor).then(
          () => setCopiado(true),
          () => setCopiado(false),
        );
      }}
    >
      {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}
