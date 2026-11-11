/** Lista e cria contas com papel de plataforma (super admin). */
import { useState } from "react";
import { ChevronRight, Copy, Search, Shield, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Etiqueta } from "@/components/luxtia/Gateway";
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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CampoSenha } from "@/components/luxtia/entrada/CampoSenha";
import { MedidorSenha } from "@/components/luxtia/entrada/MedidorSenha";
import {
  filtrarUsuariosPlataforma,
  type UsuarioPlataformaLinha,
} from "@/lib/plataforma-usuarios";

function quando(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

const nomeDe = (u: UsuarioPlataformaLinha) => u.nome || u.email;

export function UsuariosPlataformaTela({
  usuarios,
  ocupado,
  aviso,
  linkSenha,
  onCriar,
  onRemover,
  onLinkSenha,
  onFecharLink,
}: {
  usuarios: UsuarioPlataformaLinha[];
  ocupado?: boolean;
  aviso?: string | null;
  linkSenha?: string | null;
  onCriar: (
    d: { email: string; nome: string; senha: string },
    pronto: () => void,
  ) => void;
  onRemover: (userId: string, pronto: () => void) => void;
  onLinkSenha: (userId: string) => void;
  onFecharLink: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const lista = filtrarUsuariosPlataforma(usuarios, busca);
  const aberto = usuarios.find((u) => u.user_id === abertoId) ?? null;
  const aviso_ = <AvisoLink link={linkSenha} aviso={aviso} fechar={onFecharLink} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 px-3 py-1.5">
        <div className="relative min-w-40 flex-1 sm:max-w-64">
          <Search
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-500"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Procurar por nome ou e-mail"
            placeholder="Nome ou e-mail"
            className="h-8 pl-7 text-sm"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <p className="hidden text-xs text-ink-500 sm:block">
          {usuarios.length} {usuarios.length === 1 ? "pessoa" : "pessoas"} com acesso de plataforma
        </p>
        <Button size="sm" className="ml-auto" onClick={() => setCriando(true)}>
          <UserPlus className="size-4" aria-hidden />
          Novo super admin
        </Button>
      </div>

      {aberto || criando ? null : aviso_}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          aria-hidden
          className="sticky top-0 z-10 hidden grid-cols-[minmax(0,2fr)_140px_150px_16px] gap-3 border-b border-base-200 bg-card/95 px-4 py-1.5 text-xs font-medium text-ink-500 backdrop-blur lg:grid"
        >
          <span>Pessoa</span>
          <span>Papel</span>
          <span>Último acesso</span>
          <span />
        </div>
        {lista.length ? (
          <ul>
            {lista.map((u) => (
              <li key={u.user_id}>
                <button
                  type="button"
                  onClick={() => setAbertoId(u.user_id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-0.5 border-b border-base-200/70 px-4 py-2 text-left transition-colors hover:bg-purple-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,2fr)_140px_150px_16px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {nomeDe(u)}
                      {u.eu ? (
                        <span className="ml-1.5 text-xs font-normal text-ink-500">você</span>
                      ) : null}
                      {u.emergencia ? (
                        <span className="ml-1.5 text-xs font-normal text-gold-700">emergência</span>
                      ) : null}
                    </span>
                    {u.nome ? (
                      <span className="block truncate text-xs text-ink-500">{u.email}</span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 text-ink-300 lg:order-last" aria-hidden />
                  <span className="max-lg:col-span-2 max-lg:mt-0.5 lg:contents">
                    <span className="inline-block lg:block">
                      <Etiqueta tom="roxo">Plataforma</Etiqueta>
                    </span>
                    <span className="ml-2 text-xs tabular-nums text-ink-500 lg:ml-0 lg:block">
                      {quando(u.ultimo_acesso)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-ink-500">
            {busca.trim()
              ? "Ninguém com esses filtros."
              : "Nenhum super admin listado. Crie o primeiro abaixo."}
          </p>
        )}
      </div>

      <Sheet open={criando} onOpenChange={setCriando}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-base-200 px-4 py-3 text-left">
            <SheetTitle>Novo super admin</SheetTitle>
            <SheetDescription>
              Acesso completo à plataforma: clientes, configurações e todas as empresas. Informe a
              senha inicial; a pessoa pode trocar depois.
            </SheetDescription>
          </SheetHeader>
          {criando ? (
            <FormCriar
              ocupado={ocupado}
              criar={(d) => onCriar(d, () => setCriando(false))}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(aberto)} onOpenChange={(a) => !a && setAbertoId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {aberto ? (
            <Painel
              key={aberto.user_id}
              usuario={aberto}
              ocupado={ocupado}
              aviso={aviso_}
              onRemover={onRemover}
              onLinkSenha={onLinkSenha}
              fechar={() => setAbertoId(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FormCriar({
  ocupado,
  criar,
}: {
  ocupado?: boolean;
  criar: (d: { email: string; nome: string; senha: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  return (
    <form
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
      onSubmit={(e) => {
        e.preventDefault();
        criar({ email: email.trim(), nome: nome.trim(), senha });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="plat-nome">Nome</Label>
        <Input
          id="plat-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
          maxLength={120}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plat-email">E-mail</Label>
        <Input
          id="plat-email"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com.br"
        />
      </div>
      <CampoSenha
        id="plat-senha"
        label="Senha inicial"
        value={senha}
        onChange={setSenha}
        autoComplete="new-password"
        required
        minLength={12}
      />
      <MedidorSenha senha={senha} />
      <p className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-xs text-purple-900">
        <Shield className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
        Papel: Plataforma (super admin). Sem vínculo obrigatório a um cliente.
      </p>
      <Button type="submit" disabled={ocupado || !email.trim() || !senha}>
        Criar acesso
      </Button>
    </form>
  );
}

function Painel({
  usuario: u,
  ocupado,
  aviso,
  onRemover,
  onLinkSenha,
  fechar,
}: {
  usuario: UsuarioPlataformaLinha;
  ocupado?: boolean;
  aviso: React.ReactNode;
  onRemover: (userId: string, pronto: () => void) => void;
  onLinkSenha: (userId: string) => void;
  fechar: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <>
      <SheetHeader className="border-b border-base-200 px-4 py-3 text-left">
        <SheetTitle>{nomeDe(u)}</SheetTitle>
        <SheetDescription>{u.email}</SheetDescription>
      </SheetHeader>
      {aviso}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-ink-500">Papel: </span>
            <Etiqueta tom="roxo">Plataforma</Etiqueta>
            {u.emergencia ? (
              <span className="ml-2 text-xs text-gold-700">conta de emergência</span>
            ) : null}
          </p>
          <p className="text-ink-500">
            Criado em {quando(u.criado_em)} · Último acesso {quando(u.ultimo_acesso)}
          </p>
        </div>
        {!u.eu ? (
          <Button
            type="button"
            variant="outline"
            disabled={ocupado}
            onClick={() => onLinkSenha(u.user_id)}
          >
            Gerar link de nova senha
          </Button>
        ) : (
          <p className="text-xs text-ink-500">Para trocar a sua senha, use Esqueci a senha na entrada.</p>
        )}
        {u.podeRemover ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={ocupado}
            onClick={() => setConfirmar(true)}
          >
            Remover acesso de plataforma
          </Button>
        ) : u.eu ? (
          <p className="text-xs text-ink-500">Você não remove o próprio acesso.</p>
        ) : u.emergencia ? (
          <p className="text-xs text-ink-500">A conta de emergência não pode ser removida.</p>
        ) : (
          <p className="text-xs text-ink-500">É preciso manter ao menos um super admin.</p>
        )}
        <Button type="button" variant="outline" onClick={fechar}>
          Fechar
        </Button>
      </div>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso de plataforma?</AlertDialogTitle>
            <AlertDialogDescription>
              {nomeDe(u)} ({u.email}) deixa de ser super admin. Se não tiver vínculo com cliente, a
              conta também é apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onRemover(u.user_id, () => { setConfirmar(false); fechar(); })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AvisoLink({
  link,
  aviso,
  fechar,
}: {
  link?: string | null | undefined;
  aviso?: string | null | undefined;
  fechar: () => void;
}) {
  if (!link && !aviso) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 items-start gap-2 border-b border-gold-500/40 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p>{link ? aviso ?? "Link gerado." : aviso}</p>
        {link ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs">{link}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(
                  () => toast.success("Link copiado."),
                  () => toast.error("Não foi possível copiar. Selecione o link."),
                );
              }}
            >
              <Copy className="size-3.5" aria-hidden />
              Copiar
            </Button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="rounded p-1 text-amber-900 hover:bg-amber-100"
        aria-label="Fechar aviso"
        onClick={fechar}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
