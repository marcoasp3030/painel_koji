/** Endereço por CEP: preenche sozinho, fica editável e pede o que ajuda na entrega. */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Pencil, SearchX } from "lucide-react";
import { mascaraCep, soDigitosCep, type Endereco } from "@/lib/cardapio";

export type ResultadoCep =
  | { ok: true; rua: string; bairro: string; cidade: string; uf: string }
  | { ok: false; motivo: string | null };

type Busca = "parado" | "buscando" | "achou" | "nao_achou" | "fora";

const classeCampo =
  "h-12 w-full rounded-xl border border-base-200 bg-base-50 px-3 text-base outline-none transition-colors placeholder:text-ink-300 focus:border-purple-500 focus:bg-card focus:ring-2 focus:ring-purple-100";

function Campo({
  rotulo,
  valor,
  mudar,
  obrigatorio = false,
  campoRef,
  ...resto
}: {
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  obrigatorio?: boolean;
  campoRef?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium text-ink-700">
        {rotulo}
        {obrigatorio ? null : <span className="font-normal text-ink-500"> (opcional)</span>}
      </span>
      <input
        {...resto}
        ref={campoRef}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        className={resto.className ?? classeCampo}
      />
    </label>
  );
}

export function EnderecoEntrega({
  valor,
  mudar,
  buscarCep,
}: {
  valor: Endereco;
  mudar: (parte: Partial<Endereco>) => void;
  buscarCep: (cep: string) => Promise<ResultadoCep>;
}) {
  const jaPreenchido = Boolean(valor.rua);
  const [busca, setBusca] = useState<Busca>(jaPreenchido && valor.cep ? "achou" : "parado");
  const [editando, setEditando] = useState(jaPreenchido && !valor.cep);
  const numero = useRef<HTMLInputElement>(null);
  const rua = useRef<HTMLInputElement>(null);
  // A resposta de um CEP antigo não pode sobrescrever o que foi digitado depois.
  const pedido = useRef(0);

  const abrirFormulario = busca === "achou" || editando;

  async function procurar(cep: string) {
    const vez = (pedido.current += 1);
    setBusca("buscando");
    const r = await buscarCep(cep).catch(() => ({ ok: false as const, motivo: null }));
    if (vez !== pedido.current) return;
    if (r.ok) {
      mudar({ rua: r.rua, bairro: r.bairro, cidade: r.cidade, uf: r.uf });
      setBusca("achou");
      // CEP de cidade inteira não traz a rua.
      setEditando(!r.rua || !r.bairro);
      return;
    }
    const inexistente = r.motivo === "cep_inexistente";
    // Rua de um CEP anterior não pode ficar valendo para um CEP que não existe.
    if (inexistente) mudar({ rua: "", bairro: "", cidade: "", uf: "" });
    setBusca(inexistente ? "nao_achou" : "fora");
    setEditando(true);
  }

  function digitarCep(texto: string) {
    const cep = soDigitosCep(texto);
    pedido.current += 1;
    mudar({ cep });
    if (cep.length === 8) void procurar(cep);
    else if (busca !== "parado") setBusca("parado");
  }

  useEffect(() => {
    if (busca !== "achou") return;
    (editando && !valor.rua ? rua : numero).current?.focus({ preventScroll: true });
    // Só quando a busca termina: depois disso o foco é de quem está digitando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">CEP</span>
        <span className="relative block">
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            aria-describedby="situacao-cep"
            value={mascaraCep(valor.cep)}
            onChange={(e) => digitarCep(e.target.value)}
            className={`${classeCampo} pr-11 text-lg tracking-wide`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {busca === "buscando" ? (
              <Loader2 className="size-5 animate-spin text-[var(--cd-marca)]" aria-hidden />
            ) : busca === "achou" ? (
              <CheckCircle2 className="size-5 text-success" aria-hidden />
            ) : null}
          </span>
        </span>
      </label>
      <div id="situacao-cep" aria-live="polite">
        {busca === "buscando" ? (
          <p className="text-sm text-ink-500">Procurando o endereço…</p>
        ) : busca === "nao_achou" ? (
          <p className="flex items-center gap-1.5 text-sm text-gold-700">
            <SearchX className="size-4 shrink-0" aria-hidden />
            Não encontramos este CEP. Confira ou preencha abaixo.
          </p>
        ) : busca === "fora" ? (
          <p className="text-sm text-gold-700">
            Não conseguimos buscar agora. Preencha o endereço abaixo.
          </p>
        ) : !abrirFormulario ? (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-sm text-[var(--cd-marca)] underline underline-offset-2"
          >
            Não sei meu CEP
          </button>
        ) : null}
      </div>

      {abrirFormulario ? (
        <div className="space-y-3 duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
          {editando ? (
            <>
              <Campo
                campoRef={rua}
                rotulo="Rua"
                obrigatorio
                autoComplete="address-line1"
                valor={valor.rua}
                mudar={(v) => mudar({ rua: v })}
              />
              <Campo
                rotulo="Bairro"
                obrigatorio
                autoComplete="address-level3"
                valor={valor.bairro}
                mudar={(v) => mudar({ bairro: v })}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
                <Campo
                  rotulo="Cidade"
                  obrigatorio
                  autoComplete="address-level2"
                  valor={valor.cidade}
                  mudar={(v) => mudar({ cidade: v })}
                />
                <Campo
                  rotulo="UF"
                  obrigatorio
                  maxLength={2}
                  autoComplete="address-level1"
                  className={`${classeCampo} uppercase`}
                  valor={valor.uf}
                  mudar={(v) => mudar({ uf: v })}
                />
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-purple-50 p-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--cd-marca)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium leading-snug text-ink-900">{valor.rua}</p>
                <p className="text-sm text-ink-700">
                  {valor.bairro} · {valor.cidade}
                  {valor.uf ? `/${valor.uf}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--cd-marca)] active:bg-purple-100"
              >
                <Pencil className="size-3.5" aria-hidden /> Editar
              </button>
            </div>
          )}

          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-sm font-medium text-ink-700">Número</span>
              <input
                ref={numero}
                inputMode="text"
                autoComplete="off"
                placeholder="123"
                disabled={valor.semNumero}
                value={valor.semNumero ? "" : valor.numero}
                onChange={(e) => mudar({ numero: e.target.value })}
                className={`${classeCampo} disabled:bg-base-100 disabled:placeholder:text-transparent`}
              />
            </label>
            <Campo
              rotulo="Complemento"
              placeholder="Apto, bloco, casa"
              autoComplete="address-line2"
              maxLength={80}
              valor={valor.complemento}
              mudar={(v) => mudar({ complemento: v })}
            />
          </div>
          <label className="flex min-h-9 items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="size-5 accent-purple-800"
              checked={valor.semNumero}
              onChange={(e) => mudar({ semNumero: e.target.checked })}
            />
            Endereço sem número
          </label>
          <Campo
            rotulo="Ponto de referência"
            placeholder="Ex.: portão azul, em frente à padaria"
            maxLength={120}
            valor={valor.referencia}
            mudar={(v) => mudar({ referencia: v })}
          />
        </div>
      ) : null}
    </div>
  );
}
