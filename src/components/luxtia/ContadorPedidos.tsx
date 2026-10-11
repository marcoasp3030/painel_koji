import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { pedidos } from "@/lib/gateway-pedidos.functions";
import type { ContagemPedidos } from "@/lib/gateway/pedidos";
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
      const r = await fn({
        data: { acao: "contagem", empresa: papel === "plataforma" ? empresa : null },
      });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as ContagemPedidos;
    },
  });
  const total = q.data?.aguardando_loja.total ?? 0;
  useEffect(() => {
    if (!q.isSuccess) return;
    if (visto.current !== null && total > visto.current && somPedidoLigado(usuario))
      tocarPedidoNovo();
    visto.current = total;
  }, [q.dataUpdatedAt, q.isSuccess, total, usuario]);
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
