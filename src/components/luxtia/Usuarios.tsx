/** Tela de usuários da empresa. O servidor decide o que cada papel pode conceder. */
import { useState } from "react";
import { ChevronRight, Copy, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Etiqueta } from "@/components/luxtia/Gateway";
import { ChipFiltro } from "@/components/luxtia/Superficie";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AVISO_LINK_CONVITE } from "@/lib/acesso/convite";
import { ROTULO_PAPEL, type PapelAcesso } from "@/lib/acesso/papeis";
import {
  ROTULO_SITUACAO,
  filtrarUsuarios,
  situacaoUsuario,
  type SituacaoUsuario,
} from "@/lib/acesso/usuarios";

export type UsuarioLinha = {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  papel: PapelAcesso;
  ativo: boolean;
  unidades: string[];
  convidado_em: string | null;
  ultimo_acesso: string | null;
  convitePendente?: boolean;
  conviteExpiraEm?: string | null;
  eu: boolean;
  podeGerir: boolean;
};

type Papel = Exclude<PapelAcesso, "plataforma">;
type Unidade = { codigo: string; nome: string };

const SOBRE_PAPEL: Record<Papel, string> = {
  gestor: "Administra toda a empresa, em todas as unidades.",
  supervisor: "Acompanha a operação e a equipe das suas unidades.",
  funcionario: "Atende conversas, pedidos e cardápio das suas unidades.",
};

const COR_SITUACAO: Record<SituacaoUsuario, string> = {
  ativo: "bg-success",
  convite: "bg-gold-500",
  nunca_entrou: "bg-ink-300",
  inativo: "bg-destructive",
};

const SITUACOES: SituacaoUsuario[] = ["ativo", "convite", "nunca_entrou", "inativo"];

function quando(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

const nomeDe = (u: UsuarioLinha) => u.nome || u.email;

function textoUnidades(u: UsuarioLinha, unidades: Unidade[]) {
  if (u.papel === "gestor") return "Todas as unidades";
  if (!u.unidades.length) return "Sem unidade";
  return u.unidades.map((c) => unidades.find((x) => x.codigo === c)?.nome ?? c).join(", ");
}

export function UsuariosTela({
  concediveis,
  podeRedefinirSenha,
  unidades,
  usuarios,
  ocupado,
  aviso,
  linkConvite,
  convitePorEmail = false,
  onConvidar,
  onAlterar,
  onReenviar,
  onRevogar,
  onRedefinirSenha,
  onFecharLink,
}: {
  concediveis: PapelAcesso[];
  podeRedefinirSenha: boolean;
  unidades: Unidade[];
  usuarios: UsuarioLinha[];
  ocupado?: boolean;
  aviso?: string | null;
  linkConvite?: string | null;
  convitePorEmail?: boolean;
  onConvidar: (
    d: { email: string; nome: string; papel: Papel; unidades: string[] },
    pronto: () => void,
  ) => void;
  onAlterar: (
    d: { id: string; papel?: Papel; unidades?: string[]; ativo?: boolean },
    pronto: () => void,
  ) => void;
  onReenviar: (id: string) => void;
  onRevogar: (id: string) => void;
  onRedefinirSenha: (userId: string) => void;
  onFecharLink: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState("");
  const [situacao, setSituacao] = useState("");
  const [unidade, setUnidade] = useState("");
  const [convidando, setConvidando] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const papeis = concediveis.filter((p): p is Papel => p !== "plataforma");
  const aberto = usuarios.find((u) => u.id === abertoId) ?? null;
  const lista = filtrarUsuarios(usuarios, { busca, papel, situacao, unidade });
  const filtrando = Boolean(busca || papel || situacao || unidade);
  const aviso_ = <AvisoLink link={linkConvite} aviso={aviso} fechar={onFecharLink} />;

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
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] max-sm:order-last max-sm:w-full">
          <ChipFiltro
            ativo={!situacao}
            onClick={() => setSituacao("")}
            rotulo="Todos"
            total={usuarios.length}
          />
          {SITUACOES.map((s) => {
            const total = usuarios.filter((u) => situacaoUsuario(u) === s).length;
            return total || situacao === s ? (
              <ChipFiltro
                key={s}
                ativo={situacao === s}
                onClick={() => setSituacao(situacao === s ? "" : s)}
                rotulo={ROTULO_SITUACAO[s]}
                total={total}
              />
            ) : null;
          })}
        </div>
        <select
          aria-label="Filtrar por papel"
          className="h-8 rounded-md border bg-card px-2 text-sm"
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
        >
          <option value="">Todos os papéis</option>
          {(["gestor", "supervisor", "funcionario"] as const).map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </select>
        {unidades.length > 1 ? (
          <select
            aria-label="Filtrar por unidade"
            className="h-8 max-w-44 rounded-md border bg-card px-2 text-sm"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
          >
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.nome}
              </option>
            ))}
          </select>
        ) : null}
        <Button
          size="sm"
          className="ml-auto"
          disabled={papeis.length === 0}
          onClick={() => setConvidando(true)}
        >
          <UserPlus className="size-4" aria-hidden />
          Convidar
        </Button>
      </div>

      {aberto || convidando ? null : aviso_}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          aria-hidden
          className="sticky top-0 z-10 hidden grid-cols-[minmax(0,2fr)_110px_minmax(0,1.5fr)_150px_130px_16px] gap-3 border-b border-base-200 bg-card/95 px-4 py-1.5 text-xs font-medium text-ink-500 backdrop-blur lg:grid"
        >
          <span>Pessoa</span>
          <span>Papel</span>
          <span>Unidades</span>
          <span>Situação</span>
          <span>Último acesso</span>
          <span />
        </div>
        {lista.length ? (
          <ul>
            {lista.map((u) => (
              <li key={u.id}>
                <LinhaUsuario usuario={u} unidades={unidades} abrir={() => setAbertoId(u.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-ink-500">
            {filtrando
              ? "Ninguém com esses filtros."
              : "Ninguém nesta empresa. O primeiro convite aparece aqui."}
          </p>
        )}
      </div>

      <Sheet open={convidando} onOpenChange={setConvidando}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-base-200 px-4 py-3 text-left">
            <SheetTitle>Convidar pessoa</SheetTitle>
            <SheetDescription>
              {convitePorEmail
                ? "O convite chega por e-mail. A senha não é definida aqui."
                : "O e-mail não está configurado. O link do convite aparece uma vez, vale 24 horas e pode ser revogado."}
            </SheetDescription>
          </SheetHeader>
          {convidando ? (
            <FormConvite
              papeis={papeis}
              unidades={unidades}
              ocupado={ocupado}
              convidar={(d) => onConvidar(d, () => setConvidando(false))}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(aberto)} onOpenChange={(a) => !a && setAbertoId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {aberto ? (
            <PainelUsuario
              key={aberto.id}
              usuario={aberto}
              papeis={papeis}
              unidades={unidades}
              ocupado={ocupado}
              convitePorEmail={convitePorEmail}
              podeRedefinirSenha={podeRedefinirSenha}
              aviso={aviso_}
              onAlterar={onAlterar}
              onReenviar={onReenviar}
              onRevogar={onRevogar}
              onRedefinirSenha={onRedefinirSenha}
              fechar={() => setAbertoId(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LinhaUsuario({
  usuario: u,
  unidades,
  abrir,
}: {
  usuario: UsuarioLinha;
  unidades: Unidade[];
  abrir: () => void;
}) {
  const situacao = situacaoUsuario(u);
  const nomesUnidades = textoUnidades(u, unidades);
  return (
    <button
      type="button"
      onClick={abrir}
      className={`grid w-full grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-0.5 border-b border-base-200/70 px-4 py-2 text-left transition-colors hover:bg-purple-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,2fr)_110px_minmax(0,1.5fr)_150px_130px_16px] ${u.ativo ? "" : "opacity-60"}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink-900">
          {nomeDe(u)}
          {u.eu ? <span className="ml-1.5 text-xs font-normal text-ink-500">você</span> : null}
        </span>
        {u.nome ? <span className="block truncate text-xs text-ink-500">{u.email}</span> : null}
      </span>
      <ChevronRight className="size-4 text-ink-300 lg:order-last" aria-hidden />
      <span className="max-lg:col-span-2 max-lg:mt-0.5 lg:contents">
        <span className="inline-block lg:block">
          <Etiqueta {...(u.papel === "gestor" ? { tom: "roxo" as const } : {})}>
            {ROTULO_PAPEL[u.papel]}
          </Etiqueta>
        </span>
        <span
          className="ml-2 min-w-0 truncate text-xs text-ink-700 max-lg:hidden lg:ml-0 lg:block"
          title={nomesUnidades}
        >
          {nomesUnidades}
        </span>
        <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-ink-700 lg:ml-0 lg:flex">
          <span
            className={`size-1.5 shrink-0 rounded-full ${COR_SITUACAO[situacao]}`}
            aria-hidden
          />
          {ROTULO_SITUACAO[situacao]}
        </span>
        <span className="hidden text-xs tabular-nums text-ink-500 lg:block">
          {quando(u.ultimo_acesso)}
        </span>
      </span>
    </button>
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
        <p>{link ? AVISO_LINK_CONVITE : aviso}</p>
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
        aria-label="Fechar aviso"
        className="rounded p-0.5 hover:bg-amber-100"
        onClick={fechar}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function EscolhaPapel({
  papeis,
  valor,
  mudar,
}: {
  papeis: Papel[];
  valor: Papel;
  mudar: (p: Papel) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-ink-900">Papel</legend>
      <div role="radiogroup" aria-label="Papel" className="flex gap-1.5">
        {papeis.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={valor === p}
            onClick={() => mudar(p)}
            className={`h-8 rounded-md border px-3 text-sm transition-colors ${
              valor === p
                ? "border-purple-700 bg-purple-50 font-medium text-purple-800"
                : "border-base-200 bg-card text-ink-700 hover:border-purple-300"
            }`}
          >
            {ROTULO_PAPEL[p]}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-500">{SOBRE_PAPEL[valor]}</p>
    </fieldset>
  );
}

function EscolhaUnidades({
  unidades,
  valor,
  mudar,
}: {
  unidades: Unidade[];
  valor: string[];
  mudar: (u: string[]) => void;
}) {
  const todas = unidades.length > 0 && unidades.every((u) => valor.includes(u.codigo));
  return (
    <fieldset className="space-y-1.5">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium text-ink-900">Unidades</legend>
        {unidades.length > 1 ? (
          <button
            type="button"
            className="text-xs text-purple-800 underline-offset-2 hover:underline"
            onClick={() => mudar(todas ? [] : unidades.map((u) => u.codigo))}
          >
            {todas ? "Limpar" : "Marcar todas"}
          </button>
        ) : null}
      </div>
      {unidades.length ? (
        <ul className="divide-y divide-base-200/70 rounded-md border border-base-200">
          {unidades.map((u) => (
            <li key={u.codigo}>
              <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-purple-50/60">
                <Checkbox
                  checked={valor.includes(u.codigo)}
                  onCheckedChange={(m) =>
                    mudar(m ? [...valor, u.codigo] : valor.filter((c) => c !== u.codigo))
                  }
                />
                {u.nome}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-500">Esta empresa ainda não tem unidades.</p>
      )}
    </fieldset>
  );
}

function FormConvite({
  papeis,
  unidades,
  ocupado,
  convidar,
}: {
  papeis: Papel[];
  unidades: Unidade[];
  ocupado?: boolean | undefined;
  convidar: (d: { email: string; nome: string; papel: Papel; unidades: string[] }) => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  // Começa pelo menor acesso: dar mais poder precisa ser uma escolha.
  const [papel, setPapel] = useState<Papel>(papeis[papeis.length - 1] ?? "funcionario");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const gestor = papel === "gestor";
  const faltaUnidade = !gestor && escolhidas.length === 0;
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!faltaUnidade) convidar({ email, nome, papel, unidades: gestor ? [] : escolhidas });
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <label className="block text-sm font-medium text-ink-900">
          E-mail
          <Input
            className="mt-1 font-normal"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-ink-900">
          Nome
          <Input
            className="mt-1 font-normal"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <EscolhaPapel papeis={papeis} valor={papel} mudar={setPapel} />
        {gestor ? (
          <p className="text-sm text-ink-500">O gestor acessa todas as unidades.</p>
        ) : (
          <EscolhaUnidades unidades={unidades} valor={escolhidas} mudar={setEscolhidas} />
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-base-200 p-3">
        {faltaUnidade ? (
          <p className="mr-auto text-xs text-ink-500">Escolha ao menos uma unidade.</p>
        ) : null}
        <Button type="submit" disabled={ocupado || faltaUnidade}>
          Enviar convite
        </Button>
      </div>
    </form>
  );
}

function PainelUsuario({
  usuario: u,
  papeis,
  unidades,
  ocupado,
  convitePorEmail,
  podeRedefinirSenha,
  aviso,
  onAlterar,
  onReenviar,
  onRevogar,
  onRedefinirSenha,
  fechar,
}: {
  usuario: UsuarioLinha;
  papeis: Papel[];
  unidades: Unidade[];
  ocupado?: boolean | undefined;
  convitePorEmail: boolean;
  podeRedefinirSenha: boolean;
  aviso: React.ReactNode;
  onAlterar: (
    d: { id: string; papel?: Papel; unidades?: string[]; ativo?: boolean },
    pronto: () => void,
  ) => void;
  onReenviar: (id: string) => void;
  onRevogar: (id: string) => void;
  onRedefinirSenha: (userId: string) => void;
  fechar: () => void;
}) {
  const visiveis = new Set(unidades.map((x) => x.codigo));
  const [papel, setPapel] = useState<Papel>(u.papel === "plataforma" ? "gestor" : u.papel);
  const [escolhidas, setEscolhidas] = useState(u.unidades.filter((c) => visiveis.has(c)));
  const [confirmar, setConfirmar] = useState<"desativar" | "revogar" | null>(null);
  const foraDoAlcance = u.unidades.filter((c) => !visiveis.has(c)).length;
  const gestor = papel === "gestor";
  const original = u.unidades.filter((c) => visiveis.has(c));
  const mudouUnidades =
    !gestor &&
    (escolhidas.length !== original.length || escolhidas.some((c) => !original.includes(c)));
  const mudouPapel = papel !== u.papel;
  const faltaUnidade = !gestor && escolhidas.length + foraDoAlcance === 0;

  function salvar() {
    onAlterar(
      {
        id: u.id,
        ...(mudouPapel ? { papel } : {}),
        ...(!gestor && (mudouPapel || mudouUnidades) ? { unidades: escolhidas } : {}),
      },
      fechar,
    );
  }

  return (
    <>
      <SheetHeader className="border-b border-base-200 px-4 py-3 text-left">
        <SheetTitle className="truncate pr-6">{nomeDe(u)}</SheetTitle>
        <SheetDescription className="truncate">{u.email}</SheetDescription>
      </SheetHeader>
      {aviso}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-sm">
          <dt className="text-ink-500">Situação</dt>
          <dd className="text-ink-900">{ROTULO_SITUACAO[situacaoUsuario(u)]}</dd>
          <dt className="text-ink-500">Último acesso</dt>
          <dd className="text-ink-900">{quando(u.ultimo_acesso)}</dd>
          {u.convitePendente ? (
            <>
              <dt className="text-ink-500">Convite vale até</dt>
              <dd className="text-ink-900">{quando(u.conviteExpiraEm)}</dd>
            </>
          ) : null}
        </dl>

        {u.podeGerir ? (
          <>
            <EscolhaPapel papeis={papeis} valor={papel} mudar={setPapel} />
            {gestor ? (
              <p className="text-sm text-ink-500">O gestor acessa todas as unidades.</p>
            ) : (
              <div className="space-y-1">
                <EscolhaUnidades unidades={unidades} valor={escolhidas} mudar={setEscolhidas} />
                {foraDoAlcance ? (
                  <p className="text-xs text-ink-500">
                    Mais {foraDoAlcance} {foraDoAlcance === 1 ? "unidade" : "unidades"} fora do seu
                    acesso, que não {foraDoAlcance === 1 ? "muda" : "mudam"}.
                  </p>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="text-ink-900">
              {ROTULO_PAPEL[u.papel]} · {textoUnidades(u, unidades)}
            </p>
            <p className="text-xs text-ink-500">
              {u.eu
                ? "Você não altera o próprio acesso."
                : "Seu papel não altera o acesso desta pessoa."}
            </p>
          </div>
        )}

        {u.podeGerir ? (
          <section className="space-y-1.5 border-t border-base-200 pt-3" aria-label="Acesso">
            <h3 className="text-sm font-medium text-ink-900">Acesso</h3>
            <div className="flex flex-wrap gap-1.5">
              {!u.ultimo_acesso ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ocupado}
                  onClick={() => onReenviar(u.id)}
                >
                  {convitePorEmail ? "Reenviar convite" : "Gerar novo link"}
                </Button>
              ) : null}
              {u.ultimo_acesso && podeRedefinirSenha ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ocupado}
                  onClick={() => onRedefinirSenha(u.user_id)}
                >
                  Link de nova senha
                </Button>
              ) : null}
              {u.convitePendente ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ocupado}
                  onClick={() => setConfirmar("revogar")}
                >
                  Revogar convite
                </Button>
              ) : null}
              {u.ativo ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={ocupado}
                  onClick={() => setConfirmar("desativar")}
                >
                  Desativar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ocupado}
                  onClick={() => onAlterar({ id: u.id, ativo: true }, fechar)}
                >
                  Reativar
                </Button>
              )}
            </div>
          </section>
        ) : null}
      </div>

      {u.podeGerir ? (
        <div className="flex items-center justify-end gap-2 border-t border-base-200 p-3">
          {faltaUnidade ? (
            <p className="mr-auto text-xs text-ink-500">Escolha ao menos uma unidade.</p>
          ) : null}
          <Button
            disabled={ocupado || faltaUnidade || !(mudouPapel || mudouUnidades)}
            onClick={salvar}
          >
            Salvar alterações
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmar !== null} onOpenChange={(a) => !a && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar === "desativar" ? `Desativar ${nomeDe(u)}?` : "Revogar o convite?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === "desativar"
                ? "A pessoa perde o acesso a esta empresa. Dá para reativar depois."
                : "O link deixa de funcionar. Dá para gerar outro depois."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmar === "desativar") onAlterar({ id: u.id, ativo: false }, fechar);
                else onRevogar(u.id);
                setConfirmar(null);
              }}
            >
              {confirmar === "desativar" ? "Desativar" : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
