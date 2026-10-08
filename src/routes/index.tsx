import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSuperAdmin } from "@/lib/platform.functions";
import { LuxtiaWordmark, GoldRule } from "@/components/luxtia/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Luxtia · Acesso à plataforma de integrações" },
      {
        name: "description",
        content:
          "Entre na plataforma Luxtia para configurar integrações de delivery e mensagens: iFood, 99Food, WhatsApp Oficial e Uazapi.",
      },
      { property: "og:title", content: "Luxtia · Plataforma de integrações" },
      {
        property: "og:description",
        content:
          "Acesso multi-tenant para configurar integrações de delivery e mensagens com governança.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapSuperAdmin();
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const email = identifier.includes("@")
      ? identifier.trim()
      : `${identifier.trim().toLowerCase()}@luxtia.local`;
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Usuário ou senha inválidos.");
      return;
    }
    navigate({ to: "/painel", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-purple-800 px-14 py-14 lg:flex">
        <LuxtiaWordmark />
        <div className="max-w-md">
          <GoldRule className="mb-8" />
          <h1 className="font-display text-5xl leading-[1.05] text-base-50">
            Menos hype.
            <br />
            Mais direção.
          </h1>
          <p className="mt-6 text-purple-300">
            Integrações de delivery e mensagens curadas, organizadas e governadas em um único
            lugar.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-purple-400">
          Curadoria estratégica de tecnologia
        </p>
      </section>

      <section className="flex items-center justify-center bg-base-100 px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-base-200 bg-card px-6 py-8 shadow-[0_1px_2px_rgba(26,21,32,0.04),0_16px_40px_rgba(46,35,64,0.08)] sm:px-8">
          <div className="lg:hidden">
            <LuxtiaWordmark tone="dark" />
          </div>
          <h2 className="mt-8 font-display text-3xl text-purple-800 lg:mt-0">Acessar a plataforma</h2>
          <p className="mt-2 text-ink-500">Use o acesso fornecido pela administração.</p>
          <GoldRule className="mt-6" />

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier">Usuário ou e-mail</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                className="bg-base-50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-base-50"
                required
              />
            </div>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
