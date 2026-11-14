/**
 * ATD-ALERTA: selo global de clientes aguardando atendente (som + painel + toast).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, Headset, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { atenderConversa, listarConversas } from "@/lib/gateway-conversas.functions";
import type { Conversa } from "@/lib/gateway/conversas";
import { esperaCurta } from "@/lib/gateway/conversas";
import type { PapelGateway } from "@/lib/gateway/tipos";
import {
  EVENTO_ABRIR_FILA_ATENDIMENTO,
  EVENTO_ATENDIMENTO_PREFS,
  EVENTO_ATENDIMENTO_SOM,
  classesSeloAlerta,
  conversasNovasNaFila,
  deveLembrar,
  definirLembreteAtendimento,
  definirNotificacaoAtendimento,
  definirSomAtendimento,
  desbloquearAudioAtendimento,
  chaveFila,
  lembreteAtendimentoLigado,
  mapaDaFila,
  nomeNaFila,
  notificacaoAtendimentoLigada,
  podeVerAlertaAtendimento,
  rotuloMotivoAtendimento,
  somAtendimentoLigado,
  tituloAbaAguardando,
  tocarChamadaAtendimento,
  urgenciaAlerta,
} from "@/lib/atendimento-alerta";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PreferenciasAtendimento } from "./PreferenciasAtendimento";

const CHAVE_EMPRESA = "luxbrain:gateway-empresa";

type EstadoLembrete = { toques: number; ultimoToqueEm: number };

export function ContadorAtendimento({ papel }: { papel: PapelGateway | null | undefined }) {
  const fn = useServerFn(listarConversas);
  const atender = useServerFn(atenderConversa);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("local");
  const [agora, setAgora] = useState(Date.now());
  const [aberto, setAberto] = useState(false);
  const [som, setSom] = useState(true);
  const [lembrete, setLembrete] = useState(true);
  const [notif, setNotif] = useState(false);
  const [audioBloqueado, setAudioBloqueado] = useState(false);
  const [abaOculta, setAbaOculta] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  const visto = useRef<Map<string, string> | null>(null);
  const lembretes = useRef<Map<string, EstadoLembrete>>(new Map());
  const tituloBase = useRef<string | null>(null);
  const toastsAbertos = useRef<Map<string, string | number>>(new Map());

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) setUsuario(data.session.user.id);
    });
  }, []);

  useEffect(() => {
    const ler = () => setEmpresa(papel === "plataforma" ? localStorage.getItem(CHAVE_EMPRESA) : "");
    ler();
    window.addEventListener("luxbrain:empresa", ler);
    return () => window.removeEventListener("luxbrain:empresa", ler);
  }, [papel]);

  useEffect(() => {
    const sync = () => {
      setSom(somAtendimentoLigado(usuario));
      setLembrete(lembreteAtendimentoLigado(usuario));
      setNotif(notificacaoAtendimentoLigada(usuario));
    };
    sync();
    window.addEventListener(EVENTO_ATENDIMENTO_SOM, sync);
    window.addEventListener(EVENTO_ATENDIMENTO_PREFS, sync);
    return () => {
      window.removeEventListener(EVENTO_ATENDIMENTO_SOM, sync);
      window.removeEventListener(EVENTO_ATENDIMENTO_PREFS, sync);
    };
  }, [usuario]);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const aoVis = () => setAbaOculta(document.hidden);
    document.addEventListener("visibilitychange", aoVis);
    return () => document.removeEventListener("visibilitychange", aoVis);
  }, []);

  const empresaEfetiva = papel === "plataforma" ? empresa : "vinculada";
  const habilitado =
    podeVerAlertaAtendimento(papel) && (papel !== "plataforma" || Boolean(empresa));

  const q = useQuery({
    queryKey: ["conversas", empresaEfetiva, "alerta-fila"],
    enabled: habilitado,
    staleTime: 10_000,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? 60_000 : 15_000),
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const r = await fn({
        data: {
          empresa: papel === "plataforma" ? empresa : null,
          aguardando: true,
          ordem: "id",
        },
      });
      return (r.itens ?? []) as Conversa[];
    },
  });

  const fila = useMemo(
    () => (q.data ?? []).filter((c) => Boolean(c.aguardando_atendente_desde)),
    [q.data],
  );
  const total = fila.length;
  const maisAntiga = fila[0]?.aguardando_atendente_desde ?? null;
  const urgencia = urgenciaAlerta(maisAntiga, agora);

  function avisarNova(c: Conversa) {
    const nome = nomeNaFila(c);
    const motivo = rotuloMotivoAtendimento(c.aguardando_motivo);
    if (som) {
      const ok = tocarChamadaAtendimento();
      if (!ok) setAudioBloqueado(true);
    }
    const idToast = toast.message(`Cliente aguardando atendente — ${nome} — ${motivo}`, {
      duration: Infinity,
      action: {
        label: "Abrir",
        onClick: () => abrirConversa(c.conversation_id),
      },
    });
    toastsAbertos.current.set(c.conversation_id, idToast);
    if (abaOculta && notif && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Cliente aguardando atendente", {
          body: `${nome} — ${motivo}`,
          tag: `atendimento-${c.conversation_id}`,
        });
      } catch {
        /* Sem permissão ou API indisponível. */
      }
    }
    const k = chaveFila(c);
    lembretes.current.set(k, { toques: 0, ultimoToqueEm: Date.now() });
  }

  useEffect(() => {
    if (!q.isSuccess) return;
    const atuais = mapaDaFila(fila);
    const anterior = visto.current;
    visto.current = atuais;
    if (anterior === null) {
      // Primeira carga: só o selo; marca o relógio do lembrete sem tocar.
      for (const c of fila) {
        if (c.aguardando_atendente_desde) {
          lembretes.current.set(chaveFila(c), { toques: 0, ultimoToqueEm: Date.now() });
        }
      }
      return;
    }
    const novas = conversasNovasNaFila(anterior, fila);
    for (const c of novas) {
      const completa = fila.find((x) => x.conversation_id === c.conversation_id);
      if (completa) avisarNova(completa);
    }
    for (const k of [...lembretes.current.keys()]) {
      if (!atuais.has(k)) lembretes.current.delete(k);
    }
    for (const id of [...toastsAbertos.current.keys()]) {
      if (!fila.some((c) => c.conversation_id === id)) {
        toast.dismiss(toastsAbertos.current.get(id));
        toastsAbertos.current.delete(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avisarNova usa estado atual
  }, [q.dataUpdatedAt, q.isSuccess, fila, som, notif, abaOculta]);

  // Lembrete a cada 2 min (máx. 5) para quem segue sem atendente.
  useEffect(() => {
    if (!lembrete || !som || !q.isSuccess) return;
    const id = window.setInterval(() => {
      const agoraTick = Date.now();
      for (const c of fila) {
        if (!c.aguardando_atendente_desde || c.atribuida_a) continue;
        const k = chaveFila(c);
        const est = lembretes.current.get(k) ?? { toques: 0, ultimoToqueEm: Date.parse(c.aguardando_atendente_desde) };
        if (
          !deveLembrar({
            atribuida_a: c.atribuida_a,
            toques: est.toques,
            ultimoToqueEm: est.ultimoToqueEm,
            agora: agoraTick,
          })
        ) {
          if (!lembretes.current.has(k)) lembretes.current.set(k, est);
          continue;
        }
        const ok = tocarChamadaAtendimento();
        if (!ok) setAudioBloqueado(true);
        lembretes.current.set(k, { toques: est.toques + 1, ultimoToqueEm: agoraTick });
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [lembrete, som, q.isSuccess, fila]);

  // Título da aba enquanto oculta e há fila.
  useEffect(() => {
    if (!habilitado) return;
    if (abaOculta && total > 0) {
      if (!tituloBase.current) tituloBase.current = document.title;
      const t = tituloAbaAguardando(total);
      if (t) document.title = `${t} — ${tituloBase.current.replace(/^\(\d+\) Cliente aguardando\s*—?\s*/, "")}`;
      return;
    }
    if (tituloBase.current) {
      document.title = tituloBase.current;
      tituloBase.current = null;
    }
  }, [abaOculta, total, habilitado]);

  useEffect(() => {
    return () => {
      if (tituloBase.current) document.title = tituloBase.current;
    };
  }, []);

  const assumir = useMutation({
    mutationFn: (c: Conversa) =>
      atender({
        data: {
          empresa: papel === "plataforma" ? empresa : null,
          conversa: c.conversation_id,
          acao: "assumir",
          minutos: 60,
          ...(c.atribuida_a && !c.atribuida_minha ? { transferir: true } : {}),
        },
      }),
    onSuccess: (_r, c) => {
      toast.success("Atendimento assumido.");
      toast.dismiss(toastsAbertos.current.get(c.conversation_id));
      toastsAbertos.current.delete(c.conversation_id);
      void cache.invalidateQueries({ queryKey: ["conversas"] });
      abrirConversa(c.conversation_id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirConversa(id: string) {
    toast.dismiss(toastsAbertos.current.get(id));
    toastsAbertos.current.delete(id);
    setAberto(false);
    void navigate({ to: "/ia/conversas", search: { conversa: id, fila: true } });
  }

  function verTodas() {
    setAberto(false);
    window.dispatchEvent(new Event(EVENTO_ABRIR_FILA_ATENDIMENTO));
    void navigate({ to: "/ia/conversas", search: { fila: true } });
  }

  async function ativarSom() {
    const ok = await desbloquearAudioAtendimento();
    setAudioBloqueado(!ok);
    if (ok) {
      definirSomAtendimento(usuario, true);
      setSom(true);
      tocarChamadaAtendimento();
      toast.message("Som de atendimento ativado.");
    } else {
      toast.error("O navegador ainda bloqueou o áudio. Clique de novo após interagir com a página.");
    }
  }

  if (!habilitado || !q.isSuccess || total <= 0) {
    // Ainda mostra o botão "Ativar som" se bloqueado e há preferência ligada? Spec: no selo while blocked.
    // Sem fila o selo some — ok.
    return null;
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${classesSeloAlerta(urgencia)}`}
          aria-label={`${total} cliente${total === 1 ? "" : "s"} aguardando atendente`}
          title="Clientes aguardando atendente"
        >
          <Headset className="size-3.5 shrink-0" aria-hidden />
          {total}
          {audioBloqueado && som ? (
            <span className="rounded bg-black/20 px-1 text-[10px] font-medium normal-case">
              Ativar som
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0 sm:w-[24rem]">
        <div className="border-b border-base-200 px-3 py-2">
          <p className="text-sm font-semibold text-ink-900">Aguardando atendente</p>
          <p className="text-xs text-ink-500">
            Mais antiga primeiro · atualiza a cada {abaOculta ? "60" : "15"} s
          </p>
        </div>
        {audioBloqueado && som ? (
          <div className="flex items-center justify-between gap-2 border-b border-gold-300/40 bg-gold-300/20 px-3 py-2">
            <p className="text-xs text-gold-800">O navegador bloqueou o som até um clique.</p>
            <Button type="button" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => void ativarSom()}>
              <Volume2 className="size-3.5" aria-hidden /> Ativar som
            </Button>
          </div>
        ) : null}
        <ul className="max-h-72 overflow-y-auto">
          {fila.map((c) => {
            const u = urgenciaAlerta(c.aguardando_atendente_desde, agora);
            return (
              <li key={c.conversation_id} className="border-b border-base-200/70 px-3 py-2.5 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{nomeNaFila(c)}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {rotuloMotivoAtendimento(c.aguardando_motivo)}
                      {c.canal ? ` · ${c.canal_info?.nome || c.canal}` : ""}
                    </p>
                    <p className={`mt-0.5 text-xs font-medium ${u === "vermelho" ? "text-destructive" : u === "laranja" ? "text-orange-700" : "text-gold-700"}`}>
                      aguardando há {c.aguardando_atendente_desde ? esperaCurta(c.aguardando_atendente_desde, agora) : "—"}
                    </p>
                    {c.atribuida_a ? (
                      <p className="mt-0.5 text-[11px] text-ink-500">Atendente: {c.atribuida_a}</p>
                    ) : null}
                  </div>
                  <span className={`mt-0.5 size-2 shrink-0 rounded-full ${u === "vermelho" ? "bg-destructive" : u === "laranja" ? "bg-orange-500" : "bg-gold-500"}`} aria-hidden />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => abrirConversa(c.conversation_id)}
                  >
                    Abrir conversa
                  </Button>
                  {!c.atribuida_minha ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={assumir.isPending}
                      onClick={() => assumir.mutate(c)}
                    >
                      Assumir
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-2 border-t border-base-200 px-3 py-2">
          <PreferenciasAtendimento
            usuario={usuario}
            som={som}
            lembrete={lembrete}
            notif={notif}
            compacto
            onSom={(v) => {
              definirSomAtendimento(usuario, v);
              setSom(v);
              if (v) void ativarSom();
            }}
            onLembrete={(v) => {
              definirLembreteAtendimento(usuario, v);
              setLembrete(v);
            }}
            onNotif={(v) => {
              definirNotificacaoAtendimento(usuario, v);
              setNotif(v);
            }}
          />
          <Button type="button" variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={verTodas}>
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Atalho de preferências para a tela de Segurança / Configurações pessoais. */
export function BlocoPreferenciasAtendimento() {
  const [usuario, setUsuario] = useState("local");
  const [som, setSom] = useState(true);
  const [lembrete, setLembrete] = useState(true);
  const [notif, setNotif] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? "local";
      setUsuario(id);
      setSom(somAtendimentoLigado(id));
      setLembrete(lembreteAtendimentoLigado(id));
      setNotif(notificacaoAtendimentoLigada(id));
    });
  }, []);
  useEffect(() => {
    const sync = () => {
      setSom(somAtendimentoLigado(usuario));
      setLembrete(lembreteAtendimentoLigado(usuario));
      setNotif(notificacaoAtendimentoLigada(usuario));
    };
    window.addEventListener(EVENTO_ATENDIMENTO_PREFS, sync);
    return () => window.removeEventListener(EVENTO_ATENDIMENTO_PREFS, sync);
  }, [usuario]);
  return (
    <div className="space-y-2 rounded-lg border border-base-200 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
        {som ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
        Alertas de atendimento
      </p>
      <PreferenciasAtendimento
        usuario={usuario}
        som={som}
        lembrete={lembrete}
        notif={notif}
        onSom={(v) => {
          definirSomAtendimento(usuario, v);
          setSom(v);
        }}
        onLembrete={(v) => {
          definirLembreteAtendimento(usuario, v);
          setLembrete(v);
        }}
        onNotif={(v) => {
          definirNotificacaoAtendimento(usuario, v);
          setNotif(v);
        }}
      />
    </div>
  );
}
