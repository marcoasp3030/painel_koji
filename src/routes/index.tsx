import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { aceitarConvite, verConvite } from "@/lib/usuarios.functions";
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

function tokenConvite() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return new URLSearchParams(hash).get("convite") ?? new URLSearchParams(window.location.search).get("convite");
}

function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const convite = tokenConvite();
    setToken(convite);
    void bootstrapSuperAdmin();
    if (convite) return;
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
          <h2 className="mt-8 font-display text-3xl text-purple-800 lg:mt-0">
            {token ? "Criar senha" : "Acessar a plataforma"}
          </h2>
          <p className="mt-2 text-ink-500">
            {token ? "Este convite vale uma vez." : "Use o acesso fornecido pela administração."}
          </p>
          <GoldRule className="mt-6" />

          {token ? (
            <AceitarConvite
              token={token}
              onPronto={(email) => {
                window.history.replaceState(null, "", window.location.pathname);
                setToken(null);
                setIdentifier(email);
                setPassword("");
                if (email) setError("Senha definida. Entre com ela.");
              }}
            />
          ) : (
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
          )}
        </div>
      </section>
    </div>
  );
}

function AceitarConvite({
  token,
  onPronto,
}: {
  token: string;
  onPronto: (email: string) => void;
}) {
  const navigate = useNavigate();
  const ver = useServerFn(verConvite);
  const aceitar = useServerFn(aceitarConvite);
  const [email, setEmail] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void ver({ data: { token } })
      .then((r) => {
        if (vivo) setEmail(r.email);
      })
      .catch(() => {
        if (vivo) setErro("Este convite não vale mais.");
      });
    return () => {
      vivo = false;
    };
  }, [token, ver]);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const r = await aceitar({ data: { token, senha } });
      window.history.replaceState(null, "", window.location.pathname);
      const entrou = await supabase.auth.signInWithPassword({ email: r.email, password: senha });
      if (entrou.error) {
        onPronto(r.email);
        return;
      }
      navigate({ to: "/painel", replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Este convite não vale mais.");
    } finally {
      setOcupado(false);
    }
  }

  if (!email && erro) {
    return (
      <div className="mt-8 space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
        <Button type="button" variant="outline" className="w-full" onClick={() => onPronto("")}>
          Ir para o acesso
        </Button>
      </div>
    );
  }
  if (!email) return <p className="mt-8 text-sm text-ink-500">Conferindo o convite…</p>;

  return (
    <form onSubmit={(event) => void enviar(event)} className="mt-8 space-y-5">
      <p className="text-sm text-ink-500">{email}</p>
      <div className="space-y-2">
        <Label htmlFor="senha-convite">Senha</Label>
        <Input
          id="senha-convite"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          className="bg-base-50"
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirma-convite">Confirme a senha</Label>
        <Input
          id="confirma-convite"
          type="password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          autoComplete="new-password"
          className="bg-base-50"
          required
          minLength={8}
        />
      </div>
      {erro ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Definir senha e entrar"}
      </Button>
    </form>
  );
}
