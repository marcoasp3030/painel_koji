/**
 * Peças compartilhadas das telas do gateway de agentes. A tela só mostra ou
 * esconde ações conforme o papel; quem protege de fato é o servidor.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/luxtia/AppShell";
import { CabecalhoPagina, Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { obterAcessoGateway } from "@/lib/gateway.functions";
import { listarEmpresasGateway } from "@/lib/gateway-empresas.functions";
import type { PapelGateway } from "@/lib/gateway/tipos";
import { ADMIN_NAV, TENANT_NAV } from "@/lib/nav";

export function useAcessoGateway() {
  const buscar = useServerFn(obterAcessoGateway);
  return useQuery({
    queryKey: ["gateway", "acesso"],
    queryFn: () => buscar(),
    staleTime: 60_000,
    retry: false,
  });
}

const CHAVE_EMPRESA = "luxtia:gateway-empresa";

/** Empresa escolhida pelo admin da plataforma, lembrada entre as telas. */
function useEmpresaEscolhida(ativo: boolean) {
  const buscar = useServerFn(listarEmpresasGateway);
  const lista = useQuery({
    queryKey: ["gateway", "empresas"],
    queryFn: () => buscar({ data: {} }),
    enabled: ativo,
  });
  const [empresa, setEmpresa] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo || !lista.data) return;
    const ids = lista.data.itens.map((e) => e.id);
    let salva: string | null = null;
    try {
      salva = localStorage.getItem(CHAVE_EMPRESA);
    } catch {
      /* Sem armazenamento local, começa pela primeira empresa. */
    }
    setEmpresa((atual) =>
      atual && ids.includes(atual)
        ? atual
        : salva && ids.includes(salva)
          ? salva
          : (ids[0] ?? null),
    );
  }, [ativo, lista.data]);

  function escolher(id: string) {
    setEmpresa(id);
    try {
      localStorage.setItem(CHAVE_EMPRESA, id);
    } catch {
      /* A escolha vale enquanto a tela estiver aberta. */
    }
  }

  return { empresa, escolher, empresas: lista.data?.itens ?? [], carregando: lista.isLoading };
}

export type ContextoGateway = {
  papel: PapelGateway;
  /** Tenant escolhido pelo admin da plataforma; nulo para usuários de empresa. */
  empresa: string | null;
};

export function PaginaGateway({
  sobretitulo = "Agentes",
  titulo,
  descricao,
  papeis,
  semEmpresa = false,
  empresaFixa = null,
  semCabecalho = false,
  children,
}: {
  sobretitulo?: string;
  titulo: string;
  descricao?: string;
  papeis: PapelGateway[];
  /** A tela não depende de uma empresa escolhida (ex.: lista de empresas). */
  semEmpresa?: boolean;
  /** Empresa vinda do endereço (ex.: página de um agente); dispensa o seletor. */
  empresaFixa?: string | null;
  /** A própria tela desenha o cabeçalho (ex.: nome do agente). */
  semCabecalho?: boolean;
  children: (ctx: ContextoGateway) => React.ReactNode;
}) {
  const acesso = useAcessoGateway();
  const papel = acesso.data?.papel ?? null;
  const plataforma = papel === "plataforma";
  const escolha = useEmpresaEscolhida(plataforma && !semEmpresa && !empresaFixa);

  useEffect(() => {
    if (!plataforma || !empresaFixa) return;
    try {
      localStorage.setItem(CHAVE_EMPRESA, empresaFixa);
    } catch {
      /* Sem armazenamento local, a lista volta para a primeira empresa. */
    }
  }, [plataforma, empresaFixa]);

  let conteudo: React.ReactNode;
  if (acesso.isLoading) {
    conteudo = <p className="mt-8 text-ink-500">Carregando…</p>;
  } else if (acesso.isError || !papel) {
    conteudo = (
      <Cartao className="mt-8">
        <EstadoVazio
          titulo="Sem acesso aos agentes"
          texto={
            acesso.data?.motivo ??
            (acesso.error instanceof Error ? acesso.error.message : "Fale com a administração.")
          }
        />
      </Cartao>
    );
  } else if (!papeis.includes(papel)) {
    conteudo = (
      <Cartao className="mt-8">
        <EstadoVazio
          titulo="Tela indisponível"
          texto="Esta tela não está disponível para o seu tipo de acesso."
        />
      </Cartao>
    );
  } else if (plataforma && empresaFixa) {
    conteudo = children({ papel, empresa: empresaFixa });
  } else if (plataforma && !semEmpresa) {
    conteudo = (
      <>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs space-y-2">
            <Label htmlFor="empresa-gateway">Empresa</Label>
            <Select
              value={escolha.empresa ?? ""}
              onValueChange={escolha.escolher}
              disabled={escolha.carregando || escolha.empresas.length === 0}
            >
              <SelectTrigger id="empresa-gateway" className="bg-card">
                <SelectValue
                  placeholder={escolha.carregando ? "Carregando…" : "Escolha a empresa"}
                />
              </SelectTrigger>
              <SelectContent>
                {escolha.empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} · {e.id}
                    {e.status === "suspenso" ? " (suspensa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {escolha.empresa ? (
          children({ papel, empresa: escolha.empresa })
        ) : escolha.carregando ? null : (
          <Cartao className="mt-6">
            <EstadoVazio titulo="Nenhuma empresa" texto="Cadastre uma empresa na tela Empresas." />
          </Cartao>
        )}
      </>
    );
  } else {
    conteudo = children({ papel, empresa: null });
  }

  return (
    <AppShell
      nav={plataforma ? ADMIN_NAV : TENANT_NAV}
      context={plataforma ? "Super Admin" : "Empresa"}
    >
      {semCabecalho && papel && papeis.includes(papel) ? null : (
        <CabecalhoPagina
          sobretitulo={sobretitulo}
          titulo={titulo}
          {...(descricao ? { descricao } : {})}
        />
      )}
      {conteudo}
    </AppShell>
  );
}

/** Mostra um segredo uma única vez; ao fechar, o valor some da tela. */
export function SegredoUmaVez({
  titulo,
  descricao,
  valor,
  onFechar,
}: {
  titulo: string;
  descricao: string;
  valor: string | null;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => setCopiado(false), [valor]);

  async function copiar() {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Dialog open={valor !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-lg border border-gold-500/60 bg-gold-300/20 px-3 py-2 text-sm text-ink-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden />
          <p>
            <strong>Copie agora.</strong> Este valor não será mostrado de novo. Guarde-o como uma
            senha.
          </p>
        </div>
        <code className="block break-all rounded-lg border border-base-200 bg-base-50 px-3 py-2 font-mono text-xs text-ink-900 select-all">
          {valor}
        </code>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={copiar}>
            {copiado ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
          <Button onClick={onFechar}>Já copiei, fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TONS = {
  neutro: "bg-base-100 text-ink-700 border-base-200",
  sucesso: "bg-success-soft text-success border-transparent",
  alerta: "bg-gold-300/30 text-gold-700 border-transparent",
  roxo: "bg-purple-50 text-purple-700 border-transparent",
  perigo: "bg-destructive/10 text-destructive border-transparent",
} as const;

export function Etiqueta({
  tom = "neutro",
  children,
}: {
  tom?: keyof typeof TONS;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}

export function dataHora(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Tela vazia que diz o que fazer, com a ação quando o papel permite. */
export function Vazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-xl text-purple-800">{titulo}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{texto}</p>
      {acao ? <div className="mt-5 flex justify-center">{acao}</div> : null}
    </div>
  );
}

/** Frase curta de ajuda logo abaixo de um campo. */
export function Ajuda({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-xs leading-relaxed text-ink-500">
      {children}
    </p>
  );
}

/** Rótulo do campo com a frase de ajuda do vocabulário. */
export function RotuloCampo({
  htmlFor,
  campo,
}: {
  htmlFor: string;
  campo: { rotulo: string; ajuda: string };
}) {
  return (
    <>
      <Label htmlFor={htmlFor}>{campo.rotulo}</Label>
      <Ajuda>{campo.ajuda}</Ajuda>
    </>
  );
}
