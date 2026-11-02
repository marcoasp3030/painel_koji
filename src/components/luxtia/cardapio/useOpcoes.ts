import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ConjuntoOpcoes, ServicosCat2 } from "@/lib/gateway/cardapio-cat2";
import {
  deServidor,
  paraEnvio,
  problemaNasOpcoes,
  type GrupoEditor,
} from "@/lib/gateway/opcoes-item";

/** Rascunho das opções, dono da leitura e da gravação. `itemId` nulo: produto novo, começa vazio. */
export function useOpcoes(itemId: number | null, servicos: ServicosCat2) {
  const [grupos, setGrupos] = useState<GrupoEditor[] | null>(itemId === null ? [] : null);
  const [base, setBase] = useState("[]");
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);

  function aplicar(conjunto: ConjuntoOpcoes) {
    const editor = deServidor(conjunto.grupos);
    setGrupos(editor);
    setBase(JSON.stringify(paraEnvio(editor)));
    setAtualizadoEm(conjunto.atualizado_em);
  }

  useEffect(() => {
    if (itemId === null) return;
    let vivo = true;
    servicos.opcoes(itemId).then(
      (c) => {
        if (vivo) aplicar(c);
      },
      (e: Error) => {
        if (vivo) setErroCarga(e.message);
      },
    );
    return () => {
      vivo = false;
    };
    // Só ao abrir o item: reler aqui apagaria o rascunho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const envio = useMemo(() => JSON.stringify(paraEnvio(grupos ?? [])), [grupos]);
  const sujo = grupos !== null && envio !== base;

  /** `falhas`: unidades do mesmo prato que não receberam as opções. */
  async function salvar(id: number, todasUnidades: boolean) {
    try {
      const r = await servicos.salvarOpcoes(id, {
        grupos: paraEnvio(grupos ?? []),
        atualizado_em: atualizadoEm,
        ...(todasUnidades ? { aplicar_em: "todas" as const } : {}),
      });
      aplicar(r);
      return { ok: true as const, falhas: (r.aplicado_em ?? []).filter((a) => !a.ok).length };
    } catch (e) {
      if ((e as { campo?: string }).campo === "atualizado_em") setConflito(true);
      return { ok: false as const, mensagem: (e as Error).message };
    }
  }

  async function carregarAtual(id: number) {
    try {
      aplicar(await servicos.opcoes(id));
      setConflito(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return {
    grupos,
    setGrupos,
    erroCarga,
    conflito,
    sujo,
    problema: sujo ? problemaNasOpcoes(grupos ?? []) : null,
    /** Com conflito, gravar só repetiria a recusa. Se a leitura falhar, o rascunho nem existe: nada é enviado. */
    pronto: !conflito,
    salvar,
    carregarAtual,
  };
}
