/** Lado da marca na tela de acesso: diz o que o produto faz e mostra o caminho da conversa ao pedido. */
import { Bot, Check, MessageCircle, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { LuxtiaWordmark } from "@/components/luxtia/Brand";

/** Exemplo fictício, só decorativo: fica fora da leitura de tela. */
function CenaAtendimento() {
  return (
    <div aria-hidden className="relative mt-10 hidden max-w-md [@media(min-height:780px)]:block">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs text-purple-200">
          <span className="grid size-6 place-items-center rounded-full bg-gold-500/20 text-gold-300">
            <Bot className="size-3.5" />
          </span>
          Agente de atendimento
          <span className="ml-auto flex items-center gap-1.5 text-purple-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            No WhatsApp
          </span>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-purple-500/60 px-3 py-2 text-base-50">
            Quero um temaki grande para entrega
          </p>
          <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-purple-100">
            Anotado! Confirmo seu pedido no endereço de sempre?
          </p>
        </div>
      </div>
      <div className="relative -mt-3 ml-8 flex items-center gap-3 rounded-xl bg-base-50 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
          <Check className="size-4" />
        </span>
        <span className="min-w-0 text-sm">
          <span className="block font-semibold text-purple-900">Novo pedido confirmado</span>
          <span className="block text-xs text-ink-500">Entrega · 1 item · R$ 38,50</span>
        </span>
      </div>
    </div>
  );
}

const FRENTES = [
  { icone: MessageCircle, nome: "Conversas" },
  { icone: ShoppingBag, nome: "Pedidos" },
  { icone: UtensilsCrossed, nome: "Cardápio" },
];

export function PainelMarca() {
  return (
    <section className="relative hidden overflow-hidden bg-purple-800 px-14 py-12 lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_10%,rgba(201,162,75,0.09),transparent_70%),radial-gradient(70%_60%_at_0%_100%,rgba(93,74,126,0.55),transparent_70%)]"
      />
      <div className="relative">
        <LuxtiaWordmark />
      </div>
      <div className="relative max-w-lg">
        <h1 className="font-display text-5xl leading-[1.08] text-base-50">
          Do primeiro “oi” ao pedido entregue.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-purple-200">
          Seu agente atende pelo WhatsApp, o pedido chega organizado e a equipe acompanha tudo em um
          só lugar.
        </p>
        <CenaAtendimento />
      </div>
      <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-sm text-purple-200">
        {FRENTES.map(({ icone: Icone, nome }) => (
          <li key={nome} className="flex items-center gap-2">
            <Icone className="size-4 text-gold-300" aria-hidden />
            {nome}
          </li>
        ))}
      </ul>
    </section>
  );
}
