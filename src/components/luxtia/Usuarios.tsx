/** Tela de usuários da empresa. O servidor decide o que cada papel pode conceder. */
import { useEffect, useState } from "react";
import { CabecalhoPagina, Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVISO_LINK_CONVITE } from "@/lib/acesso/convite";
import { ROTULO_PAPEL, type PapelAcesso } from "@/lib/acesso/papeis";

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
};

function quando(iso: string | null) {
  if (!iso) return "Nunca entrou";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function UsuariosTela({
  empresa,
  concediveis,
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
}: {
  empresa: string;
  concediveis: PapelAcesso[];
  unidades: { codigo: string; nome: string }[];
  usuarios: UsuarioLinha[];
  ocupado?: boolean;
  aviso?: string | null;
  linkConvite?: string | null;
  convitePorEmail?: boolean;
  onConvidar: (d: {
    email: string;
    nome: string;
    papel: Exclude<PapelAcesso, "plataforma">;
    unidades: string[];
  }) => void;
  onAlterar: (d: {
    id: string;
    papel?: Exclude<PapelAcesso, "plataforma">;
    unidades?: string[];
    ativo?: boolean;
  }) => void;
  onReenviar: (id: string) => void;
  onRevogar: (id: string) => void;
  onRedefinirSenha?: (userId: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => setCopiado(false), [linkConvite]);
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<PapelAcesso>(concediveis[0] ?? "funcionario");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const gestor = papel === "gestor";

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        sobretitulo={empresa}
        titulo="Usuários"
        descricao={
          convitePorEmail
            ? "O convite chega por e-mail. A senha não é definida aqui."
            : "O e-mail não está configurado. O link do convite aparece uma vez, vale 24 horas e pode ser revogado."
        }
      />
      {linkConvite ? (
        <div role="status" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <p>{AVISO_LINK_CONVITE}</p>
          <p className="break-all font-mono text-xs">{linkConvite}</p>
          <p>O link vale 24 horas, serve uma vez e pode ser revogado nesta lista.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(linkConvite).then(() => setCopiado(true));
            }}
          >
            {copiado ? "Copiado" : "Copiar link"}
          </Button>
        </div>
      ) : null}
      {aviso && !linkConvite ? (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {aviso}
        </p>
      ) : null}
      <Cartao className="space-y-4 p-5">
        <h2 className="font-display text-xl text-purple-900">Convidar</h2>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (papel === "plataforma") return;
            onConvidar({ email, nome, papel, unidades: gestor ? [] : escolhidas });
          }}
        >
          <label className="block text-sm font-medium">
            E-mail
            <Input
              className="mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Nome
            <Input className="mt-1" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Papel
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={papel}
              onChange={(e) => setPapel(e.target.value as PapelAcesso)}
            >
              {concediveis.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm">
            <p className="font-medium">Unidades</p>
            {gestor ? (
              <p className="mt-2 text-ink-500">O gestor acessa todas as unidades.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {unidades.map((u) => (
                  <li key={u.codigo}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={escolhidas.includes(u.codigo)}
                        onChange={(e) =>
                          setEscolhidas(
                            e.target.checked
                              ? [...escolhidas, u.codigo]
                              : escolhidas.filter((c) => c !== u.codigo),
                          )
                        }
                      />
                      {u.nome}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={ocupado || concediveis.length === 0}>
              Enviar convite
            </Button>
          </div>
        </form>
      </Cartao>
      {usuarios.length === 0 ? (
        <EstadoVazio titulo="Ninguém nesta empresa" texto="O primeiro convite aparece aqui." />
      ) : (
        <ul className="space-y-3">
          {usuarios.map((u) => (
            <li key={u.id}>
              <Cartao className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink-900">{u.nome || u.email}</p>
                  <p className="text-sm text-ink-500">{u.email}</p>
                  <p className="text-xs text-ink-500">
                    {ROTULO_PAPEL[u.papel]}
                    {u.papel === "gestor" ? " · todas as unidades" : ` · ${u.unidades.join(", ") || "sem unidade"}`}
                    {" · "}
                    {u.ativo ? "ativo" : "inativo"}
                    {" · último acesso "}
                    {quando(u.ultimo_acesso)}
                    {u.convitePendente ? ` · convite válido até ${quando(u.conviteExpiraEm ?? null)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Label className="sr-only" htmlFor={`papel-${u.id}`}>
                    Papel de {u.email}
                  </Label>
                  <select
                    id={`papel-${u.id}`}
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={u.papel}
                    disabled={ocupado || !concediveis.includes(u.papel)}
                    onChange={(e) =>
                      onAlterar({
                        id: u.id,
                        papel: e.target.value as Exclude<PapelAcesso, "plataforma">,
                        unidades: u.unidades,
                      })
                    }
                  >
                    {(concediveis.includes(u.papel) ? concediveis : [u.papel]).map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_PAPEL[p]}
                      </option>
                    ))}
                  </select>
                  {!u.ultimo_acesso ? (
                    <Button variant="outline" size="sm" disabled={ocupado} onClick={() => onReenviar(u.id)}>
                      {convitePorEmail ? "Reenviar convite" : "Gerar novo link"}
                    </Button>
                  ) : null}
                  {u.ultimo_acesso && onRedefinirSenha ? (
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
                    <Button variant="outline" size="sm" disabled={ocupado} onClick={() => onRevogar(u.id)}>
                      Revogar convite
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ocupado}
                    onClick={() => onAlterar({ id: u.id, ativo: !u.ativo })}
                  >
                    {u.ativo ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
