/** Impressão na cozinha: preferências do aparelho e impressão automática dos pedidos que chegam. */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { pedidos } from "@/lib/gateway-pedidos.functions";
import type { PedidoDetalhe, PedidoLista } from "@/lib/gateway/pedidos";
import {
  EVENTO_IMPRESSAO,
  PREF_IMPRESSAO_PADRAO,
  STATUS_DA_IMPRESSAO,
  gravarImpressos,
  gravarPrefImpressao,
  imprimirPedido,
  lerImpressos,
  lerPrefImpressao,
  paraImprimir,
  reiniciarImpressos,
  type PrefImpressao,
} from "@/lib/impressao-pedido";
import type { ContextoGateway } from "./Gateway";

const INTERVALO_MS = 10_000;

/** Preferência de impressão deste aparelho, atualizada quando outra parte da tela muda. */
function usePrefImpressao(empresa: string) {
  const [pref, setPref] = useState<PrefImpressao>(PREF_IMPRESSAO_PADRAO);
  useEffect(() => {
    const ler = () => setPref(lerPrefImpressao(empresa));
    ler();
    window.addEventListener(EVENTO_IMPRESSAO, ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener(EVENTO_IMPRESSAO, ler);
      window.removeEventListener("storage", ler);
    };
  }, [empresa]);
  return pref;
}

/** Com várias abas abertas, só uma imprime: a que segura a trava. Fechada, outra assume. */
function useLider(ativo: boolean) {
  const [lider, setLider] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    if (!("locks" in navigator)) {
      setLider(true);
      return () => setLider(false);
    }
    const controle = new AbortController();
    let soltar: (() => void) | undefined;
    navigator.locks
      .request("luxtia:impressao-pedidos", { signal: controle.signal }, () => {
        setLider(true);
        return new Promise<void>((r) => {
          soltar = r;
        });
      })
      .catch(() => undefined);
    return () => {
      controle.abort();
      soltar?.();
      setLider(false);
    };
  }, [ativo]);
  return lider;
}

function Opcoes<T extends string | number>({
  rotulo,
  valor,
  opcoes,
  mudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: [T, string][];
  mudar: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-700">{rotulo}</p>
      <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-2 gap-1">
        {opcoes.map(([v, texto]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={valor === v}
            onClick={() => mudar(v)}
            className={`rounded-md border px-2 py-1.5 text-xs ${
              valor === v
                ? "border-purple-800 bg-purple-50 font-medium text-purple-900"
                : "border-base-200 text-ink-700 hover:bg-base-100"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

const TESTE: PedidoDetalhe = {
  id: 0,
  numero: "0000",
  status: "aguardando_loja",
  modalidade: "delivery",
  unidade: null,
  unidade_nome: "Teste de impressão",
  origem: "teste",
  cliente: { nome: "Cliente Teste", telefone: null, canal: null },
  conversation_id: null,
  numero_itens: 2,
  total: 72,
  previsao_min: null,
  criado_em: new Date().toISOString(),
  atualizado_em: null,
  horario: null,
  aviso: null,
  pagamento: { forma: "dinheiro", rotulo: "Dinheiro", troco_para: 100, troco: 28 },
  itens: [
    {
      codigo: "T1",
      nome: "Temaki salmão",
      quantidade: 2,
      preco_unitario: 30,
      subtotal: 60,
      observacao: "sem cebolinha",
      alcoolico: false,
      opcoes: [
        { grupo: "Tamanho", opcao: "Grande", quantidade: 1 },
        { grupo: "Adicionais", opcao: "Cream cheese", quantidade: 2 },
      ],
    },
  ],
  subtotal: 60,
  taxa_entrega: 12,
  observacao: "Tocar o interfone",
  endereco: "Rua Exemplo, 100 - Centro",
  motivo: null,
  status_descricao: null,
  entrega: null,
  proximos_status: [],
  linha_do_tempo: [],
};

export function ImpressaoPedidos({ ctx, fuso }: { ctx: ContextoGateway; fuso: string }) {
  const empresa = ctx.empresa ?? "vinculada";
  const pref = usePrefImpressao(empresa);
  const lider = useLider(pref.automatica);
  const fn = useServerFn(pedidos);
  const ocupado = useRef(false);
  const mudar = (parte: Partial<PrefImpressao>) => {
    const nova = { ...pref, ...parte };
    // Ligar ou trocar o momento começa do zero: pedido antigo não sai impresso de repente.
    if (nova.automatica && (!pref.automatica || nova.quando !== pref.quando)) {
      reiniciarImpressos(empresa, nova.quando);
    }
    gravarPrefImpressao(empresa, nova);
  };

  const fila = useQuery({
    queryKey: ["pedidos", empresa, "impressao", pref.quando],
    enabled: pref.automatica && lider,
    refetchInterval: INTERVALO_MS,
    // A cozinha costuma deixar a tela atrás de outra janela.
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const r = await fn({
        data: {
          acao: "listar",
          empresa: ctx.empresa,
          status: STATUS_DA_IMPRESSAO[pref.quando],
          limite: 50,
        },
      });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return (r.dados as { itens?: PedidoLista[] }).itens ?? [];
    },
  });

  useEffect(() => {
    const lista = fila.data;
    if (!lista || !pref.automatica || !lider || ocupado.current) return;
    const impressos = lerImpressos(empresa, pref.quando);
    if (impressos === null) {
      gravarImpressos(
        empresa,
        pref.quando,
        lista.map((p) => p.numero),
      );
      return;
    }
    const novos = paraImprimir(lista, impressos);
    if (!novos.length) return;
    ocupado.current = true;
    void (async () => {
      const feitos = [...impressos];
      for (const numero of novos) {
        // Marca antes: um erro de impressora não pode virar o mesmo cupom em todas as voltas.
        feitos.push(numero);
        gravarImpressos(empresa, pref.quando, feitos);
        try {
          const r = await fn({ data: { acao: "detalhe", empresa: ctx.empresa, numero } });
          if (!r.ok) throw new Error(r.erro.mensagem);
          await imprimirPedido(r.dados as PedidoDetalhe, pref, { fuso });
          toast.message(`Pedido #${numero} enviado para a impressora.`);
        } catch {
          toast.error(`Não foi possível imprimir o pedido #${numero}. Abra o pedido e imprima.`);
        }
      }
      ocupado.current = false;
    })();
    // A cada leitura, mesmo com a mesma lista: a que chegou durante uma impressão não fica para trás.
  }, [fila.data, fila.dataUpdatedAt, pref, lider, empresa, ctx.empresa, fn, fuso]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          title={pref.automatica ? "Impressão automática ligada" : "Impressão na cozinha"}
        >
          <Printer
            className={`size-3.5 ${pref.automatica ? "text-purple-800" : "text-ink-500"}`}
            aria-hidden
          />
          <span className="sr-only">Impressão na cozinha</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">Impressão na cozinha</p>
          <p className="text-xs text-ink-500">Vale só para este computador.</p>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          Imprimir pedidos automaticamente
          <Switch checked={pref.automatica} onCheckedChange={(v) => mudar({ automatica: v })} />
        </label>
        <Opcoes
          rotulo="Quando imprimir"
          valor={pref.quando}
          opcoes={[
            ["chegar", "Ao chegar"],
            ["confirmar", "Ao confirmar"],
          ]}
          mudar={(quando) => mudar({ quando })}
        />
        <Opcoes
          rotulo="Papel"
          valor={pref.largura}
          opcoes={[
            [80, "80 mm"],
            [58, "58 mm"],
          ]}
          mudar={(largura) => mudar({ largura })}
        />
        <Opcoes
          rotulo="Vias"
          valor={pref.vias}
          opcoes={[
            [1, "1 via"],
            [2, "2 vias"],
          ]}
          mudar={(vias) => mudar({ vias })}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void imprimirPedido(TESTE, pref, { fuso })}
        >
          <Printer className="size-3.5" aria-hidden /> Imprimir um teste
        </Button>
        {pref.automatica ? (
          <p className="text-xs text-ink-500">
            {lider
              ? "Deixe esta tela aberta. Cada pedido novo sai impresso em até 10 segundos."
              : "Outra aba deste computador já está imprimindo."}
          </p>
        ) : null}
        <p className="text-xs text-ink-500">
          Para imprimir sem a janela de confirmação, abra o Chrome com a opção{" "}
          <code className="rounded bg-base-100 px-1">--kiosk-printing</code> e deixe a térmica como
          impressora padrão.
        </p>
      </PopoverContent>
    </Popover>
  );
}
