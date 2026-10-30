import { forcaSenha } from "@/lib/acesso/senha";

export function MedidorSenha({ senha }: { senha: string }) {
  if (!senha) return null;
  const f = forcaSenha(senha);
  const cores = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-600", "bg-emerald-600"];
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < f.nota ? cores[f.nota] : "bg-base-200"}`}
          />
        ))}
      </div>
      <p className="text-xs text-ink-600">
        Força: <strong>{f.rotulo}</strong>
      </p>
      {f.avisos.map((a) => (
        <p key={a} className="text-xs text-amber-800">
          {a}
        </p>
      ))}
    </div>
  );
}
