import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pedidos } from "@/lib/gateway-pedidos.functions";
import { textoPagamento, type ContagemPedidos, type PedidoLista } from "@/lib/gateway/pedidos";
import type { PapelGateway } from "@/lib/gateway/tipos";
import { somPedidoLigado, tocarPedidoNovo } from "@/lib/pedidos-som";

const CHAVE_EMPRESA = "luxtia:gateway-empresa";

export function ContadorPedidos({ papel }: { papel: PapelGateway | null | undefined }) {
  const fn = useServerFn(pedidos);
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("local");
  const visto = useRef<number | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) setUsuario(data.session.user.id);
    });
  }, []);
  useEffect(() => {
    const ler = () => setEmpresa(papel === "plataforma" ? localStorage.getItem(CHAVE_EMPRESA) : "");
    ler();
    window.addEventListener("luxtia:empresa", ler);
    return () => window.removeEventListener("luxtia:empresa", ler);
  }, [papel]);
  const empresaEfetiva = papel === "plataforma" ? empresa : "vinculada";
  const q = useQuery({
    queryKey: ["pedidos", empresaEfetiva, "contagem"],
    enabled: Boolean(papel) && (papel !== "plataforma" || Boolean(empresa)),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // Conta todo pedido aguardando a loja. Em piloto o pedido nasce como
      // "piloto", então filtrar só "real" deixava o aviso em zero.
      const r = await fn({
        data: {
          acao: "contagem",
          empresa: papel === "plataforma" ? empresa : null,
        },
      });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as ContagemPedidos;
    },
  });
  const total = q.data?.aguardando_loja.total ?? 0;
  useEffect(() => {
    if (!q.isSuccess) return;
    const anterior = visto.current;
    visto.current = total;
    if (anterior === null || total <= anterior) return;
    if (somPedidoLigado(usuario)) tocarPedidoNovo();
    const empresaAviso = papel === "plataforma" ? empresa : null;
    void fn({
      data: {
        acao: "listar",
        empresa: empresaAviso,
        status: ["aguardando_loja"],
        limite: 1,
      },
    })
      .then((r) => {
        const item = r.ok ? (r.dados as { itens?: PedidoLista[] }).itens?.[0] : undefined;
        const numero = item?.numero ? ` #${item.numero}` : "";
        toast.message(`Novo pedido${numero} · ${textoPagamento(item?.pagamento)}`);
      })
      .catch(() => {
        toast.message("Novo pedido");
      });
  }, [q.dataUpdatedAt, q.isSuccess, total, usuario, papel, empresa, fn]);
  if (!q.isSuccess || total <= 0) return null;
  return (
    <span
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-gold-500 px-1.5 text-[11px] font-semibold text-purple-900"
      aria-label={`${total} pedidos aguardando a loja`}
    >
      {total}
    </span>
  );
}
