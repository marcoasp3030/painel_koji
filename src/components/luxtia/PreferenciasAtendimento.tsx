/** Preferências ATD-ALERTA (som, notificação, lembrete) — localStorage por usuário. */
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  definirNotificacaoAtendimento,
} from "@/lib/atendimento-alerta";

export function PreferenciasAtendimento({
  usuario,
  som,
  lembrete,
  notif,
  compacto = false,
  onSom,
  onLembrete,
  onNotif,
}: {
  usuario: string;
  som: boolean;
  lembrete: boolean;
  notif: boolean;
  compacto?: boolean;
  onSom: (v: boolean) => void;
  onLembrete: (v: boolean) => void;
  onNotif: (v: boolean) => void;
}) {
  async function pedirNotificacao() {
    if (typeof Notification === "undefined") {
      toast.error("Este navegador não oferece notificações.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      definirNotificacaoAtendimento(usuario, true);
      onNotif(true);
      toast.success("Notificações do navegador ligadas.");
    } else {
      definirNotificacaoAtendimento(usuario, false);
      onNotif(false);
      toast.message("Permissão de notificação negada.");
    }
  }

  const linha = compacto ? "gap-2 py-0.5" : "gap-3 py-1";

  return (
    <div className={`space-y-1 text-xs ${compacto ? "" : "text-sm"}`}>
      <label className={`flex items-center justify-between ${linha}`}>
        <span className="text-ink-700">Som de atendimento</span>
        <Switch checked={som} onCheckedChange={onSom} aria-label="Som de atendimento" />
      </label>
      <label className={`flex items-center justify-between ${linha}`}>
        <span className="text-ink-700">Repetir lembrete</span>
        <Switch
          checked={lembrete}
          onCheckedChange={onLembrete}
          aria-label="Repetir lembrete a cada 2 minutos"
        />
      </label>
      <div className={`flex items-center justify-between ${linha}`}>
        <span className="text-ink-700">Notificação do navegador</span>
        {notif && typeof Notification !== "undefined" && Notification.permission === "granted" ? (
          <Switch checked={notif} onCheckedChange={onNotif} aria-label="Notificação do navegador" />
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void pedirNotificacao()}>
            Permitir
          </Button>
        )}
      </div>
    </div>
  );
}
