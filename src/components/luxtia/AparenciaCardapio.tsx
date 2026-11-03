/** A empresa define como o cardápio aparece para o cliente, com prévia ao vivo. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Receipt,
  ShoppingBag,
  Store,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartaoItem } from "@/components/cardapio/CardapioCliente";
import { TopoCardapio } from "@/components/cardapio/TopoCardapio";
import type { ItemCardapio } from "@/lib/cardapio";
import { reais } from "@/lib/cardapio";
import {
  avisosDasCores,
  CORES_PADRAO,
  PALETAS,
  temaDoCardapio,
  type AparenciaCardapio,
} from "@/lib/cardapio-tema";
import {
  enviarImagemAparencia,
  lerAparencia,
  restaurarAparencia,
  salvarAparencia,
  type AparenciaSalva,
} from "@/lib/gateway-aparencia.functions";
import { linkDaLoja, previaCardapio } from "@/lib/gateway-conversas.functions";
import { lerRedes, salvarRedes } from "@/lib/gateway-redes.functions";
import {
  AJUDA_TIPO_REDE,
  itensParaSalvarRedes,
  linhasFixasDasRedes,
  redesAtivasParaExibir,
  ROTULO_TIPO_REDE,
  TIPOS_REDE,
  type RedeAdmin,
  type TipoRede,
} from "@/lib/cardapio-redes";
import { prepararImagem, problemaNaImagem } from "@/lib/imagem-cliente";
import { Switch } from "@/components/ui/switch";
import { RodapeRedes } from "@/components/cardapio/RedesCardapio";
import type { ContextoGateway } from "./Gateway";

type Form = {
  nome_exibicao: string;
  slogan: string;
  cor_primaria: string;
  cor_destaque: string;
  cor_fundo: string;
  cantos: AparenciaCardapio["cantos"];
  titulos: AparenciaCardapio["titulos"];
  logo_id: string | null;
  logo_url: string | null;
  banner_id: string | null;
  banner_url: string | null;
  banner_foco: number;
};

const VAZIO: Form = {
  nome_exibicao: "",
  slogan: "",
  ...CORES_PADRAO,
  cantos: "suave",
  titulos: "classica",
  logo_id: null,
  logo_url: null,
  banner_id: null,
  banner_url: null,
  banner_foco: 50,
};

const DESCARTAR = "Descartar as alterações não salvas?";
const corValida = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);

function doServidor(a: AparenciaSalva | null): Form {
  if (!a) return VAZIO;
  return {
    nome_exibicao: a.nome_exibicao ?? "",
    slogan: a.slogan ?? "",
    cor_primaria: a.cor_primaria,
    cor_destaque: a.cor_destaque,
    cor_fundo: a.cor_fundo,
    cantos: a.cantos,
    titulos: a.titulos,
    logo_id: a.logo_id,
    logo_url: a.logo_url,
    banner_id: a.banner_id,
    banner_url: a.banner_url,
    banner_foco: a.banner_foco,
  };
}

const semUrl = ({ logo_url: _l, banner_url: _b, ...resto }: Form) => JSON.stringify(resto);

export function AparenciaCardapioTela({ ctx }: { ctx: ContextoGateway }) {
  const cache = useQueryClient();
  const ler = useServerFn(lerAparencia);
  const salvar = useServerFn(salvarAparencia);
  const restaurar = useServerFn(restaurarAparencia);
  const enviar = useServerFn(enviarImagemAparencia);
  const pedirPrevia = useServerFn(previaCardapio);
  const chave = ["cardapio-aparencia", ctx.empresa];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => ler({ data: { empresa: ctx.empresa } }),
    refetchOnWindowFocus: false,
  });
  const [form, setForm] = useState<Form>(VAZIO);
  const [base, setBase] = useState<Form>(VAZIO);
  const [enviando, setEnviando] = useState<"logo" | "banner" | null>(null);
  const [confirmarPadrao, setConfirmarPadrao] = useState(false);
  const [redesPrevia, setRedesPrevia] = useState<RedeAdmin[]>(() => linhasFixasDasRedes([]));
  const aoMudarRedes = useCallback((itens: RedeAdmin[]) => setRedesPrevia(itens), []);
  const carregado = useRef(false);

  useEffect(() => {
    if (!q.data || carregado.current) return;
    carregado.current = true;
    const f = doServidor(q.data.aparencia);
    setForm(f);
    setBase(f);
  }, [q.data]);

  const sujo = semUrl(form) !== semUrl(base);
  const coresOk = [form.cor_primaria, form.cor_destaque, form.cor_fundo].every(corValida);
  useBlocker({
    shouldBlockFn: () => sujo && !window.confirm(DESCARTAR),
    enableBeforeUnload: () => sujo,
  });
  const mudar = (parte: Partial<Form>) => setForm((f) => ({ ...f, ...parte }));

  const gravar = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          empresa: ctx.empresa,
          nome_exibicao: form.nome_exibicao.trim() || null,
          slogan: form.slogan.trim() || null,
          cor_primaria: form.cor_primaria,
          cor_destaque: form.cor_destaque,
          cor_fundo: form.cor_fundo,
          cantos: form.cantos,
          titulos: form.titulos,
          logo_id: form.logo_id,
          banner_id: form.banner_id,
          banner_foco: form.banner_foco,
        },
      }),
    onSuccess: (r) => {
      // A imagem pode ter sido apagada em outra aba ou pelo Restaurar padrão: só ela sai do formulário.
      if ("imagem_ausente" in r) {
        mudar(
          r.imagem_ausente === "logo_id"
            ? { logo_id: null, logo_url: null }
            : { banner_id: null, banner_url: null },
        );
        toast.error("Uma imagem não existe mais. Envie de novo e salve.");
        return;
      }
      const f = doServidor(r.aparencia);
      setForm(f);
      setBase(f);
      void cache.invalidateQueries({ queryKey: chave });
      toast.success("Aparência salva. O cardápio já está assim para os clientes.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const padrao = useMutation({
    mutationFn: () => restaurar({ data: { empresa: ctx.empresa } }),
    onSuccess: () => {
      setForm(VAZIO);
      setBase(VAZIO);
      setConfirmarPadrao(false);
      void cache.invalidateQueries({ queryKey: chave });
      toast.success("Visual padrão restaurado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function escolherImagem(tipo: "logo" | "banner", arquivo: File) {
    const problema = problemaNaImagem(arquivo);
    if (problema) {
      toast.error(problema);
      return;
    }
    setEnviando(tipo);
    try {
      const pronta = await prepararImagem(
        arquivo,
        tipo === "logo" ? { largura: 512, altura: 512 } : { largura: 1800, altura: 1200 },
      );
      const minimo = tipo === "logo" ? 256 : 1000;
      if (pronta.largura < minimo) {
        toast.warning(
          `Imagem pequena (${pronta.largura} px de largura): pode ficar sem nitidez. O ideal é ter ${minimo} px ou mais.`,
        );
      }
      const r = await enviar({ data: { empresa: ctx.empresa, tipo, conteudo: pronta.base64 } });
      mudar(
        tipo === "logo"
          ? { logo_id: r.id, logo_url: pronta.url }
          : { banner_id: r.id, banner_url: pronta.url },
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  function abrirPrevia() {
    const aba = window.open("", "_blank");
    pedirPrevia({ data: { empresa: ctx.empresa } }).then(
      (r) => {
        if (aba) aba.location.href = r.url;
      },
      (e: Error) => {
        aba?.close();
        toast.error(e.message);
      },
    );
  }

  if (q.isPending) return <p className="p-4 text-sm text-ink-500">Carregando…</p>;
  if (q.isError) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {q.error.message}
      </p>
    );
  }

  const avisos = coresOk ? avisosDasCores(form) : [];
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 px-3 py-1.5">
        <p className="min-w-0 flex-1 truncate text-xs text-ink-500">
          {sujo ? "Alterações não salvas" : "Assim o cliente vê o cardápio pelo link."}
        </p>
        <Button variant="ghost" size="sm" onClick={abrirPrevia}>
          <ExternalLink className="size-3.5" aria-hidden /> Prévia (não envia pedido)
        </Button>
        {q.data?.aparencia ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmarPadrao(true)}>
            Restaurar padrão
          </Button>
        ) : null}
        {sujo ? (
          <Button variant="ghost" size="sm" onClick={() => setForm(base)}>
            Desfazer
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!sujo || !coresOk || gravar.isPending || enviando !== null}
          onClick={() => gravar.mutate()}
        >
          {gravar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        <div className="min-w-0 lg:overflow-y-auto">
          <LinkDaLoja empresa={ctx.empresa} />

          <Secao titulo="Identidade">
            <Linha titulo="Nome no cardápio" ajuda="Vazio: usa o nome da empresa.">
              <Input
                className="h-9"
                maxLength={60}
                aria-label="Nome no cardápio"
                value={form.nome_exibicao}
                onChange={(e) => mudar({ nome_exibicao: e.target.value })}
              />
            </Linha>
            <Linha titulo="Frase" ajuda="Aparece abaixo do nome. Até 120 caracteres.">
              <Input
                className="h-9"
                maxLength={120}
                aria-label="Frase"
                placeholder="Ex.: Sushi feito na hora"
                value={form.slogan}
                onChange={(e) => mudar({ slogan: e.target.value })}
              />
            </Linha>
          </Secao>

          <Secao titulo="Imagens">
            <Linha
              titulo="Logo"
              ajuda="Quadrada, com 512 px ou mais. PNG com fundo transparente fica melhor."
            >
              <CampoImagem
                rotulo="logo"
                url={form.logo_url}
                proporcao="aspect-square w-24"
                ajuste="object-contain"
                larguraIdeal={256}
                enviando={enviando === "logo"}
                escolher={(f) => void escolherImagem("logo", f)}
                remover={() => mudar({ logo_id: null, logo_url: null })}
              />
            </Linha>
            <Linha
              titulo="Banner"
              ajuda="Foto larga, com 1600 px ou mais. Vai no topo, atrás do nome."
            >
              <CampoImagem
                rotulo="banner"
                url={form.banner_url}
                proporcao="aspect-[16/7] w-full max-w-md"
                ajuste="object-cover"
                larguraIdeal={1000}
                foco={form.banner_foco}
                enviando={enviando === "banner"}
                escolher={(f) => void escolherImagem("banner", f)}
                remover={() => mudar({ banner_id: null, banner_url: null })}
              />
              {form.banner_url ? (
                <label className="mt-2 block max-w-md text-xs text-ink-700">
                  Parte da foto em destaque
                  <input
                    type="range"
                    min={0}
                    max={100}
                    aria-label="Parte da foto em destaque"
                    value={form.banner_foco}
                    onChange={(e) => mudar({ banner_foco: Number(e.target.value) })}
                    className="mt-1 block w-full accent-purple-700"
                  />
                </label>
              ) : null}
            </Linha>
          </Secao>

          <Secao titulo="Cores">
            <Linha titulo="Paletas prontas" ajuda="Um ponto de partida: depois é só ajustar.">
              <div className="flex flex-wrap gap-1.5">
                {PALETAS.map((p) => {
                  const ativa =
                    p.cor_primaria === form.cor_primaria &&
                    p.cor_destaque === form.cor_destaque &&
                    p.cor_fundo === form.cor_fundo;
                  return (
                    <button
                      key={p.nome}
                      type="button"
                      aria-pressed={ativa}
                      onClick={() =>
                        mudar({
                          cor_primaria: p.cor_primaria,
                          cor_destaque: p.cor_destaque,
                          cor_fundo: p.cor_fundo,
                        })
                      }
                      className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors ${ativa ? "border-purple-700 bg-purple-50 font-medium" : "border-base-200 hover:border-purple-300"}`}
                    >
                      <span className="flex" aria-hidden>
                        {[p.cor_primaria, p.cor_destaque, p.cor_fundo].map((c) => (
                          <span
                            key={c}
                            className="-ml-1 size-4 rounded-full border border-white first:ml-0"
                            style={{ background: c }}
                          />
                        ))}
                      </span>
                      {p.nome}
                    </button>
                  );
                })}
              </div>
            </Linha>
            <Linha titulo="Cor principal" ajuda="Topo, botões e categoria selecionada.">
              <CampoCor
                nome="Cor principal"
                valor={form.cor_primaria}
                mudar={(c) => mudar({ cor_primaria: c })}
              />
            </Linha>
            <Linha titulo="Cor de destaque" ajuda="Contador do pedido e pequenos detalhes.">
              <CampoCor
                nome="Cor de destaque"
                valor={form.cor_destaque}
                mudar={(c) => mudar({ cor_destaque: c })}
              />
            </Linha>
            <Linha
              titulo="Cor de fundo"
              ajuda="Fundo escuro deixa a página inteira em modo escuro."
            >
              <CampoCor
                nome="Cor de fundo"
                valor={form.cor_fundo}
                mudar={(c) => mudar({ cor_fundo: c })}
              />
            </Linha>
            {avisos.length ? (
              <p className="flex items-start gap-2 border-b border-base-200/70 bg-gold-300/20 px-4 py-2 text-sm text-gold-700">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {avisos.includes("primaria_igual_fundo")
                  ? "A cor principal está muito parecida com o fundo: os botões vão perder destaque."
                  : "A cor de destaque está muito parecida com a principal: o contador vai sumir no botão."}
              </p>
            ) : null}
          </Secao>

          <Secao titulo="Estilo">
            <Linha titulo="Cantos">
              <Segmentos
                nome="Cantos"
                valor={form.cantos}
                mudar={(cantos) => mudar({ cantos })}
                opcoes={[
                  ["retos", "Retos"],
                  ["suave", "Suaves"],
                  ["arredondado", "Bem arredondados"],
                ]}
              />
            </Linha>
            <Linha titulo="Títulos">
              <Segmentos
                nome="Títulos"
                valor={form.titulos}
                mudar={(titulos) => mudar({ titulos })}
                opcoes={[
                  ["classica", "Clássicos"],
                  ["moderna", "Modernos"],
                ]}
              />
            </Linha>
          </Secao>

          <RedesEContato empresa={ctx.empresa} onPrevia={aoMudarRedes} />
        </div>

        <aside
          aria-label="Prévia"
          className="flex justify-center border-base-200 bg-base-100 p-4 max-lg:border-t lg:overflow-y-auto lg:border-l"
        >
          <Vitrine form={form} redes={redesPrevia} />
        </aside>
      </div>

      <AlertDialog
        open={confirmarPadrao}
        onOpenChange={(a) => !padrao.isPending && setConfirmarPadrao(a)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar o visual padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga o logo, o banner e as cores da empresa. O cardápio dos clientes muda na hora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={padrao.isPending}
              onClick={(e) => {
                e.preventDefault();
                padrao.mutate();
              }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** CARD-REDES: três linhas fixas; salva em rota própria para não misturar com as cores. */
function RedesEContato({
  empresa,
  onPrevia,
}: {
  empresa: ContextoGateway["empresa"];
  onPrevia: (itens: RedeAdmin[]) => void;
}) {
  const cache = useQueryClient();
  const ler = useServerFn(lerRedes);
  const salvar = useServerFn(salvarRedes);
  const chave = ["cardapio-redes", empresa];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => ler({ data: { empresa } }),
    refetchOnWindowFocus: false,
  });
  const [linhas, setLinhas] = useState<RedeAdmin[]>(() => linhasFixasDasRedes([]));
  const [base, setBase] = useState<RedeAdmin[]>(() => linhasFixasDasRedes([]));
  const [erros, setErros] = useState<Partial<Record<TipoRede, string>>>({});
  const carregado = useRef(false);

  useEffect(() => {
    if (!q.data || carregado.current) return;
    carregado.current = true;
    const fixas = linhasFixasDasRedes(q.data.itens);
    setLinhas(fixas);
    setBase(fixas);
  }, [q.data]);

  useEffect(() => {
    onPrevia(linhas);
  }, [linhas, onPrevia]);

  const sujo = JSON.stringify(linhas) !== JSON.stringify(base);

  const gravar = useMutation({
    mutationFn: () =>
      salvar({
        data: { empresa, itens: itensParaSalvarRedes(linhas) },
      }),
    onSuccess: (r) => {
      if (r && typeof r === "object" && "ok" in r && r.ok === false) {
        const proximo: Partial<Record<TipoRede, string>> = {};
        if (r.tipo) proximo[r.tipo] = r.mensagem;
        setErros(proximo);
        toast.error(r.mensagem);
        return;
      }
      const fixas = linhasFixasDasRedes(r.itens);
      setLinhas(fixas);
      setBase(fixas);
      setErros({});
      void cache.invalidateQueries({ queryKey: chave });
      toast.success("Redes salvas. O cardápio já mostra para os clientes.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function mudarLinha(tipo: TipoRede, parte: Partial<Pick<RedeAdmin, "valor" | "ativo">>) {
    setErros((e) => {
      if (!e[tipo]) return e;
      const { [tipo]: _, ...resto } = e;
      return resto;
    });
    setLinhas((atual) => atual.map((l) => (l.tipo === tipo ? { ...l, ...parte } : l)));
  }

  return (
    <Secao titulo="Redes e contato">
      <p className="border-b border-base-200/70 px-4 py-2 text-sm text-ink-500">
        Opcional. Aparece no cardápio de todas as unidades. Campo vazio não é mostrado.
      </p>
      {TIPOS_REDE.map((tipo) => {
        const linha = linhas.find((l) => l.tipo === tipo)!;
        const erro = erros[tipo];
        return (
          <div
            key={tipo}
            className="grid gap-x-6 gap-y-1.5 border-b border-base-200/70 px-4 py-2.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">{ROTULO_TIPO_REDE[tipo]}</p>
              <p className="mt-0.5 text-xs text-ink-500">{AJUDA_TIPO_REDE[tipo]}</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Input
                className="h-9 min-w-0 flex-1"
                aria-label={ROTULO_TIPO_REDE[tipo]}
                aria-invalid={Boolean(erro)}
                placeholder={AJUDA_TIPO_REDE[tipo]}
                value={linha.valor}
                onChange={(e) => mudarLinha(tipo, { valor: e.target.value })}
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-700">
                <Switch
                  checked={linha.ativo}
                  disabled={!linha.valor.trim()}
                  aria-label={`${ROTULO_TIPO_REDE[tipo]}: mostrar no cardápio`}
                  onCheckedChange={(ativo) => mudarLinha(tipo, { ativo })}
                />
                Mostrar
              </label>
              {erro ? (
                <p role="alert" className="w-full text-xs text-destructive">
                  {erro}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="flex justify-end gap-2 px-4 py-2">
        {sujo ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLinhas(base);
              setErros({});
            }}
          >
            Desfazer
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={!sujo || gravar.isPending}
          onClick={() => gravar.mutate()}
        >
          {gravar.isPending ? "Salvando…" : "Salvar redes"}
        </Button>
      </div>
    </Secao>
  );
}

/** O link que a loja divulga: é por ele que o cliente pede sem ter uma conversa aberta. */
function LinkDaLoja({ empresa }: { empresa: ContextoGateway["empresa"] }) {
  const cache = useQueryClient();
  const pedir = useServerFn(linkDaLoja);
  const chave = ["cardapio-link-loja", empresa];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => pedir({ data: { empresa } }),
    refetchOnWindowFocus: false,
    retry: false,
  });
  const trocar = useMutation({
    mutationFn: () => pedir({ data: { empresa, renovar: true } }),
    onSuccess: (dados) => {
      cache.setQueryData(chave, dados);
      toast.success("Link trocado. O anterior não abre mais.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const url = q.data?.url;
  return (
    <Secao titulo="Link da loja">
      <div className="space-y-2 px-4 py-3">
        <p className="text-sm text-ink-500">
          Coloque na bio e nas redes. O cliente monta o pedido e finaliza pelo WhatsApp.
        </p>
        {q.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível gerar o link. Confira o endereço público do painel no gateway.
          </p>
        ) : (
          <>
            <Input
              readOnly
              aria-label="Endereço do link da loja"
              value={url ?? "Gerando…"}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={!url}
                onClick={() =>
                  url &&
                  navigator.clipboard.writeText(url).then(
                    () => toast.success("Link copiado."),
                    () => toast.error("Não foi possível copiar. Selecione o link e copie."),
                  )
                }
              >
                <Copy className="size-3.5" aria-hidden /> Copiar
              </Button>
              <Button
                size="sm"
                disabled={!url}
                onClick={() => url && window.open(url, "_blank", "noopener")}
              >
                <ExternalLink className="size-3.5" aria-hidden /> Abrir e fazer pedido
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!url || trocar.isPending}
                onClick={() => {
                  if (window.confirm("Trocar o link? O atual deixa de abrir para todos.")) {
                    trocar.mutate();
                  }
                }}
              >
                Trocar link
              </Button>
            </div>
          </>
        )}
        {q.data && !q.data.whatsapp_conectado ? (
          <p className="flex items-start gap-2 rounded-lg bg-gold-300/20 p-2 text-sm text-ink-700">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Conecte um WhatsApp ativo em Canais. Sem ele, o cliente monta o pedido, mas não consegue
            finalizar.
          </p>
        ) : null}
      </div>
    </Secao>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo}>
      <h2 className="sticky top-0 z-10 border-b border-base-200 bg-card/95 px-4 py-1.5 text-sm font-medium text-ink-900 backdrop-blur">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Linha({
  titulo,
  ajuda,
  children,
}: {
  titulo: string;
  ajuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-6 gap-y-1.5 border-b border-base-200/70 px-4 py-2.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{titulo}</p>
        {ajuda ? <p className="mt-0.5 text-xs text-ink-500">{ajuda}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CampoCor({
  nome,
  valor,
  mudar,
}: {
  nome: string;
  valor: string;
  mudar: (cor: string) => void;
}) {
  const valida = corValida(valor);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${nome}: escolher`}
        value={valida ? valor : "#000000"}
        onChange={(e) => mudar(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-md border border-base-200 bg-card p-0.5"
      />
      <Input
        aria-label={`${nome}: código`}
        aria-invalid={!valida}
        maxLength={7}
        spellCheck={false}
        value={valor}
        onChange={(e) => mudar(e.target.value.trim())}
        className="h-9 w-28 font-mono text-sm uppercase"
      />
      {!valida ? <span className="text-xs text-destructive">Use o formato #RRGGBB</span> : null}
    </div>
  );
}

function Segmentos<T extends string>({
  nome,
  valor,
  mudar,
  opcoes,
}: {
  nome: string;
  valor: T;
  mudar: (v: T) => void;
  opcoes: [T, string][];
}) {
  return (
    <div role="radiogroup" aria-label={nome} className="flex flex-wrap gap-1.5">
      {opcoes.map(([id, rotulo]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={valor === id}
          onClick={() => mudar(id)}
          className={`min-h-9 rounded-md border px-3 text-sm transition-colors ${valor === id ? "border-purple-700 bg-purple-50 font-medium text-purple-800" : "border-base-200 text-ink-700 hover:border-purple-300"}`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

function CampoImagem({
  rotulo,
  url,
  proporcao,
  ajuste,
  foco,
  larguraIdeal,
  enviando,
  escolher,
  remover,
}: {
  rotulo: string;
  url: string | null;
  proporcao: string;
  ajuste: string;
  foco?: number;
  larguraIdeal: number;
  enviando: boolean;
  escolher: (arquivo: File) => void;
  remover: () => void;
}) {
  // Lê da própria imagem: vale também para a que já estava salva.
  const [largura, setLargura] = useState<number | null>(null);
  const pequena = url !== null && largura !== null && largura < larguraIdeal;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label
        className={`relative flex ${proporcao} cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-base-200 bg-base-50 transition-colors hover:border-purple-400 focus-within:ring-2 focus-within:ring-ring`}
      >
        {url ? (
          <img
            src={url}
            alt=""
            className={`size-full ${ajuste}`}
            style={foco !== undefined ? { objectPosition: `50% ${foco}%` } : undefined}
            onLoad={(e) => setLargura(e.currentTarget.naturalWidth)}
          />
        ) : (
          <span className="flex flex-col items-center gap-1 p-2 text-center text-xs text-ink-500">
            <ImagePlus className="size-5" aria-hidden />
            Enviar {rotulo}
          </span>
        )}
        {enviando ? (
          <span className="absolute inset-0 flex items-center justify-center bg-card/70">
            <Loader2 className="size-5 animate-spin text-purple-700" aria-label="Enviando" />
          </span>
        ) : null}
        {/* Cobre a área inteira: clicar e arrastar o arquivo funcionam pelo próprio campo. */}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={`Enviar ${rotulo}`}
          disabled={enviando}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) escolher(arquivo);
          }}
        />
      </label>
      {url ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-ink-500"
          aria-label={`Remover ${rotulo}`}
          onClick={remover}
        >
          <Trash2 className="size-3.5" aria-hidden /> Remover
        </Button>
      ) : null}
      {pequena ? (
        <p className="flex w-full items-start gap-1.5 text-xs text-gold-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Imagem pequena ({largura} px de largura): vai ficar borrada. Use {larguraIdeal} px ou
          mais.
        </p>
      ) : null}
    </div>
  );
}

const EXEMPLOS: ItemCardapio[] = [
  {
    item_id: 1,
    nome: "Prato da casa",
    descricao: "É assim que seus itens aparecem",
    preco: 39.9,
    alcoolico: false,
    disponivel: true,
    aviso: null,
    grupos: [],
  },
  {
    item_id: 2,
    nome: "Outro item",
    descricao: "Com descrição curta",
    preco: 24.5,
    alcoolico: false,
    disponivel: true,
    aviso: null,
    grupos: [],
  },
];

/** Usa as mesmas peças da página do cliente, para a prévia não enganar. */
function Vitrine({ form, redes }: { form: Form; redes: RedeAdmin[] }) {
  const cores = {
    cor_primaria: corValida(form.cor_primaria) ? form.cor_primaria : CORES_PADRAO.cor_primaria,
    cor_destaque: corValida(form.cor_destaque) ? form.cor_destaque : CORES_PADRAO.cor_destaque,
    cor_fundo: corValida(form.cor_fundo) ? form.cor_fundo : CORES_PADRAO.cor_fundo,
  };
  const tema = temaDoCardapio({
    ...cores,
    nome_exibicao: null,
    slogan: null,
    cantos: form.cantos,
    titulos: form.titulos,
    logo_url: form.logo_url,
    banner_url: form.banner_url,
    banner_foco: form.banner_foco,
  });
  const nome = form.nome_exibicao.trim() || "Sua empresa";
  const redesAtivas = redesAtivasParaExibir(redes);
  return (
    <div className="h-[640px] w-[320px] shrink-0 overflow-hidden rounded-[2.25rem] border-[7px] border-ink-900 bg-ink-900 shadow-xl lg:sticky lg:top-0">
      <div
        style={tema.estilo}
        className={`relative h-full overflow-y-auto overflow-x-hidden bg-base-100 pb-20 text-ink-900 ${tema.classe}`}
      >
        <TopoCardapio
          nome={nome}
          slogan={form.slogan.trim() || null}
          unidade="Unidade Centro"
          aberta
          podeTrocar={false}
          logoUrl={form.logo_url}
          bannerUrl={form.banner_url}
          bannerFoco={form.banner_foco}
          infos={[
            { icone: Bike, titulo: "Entrega", valor: reais(7) },
            { icone: Store, titulo: "Retirada", valor: "Sem taxa" },
            { icone: Receipt, titulo: "Mínimo", valor: reais(30) },
          ]}
          redes={redesAtivas}
        />
        <div className="flex gap-1.5 overflow-hidden px-4 py-3">
          <span className="shrink-0 rounded-full bg-purple-800 px-3.5 py-1.5 text-sm font-medium text-[var(--cd-sobre)]">
            Mais pedidos
          </span>
          <span className="shrink-0 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium text-ink-700 ring-1 ring-base-200">
            Bebidas
          </span>
        </div>
        <div className="px-4">
          <p className="pb-2 font-display text-xl text-[var(--cd-marca)]">Mais pedidos</p>
          <ul className="grid gap-2">
            <CartaoItem
              item={EXEMPLOS[0]!}
              quantidade={1}
              abrir={() => undefined}
              somar={() => undefined}
              tirar={() => undefined}
            />
            <CartaoItem
              item={EXEMPLOS[1]!}
              quantidade={0}
              abrir={() => undefined}
              somar={() => undefined}
              tirar={() => undefined}
            />
          </ul>
        </div>
        <RodapeRedes redes={redesAtivas} empresa={nome} />
        <div className="sticky bottom-3 mx-3 mt-4 flex h-14 items-center gap-3 rounded-2xl bg-purple-800 px-4 text-base font-semibold text-[var(--cd-sobre)] shadow-lg">
          <span className="relative">
            <ShoppingBag className="size-5" aria-hidden />
            <span className="absolute -right-2.5 -top-2.5 flex size-5 items-center justify-center rounded-full bg-[var(--cd-destaque)] text-[11px] font-bold text-[var(--cd-sobre-destaque)]">
              1
            </span>
          </span>
          <span className="ml-1">Ver pedido</span>
          <span className="ml-auto tabular-nums">{reais(39.9)}</span>
        </div>
      </div>
    </div>
  );
}
