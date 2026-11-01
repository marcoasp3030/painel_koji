/** Respostas rápidas na caixa de mensagem: "/" abre o menu e a resposta entra no campo para revisão, nunca é enviada sozinha. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, Users, UserRound, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { peloMenos } from "@/lib/acesso/papeis";
import {
  gravarResposta,
  listarRespostas,
  removerOuContarResposta,
} from "@/lib/gateway-respostas.functions";
import {
  aplicarVariaveis,
  filtrarRespostas,
  LIMITE_TEXTO_RESPOSTA,
  REGRA_ATALHO,
  tokenBarra,
  trocarToken,
  VARIAVEIS_RESPOSTA,
  type EscopoResposta,
  type RespostaRapida,
} from "@/lib/gateway/respostas-rapidas";
import type { ContextoGateway } from "./Gateway";

type DadosConversa = { nome: string | null; unidade: string | null };

function SeloEscopo({ escopo }: { escopo: EscopoResposta }) {
  const Icone = escopo === "equipe" ? Users : UserRound;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-ink-500">
      <Icone className="size-3" aria-hidden />
      {escopo === "equipe" ? "Equipe" : "Só para mim"}
    </span>
  );
}

function useListaRespostas(empresa: string | null) {
  const listar = useServerFn(listarRespostas);
  return useQuery({
    queryKey: ["respostas-rapidas", empresa],
    queryFn: () => listar({ data: { empresa, acao: "listar" } }),
    staleTime: 30_000,
  });
}

/** Liga o menu ao campo de mensagem: a tela só repassa os eventos e desenha `menu`. */
export function useMenuRespostas({
  ctx,
  texto,
  escrever,
  campo,
  dados,
}: {
  ctx: ContextoGateway;
  texto: string;
  escrever: (valor: string) => void;
  campo: React.RefObject<HTMLTextAreaElement | null>;
  dados: DadosConversa;
}) {
  const lista = useListaRespostas(ctx.empresa);
  const contar = useServerFn(removerOuContarResposta);
  const [cursor, setCursor] = useState(0);
  const [emFoco, setEmFoco] = useState(false);
  const [dispensado, setDispensado] = useState<number | null>(null);
  const [indice, setIndice] = useState(0);
  const [gerindo, setGerindo] = useState(false);
  const cursorPendente = useRef<number | null>(null);

  const token = emFoco ? tokenBarra(texto, cursor) : null;
  const aberto = Boolean(token) && dispensado !== token?.inicio;
  const termo = token?.termo ?? "";
  const achadas = filtrarRespostas(lista.data?.itens ?? [], termo);
  useEffect(() => setIndice(0), [termo]);
  useEffect(() => {
    if (!token) setDispensado(null);
  }, [token]);

  useLayoutEffect(() => {
    const posicao = cursorPendente.current;
    if (posicao === null) return;
    cursorPendente.current = null;
    campo.current?.setSelectionRange(posicao, posicao);
    setCursor(posicao);
  }, [texto, campo]);

  const lerCursor = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCursor(e.currentTarget.selectionStart);
  }, []);

  function escolher(r: RespostaRapida) {
    if (!token) return;
    const pronto = trocarToken(texto, token, aplicarVariaveis(r.texto, dados));
    cursorPendente.current = pronto.cursor;
    escrever(pronto.texto);
    // Só ordena a lista por uso: falhar aqui não atrapalha o atendimento.
    void contar({ data: { empresa: ctx.empresa, acao: "usar", id: r.id } }).catch(() => undefined);
  }

  /** Devolve true quando a tecla era do menu e não deve chegar ao envio. */
  function teclado(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!aberto || !token) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setDispensado(token.inicio);
      return true;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (e.altKey || !achadas.length) return false;
      e.preventDefault();
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setIndice((i) => (i + passo + achadas.length) % achadas.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      if (e.shiftKey) return false;
      e.preventDefault();
      const escolhida = achadas[indice];
      if (escolhida) escolher(escolhida);
      else setDispensado(token.inicio);
      return true;
    }
    return false;
  }

  /** Botão de raio: mesmo caminho de digitar "/" no ponto do cursor. */
  function abrirPeloBotao() {
    const el = campo.current;
    const posicao = el?.selectionStart ?? texto.length;
    const antes = texto.slice(0, posicao);
    const marca = !antes || /\s$/.test(antes) ? "/" : " /";
    cursorPendente.current = posicao + marca.length;
    escrever(antes + marca + texto.slice(posicao));
    el?.focus();
  }

  const camposDoTexto = {
    onSelect: lerCursor,
    onClick: lerCursor,
    onKeyUp: lerCursor,
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setEmFoco(true);
      lerCursor(e);
    },
    onBlur: () => setEmFoco(false),
  };

  // Texto que a pessoa já escreveu vira ponto de partida de uma resposta nova.
  // O "/" que abriu o menu não faz parte dele, mesmo depois que o campo perde o foco.
  const tokenDoCursor = tokenBarra(texto, cursor);
  const rascunho = (tokenDoCursor ? trocarToken(texto, tokenDoCursor, "").texto : texto).trim();

  const menu = aberto ? (
    <div className="absolute inset-x-3 bottom-full z-20 mb-1 overflow-hidden rounded-lg border border-base-200 bg-card shadow-[0_8px_24px_rgba(46,35,64,0.16)]">
      {lista.data?.indisponivel ? (
        <p className="px-3 py-2 text-xs text-ink-500">
          Respostas rápidas ainda não estão disponíveis nesta versão do gateway.
        </p>
      ) : lista.isLoading ? (
        <p className="px-3 py-2 text-xs text-ink-500">Carregando respostas…</p>
      ) : lista.isError ? (
        <p role="alert" className="px-3 py-2 text-xs text-destructive">
          {lista.error.message}
        </p>
      ) : achadas.length ? (
        <ul role="listbox" aria-label="Respostas rápidas" className="max-h-56 overflow-y-auto">
          {achadas.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === indice}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${i === indice ? "bg-purple-100/70" : "hover:bg-purple-50"}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setIndice(i)}
                onClick={() => escolher(r)}
              >
                <span className="shrink-0 text-xs font-semibold text-purple-800">/{r.atalho}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-500">
                  {aplicarVariaveis(r.texto, dados)}
                </span>
                {r.escopo === "pessoal" ? <SeloEscopo escopo={r.escopo} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2 text-xs text-ink-500">
          {termo ? `Nenhuma resposta para “${termo}”.` : "Nenhuma resposta cadastrada ainda."}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-base-200 bg-base-50 py-1 pl-3 pr-1">
        <span className="min-w-0 truncate text-[10px] text-ink-500">
          ↑↓ escolher · Enter inserir · Esc fechar
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setGerindo(true)}
        >
          Gerenciar
        </Button>
      </div>
    </div>
  ) : null;

  // Fora do <form> da mensagem: eventos de portal sobem pela árvore do React, e salvar aqui
  // dentro dispararia o envio do texto digitado ao cliente.
  const dialogo = (
    <GerenciarRespostas
      ctx={ctx}
      aberto={gerindo}
      fechar={() => setGerindo(false)}
      rascunho={rascunho}
    />
  );

  return { aberto, teclado, camposDoTexto, abrirPeloBotao, menu, dialogo };
}

export function BotaoRespostas({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 text-purple-700"
      aria-label="Respostas rápidas"
      title="Respostas rápidas (digite / no campo)"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Zap aria-hidden />
    </Button>
  );
}

type Edicao = { id: number | null; atalho: string; texto: string; escopo: EscopoResposta };

function GerenciarRespostas({
  ctx,
  aberto,
  fechar,
  rascunho,
}: {
  ctx: ContextoGateway;
  aberto: boolean;
  fechar: () => void;
  rascunho: string;
}) {
  const lista = useListaRespostas(ctx.empresa);
  const gravar = useServerFn(gravarResposta);
  const remover = useServerFn(removerOuContarResposta);
  const cache = useQueryClient();
  const podeEquipe = peloMenos(ctx.papel, "supervisor");
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<number | null>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const nova = useCallback(
    (texto = ""): Edicao => ({
      id: null,
      atalho: "",
      texto,
      escopo: podeEquipe ? "equipe" : "pessoal",
    }),
    [podeEquipe],
  );

  // Prepara a tela só ao abrir: o texto do campo pode mudar por trás sem desfazer o que está aqui.
  const rascunhoAoAbrir = useRef(rascunho);
  rascunhoAoAbrir.current = rascunho;
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setBusca("");
    setApagando(null);
    setEdicao(rascunhoAoAbrir.current ? nova(rascunhoAoAbrir.current) : null);
  }, [aberto, nova]);

  const recarregar = () =>
    cache.invalidateQueries({ queryKey: ["respostas-rapidas", ctx.empresa] });

  const salvar = useMutation({
    mutationFn: (e: Edicao) =>
      gravar({
        data:
          e.id === null
            ? {
                empresa: ctx.empresa,
                acao: "criar",
                atalho: e.atalho,
                texto: e.texto,
                escopo: e.escopo,
              }
            : {
                empresa: ctx.empresa,
                acao: "alterar",
                id: e.id,
                atalho: e.atalho,
                texto: e.texto,
              },
      }),
    onSuccess: (_, e) => {
      toast.success(e.id === null ? "Resposta criada." : "Resposta atualizada.");
      setEdicao(null);
      void recarregar();
    },
    onError: (e: Error) => setErro(e.message),
    retry: false,
  });
  const apagar = useMutation({
    mutationFn: (id: number) => remover({ data: { empresa: ctx.empresa, acao: "apagar", id } }),
    onSuccess: () => {
      toast.success("Resposta apagada.");
      setApagando(null);
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
    retry: false,
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!edicao) return;
    if (!REGRA_ATALHO.test(edicao.atalho))
      return setErro("No atalho, use letras minúsculas, números, - ou _, sem espaços.");
    if (!edicao.texto.trim()) return setErro("Escreva o texto da resposta.");
    setErro(null);
    salvar.mutate(edicao);
  }

  function inserirVariavel(chave: string) {
    const el = textoRef.current;
    if (!edicao || !el) return;
    const marca = `{${chave}}`;
    const inicio = el.selectionStart ?? edicao.texto.length;
    const fim = el.selectionEnd ?? inicio;
    setEdicao({
      ...edicao,
      texto: edicao.texto.slice(0, inicio) + marca + edicao.texto.slice(fim),
    });
    el.focus();
  }

  const itens = filtrarRespostas(lista.data?.itens ?? [], busca);
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="flex max-h-[85dvh] max-w-xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Respostas rápidas</DialogTitle>
          <DialogDescription>
            Digite / na mensagem para usar. A resposta entra no campo para você revisar antes de
            enviar.
          </DialogDescription>
        </DialogHeader>
        {edicao ? (
          <form onSubmit={enviar} className="min-h-0 space-y-3 overflow-y-auto p-px">
            <label className="block text-sm" htmlFor="resposta-atalho">
              Atalho
              <span className="relative mt-1 block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">
                  /
                </span>
                <Input
                  id="resposta-atalho"
                  autoFocus
                  value={edicao.atalho}
                  maxLength={30}
                  className="pl-6"
                  placeholder="pix"
                  onChange={(e) =>
                    setEdicao({
                      ...edicao,
                      atalho: e.target.value.toLowerCase().replace(/\s/g, "-"),
                    })
                  }
                />
              </span>
            </label>
            <label className="block text-sm" htmlFor="resposta-texto">
              Texto
              <Textarea
                id="resposta-texto"
                ref={textoRef}
                className="mt-1"
                rows={5}
                maxLength={LIMITE_TEXTO_RESPOSTA}
                value={edicao.texto}
                placeholder="{saudacao}, {nome}! Nossa chave PIX é…"
                onChange={(e) => setEdicao({ ...edicao, texto: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
              Inserir:
              {VARIAVEIS_RESPOSTA.map((v) => (
                <button
                  key={v.chave}
                  type="button"
                  title={v.ajuda}
                  className="rounded border border-base-200 bg-base-50 px-1.5 py-0.5 font-mono text-[11px] text-purple-800 hover:bg-purple-50"
                  onClick={() => inserirVariavel(v.chave)}
                >
                  {`{${v.chave}}`}
                </button>
              ))}
            </div>
            {edicao.id === null ? (
              <fieldset className="text-sm">
                <legend>Quem pode usar</legend>
                <div className="mt-1 flex flex-wrap gap-4">
                  <label
                    className={`flex items-center gap-1.5 ${podeEquipe ? "" : "text-ink-300"}`}
                    title={podeEquipe ? undefined : "Só supervisor ou gestor cria para a equipe"}
                  >
                    <input
                      type="radio"
                      name="resposta-escopo"
                      disabled={!podeEquipe}
                      checked={edicao.escopo === "equipe"}
                      onChange={() => setEdicao({ ...edicao, escopo: "equipe" })}
                    />
                    Toda a equipe
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="resposta-escopo"
                      checked={edicao.escopo === "pessoal"}
                      onChange={() => setEdicao({ ...edicao, escopo: "pessoal" })}
                    />
                    Só para mim
                  </label>
                </div>
              </fieldset>
            ) : null}
            {erro ? (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={salvar.isPending}
                onClick={() => {
                  setEdicao(null);
                  setErro(null);
                }}
              >
                Voltar à lista
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input
                value={busca}
                className="h-9"
                aria-label="Buscar resposta"
                placeholder="Buscar por atalho ou texto"
                onChange={(e) => setBusca(e.target.value)}
              />
              <Button size="sm" className="h-9 shrink-0" onClick={() => setEdicao(nova())}>
                <Plus aria-hidden />
                Nova
              </Button>
            </div>
            <ul className="min-h-24 flex-1 divide-y divide-base-200 overflow-y-auto rounded-md border border-base-200">
              {lista.isError ? (
                <li role="alert" className="p-3 text-sm text-destructive">
                  {lista.error.message}
                </li>
              ) : lista.isLoading ? (
                <li className="p-3 text-sm text-ink-500">Carregando…</li>
              ) : lista.data?.indisponivel ? (
                <li className="p-3 text-sm text-ink-500">
                  Respostas rápidas ainda não estão disponíveis nesta versão do gateway.
                </li>
              ) : !itens.length ? (
                <li className="p-3 text-sm text-ink-500">
                  {busca ? "Nenhuma resposta encontrada." : "Nenhuma resposta cadastrada ainda."}
                </li>
              ) : (
                itens.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-purple-800">
                          /{r.atalho}
                        </span>
                        <SeloEscopo escopo={r.escopo} />
                        {r.usos ? (
                          <span className="text-[10px] tabular-nums text-ink-500">
                            {r.usos} {r.usos === 1 ? "uso" : "usos"}
                          </span>
                        ) : null}
                      </p>
                      <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-ink-500">
                        {r.texto}
                      </p>
                    </div>
                    {r.editavel ? (
                      apagando === r.id ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            disabled={apagar.isPending}
                            onClick={() => apagar.mutate(r.id)}
                          >
                            Apagar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setApagando(null)}
                          >
                            Manter
                          </Button>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Editar /${r.atalho}`}
                            onClick={() =>
                              setEdicao({
                                id: r.id,
                                atalho: r.atalho,
                                texto: r.texto,
                                escopo: r.escopo,
                              })
                            }
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            aria-label={`Apagar /${r.atalho}`}
                            onClick={() => setApagando(r.id)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </span>
                      )
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
