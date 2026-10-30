import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sessaoPrecisaDoCodigo } from "@/lib/acesso/codigos-recuperacao";
import { MSG_LOGIN_ERRO } from "@/lib/acesso/entrada";
import { SENHA_MIN, validarSenhaNova } from "@/lib/acesso/senha";
import {
  checarBloqueioEntrada,
  concluirRedefinicao,
  pedirRedefinicaoSenha,
  registrarFalhaLogin,
  registrarLoginOk,
  verRedefinicao,
} from "@/lib/entrada.functions";
import { usarCodigoRecuperacao } from "@/lib/seguranca.functions";
import { aceitarConvite, verConvite } from "@/lib/usuarios.functions";
import { bootstrapSuperAdmin } from "@/lib/platform.functions";
import { LuxtiaWordmark, GoldRule } from "@/components/luxtia/Brand";
import { CampoSenha } from "@/components/luxtia/entrada/CampoSenha";
import { CodigoOtp } from "@/components/luxtia/entrada/CodigoOtp";
import { MedidorSenha } from "@/components/luxtia/entrada/MedidorSenha";
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

type Etapa = "login" | "mfa" | "esqueci" | "redefinir" | "convite";

function tokenDaHash(chave: "convite" | "redefinir") {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return (
    new URLSearchParams(hash).get(chave) ??
    new URLSearchParams(window.location.search).get(chave)
  );
}

function destinoAposLogin() {
  const p = new URLSearchParams(window.location.search).get("voltar");
  if (p && p.startsWith("/") && !p.startsWith("//")) return p;
  return "/painel";
}

function emailNormalizado(identifier: string) {
  return identifier.includes("@")
    ? identifier.trim().toLowerCase()
    : `${identifier.trim().toLowerCase()}@luxtia.local`;
}

function Login() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tokenConvite, setTokenConvite] = useState<string | null>(null);
  const [tokenRedefinir, setTokenRedefinir] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [codigoRecuperacao, setCodigoRecuperacao] = useState("");
  const checarBloqueio = useServerFn(checarBloqueioEntrada);
  const falhaLogin = useServerFn(registrarFalhaLogin);
  const loginOk = useServerFn(registrarLoginOk);
  const pedirRedef = useServerFn(pedirRedefinicaoSenha);
  const usarRecuperacao = useServerFn(usarCodigoRecuperacao);

  useEffect(() => {
    const convite = tokenDaHash("convite");
    const redef = tokenDaHash("redefinir");
    setTokenConvite(convite);
    setTokenRedefinir(redef);
    if (convite) setEtapa("convite");
    else if (redef) setEtapa("redefinir");
    void bootstrapSuperAdmin();
    if (convite || redef) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: destinoAposLogin(), replace: true });
    });
  }, [navigate]);

  async function irAoPainel(email: string) {
    await loginOk({ data: { email } });
    navigate({ to: destinoAposLogin(), replace: true });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAviso(null);
    setLoading(true);
    const email = emailNormalizado(identifier);
    try {
      const bloqueio = await checarBloqueio({ data: { email } });
      if (bloqueio.bloqueado) {
        setError(bloqueio.mensagem);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const r = await falhaLogin({ data: { email, motivo: "senha" } });
        setError(r.mensagem ?? MSG_LOGIN_ERRO);
        return;
      }
      const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (sessaoPrecisaDoCodigo(nivel)) {
        setCodigo("");
        setCodigoRecuperacao("");
        setModoRecuperacao(false);
        setEtapa("mfa");
        return;
      }
      await irAoPainel(email);
    } catch {
      setError(MSG_LOGIN_ERRO);
    } finally {
      setLoading(false);
    }
  }

  async function confirmarCodigo(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const email = emailNormalizado(identifier);
    try {
      if (modoRecuperacao) {
        const limpo = codigoRecuperacao.replace(/\s/g, "");
        const r = await usarRecuperacao({ data: { codigo: limpo } });
        const restam =
          r && typeof r === "object" && "codigos_restantes" in r
            ? Number((r as { codigos_restantes: number }).codigos_restantes)
            : null;
        setAviso(
          restam != null && restam <= 2
            ? `Código aceito. Restam só ${restam} códigos — regenere em Segurança.`
            : "Código aceito. Você entrou com um código de recuperação.",
        );
        await irAoPainel(email);
        return;
      }
      const limpo = codigo.replace(/\D/g, "");
      if (!/^\d{6}$/.test(limpo)) {
        setError("Informe os 6 dígitos do aplicativo.");
        return;
      }
      const lista = await supabase.auth.mfa.listFactors();
      const fator = lista.data?.totp[0];
      if (!fator) {
        setError("Não há aplicativo autenticador nesta conta.");
        return;
      }
      const desafio = await supabase.auth.mfa.challenge({ factorId: fator.id });
      if (desafio.error || !desafio.data) {
        setError("Não foi possível validar o código.");
        return;
      }
      const ver = await supabase.auth.mfa.verify({
        factorId: fator.id,
        challengeId: desafio.data.id,
        code: limpo,
      });
      if (ver.error) {
        const r = await falhaLogin({ data: { email, motivo: "mfa" } });
        setError(r.mensagem ?? "Código incorreto. Tente de novo.");
        setCodigo("");
        return;
      }
      await irAoPainel(email);
    } catch {
      setError("Código não conferiu.");
    } finally {
      setLoading(false);
    }
  }

  async function enviarEsqueci(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAviso(null);
    setLoading(true);
    try {
      const email = identifier.includes("@")
        ? identifier.trim().toLowerCase()
        : `${identifier.trim().toLowerCase()}@luxtia.local`;
      const r = await pedirRedef({ data: { email } });
      setAviso(r.mensagem);
    } catch {
      setError("Não foi possível pedir a redefinição agora.");
    } finally {
      setLoading(false);
    }
  }

  const titulo =
    etapa === "convite"
      ? "Criar senha"
      : etapa === "redefinir"
        ? "Nova senha"
        : etapa === "esqueci"
          ? "Esqueci a senha"
          : etapa === "mfa"
            ? "Confirmar acesso"
            : "Acessar a plataforma";

  const subtitulo =
    etapa === "convite"
      ? "Este convite vale uma vez."
      : etapa === "redefinir"
        ? "Defina uma senha forte. O link vale uma vez."
        : etapa === "esqueci"
          ? "Informe o e-mail do seu acesso."
          : etapa === "mfa"
            ? modoRecuperacao
              ? "Digite um dos códigos de recuperação."
              : "Digite o código de 6 dígitos do aplicativo autenticador."
            : "Use o acesso fornecido pela administração.";

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
            Integrações de delivery e mensagens curadas, organizadas e governadas em um único lugar.
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
          <h2 className="mt-8 font-display text-3xl text-purple-800 lg:mt-0">{titulo}</h2>
          <p className="mt-2 text-ink-500">{subtitulo}</p>
          <GoldRule className="mt-6" />

          {etapa === "convite" && tokenConvite ? (
            <AceitarConvite
              token={tokenConvite}
              onPronto={(email) => {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setTokenConvite(null);
                setIdentifier(email);
                setPassword("");
                setEtapa("login");
                if (email) setError("Senha definida. Entre com ela.");
              }}
            />
          ) : etapa === "redefinir" && tokenRedefinir ? (
            <RedefinirSenha
              token={tokenRedefinir}
              onPronto={(email) => {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setTokenRedefinir(null);
                setIdentifier(email);
                setPassword("");
                setEtapa("login");
                setAviso("Senha alterada. Entre com a nova senha.");
              }}
              onCancelar={() => {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setTokenRedefinir(null);
                setEtapa("login");
              }}
            />
          ) : etapa === "esqueci" ? (
            <form onSubmit={(e) => void enviarEsqueci(e)} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="esqueci-email">E-mail</Label>
                <Input
                  id="esqueci-email"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                  className="bg-base-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700"
                  required
                />
              </div>
              {aviso ? (
                <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {aviso}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando…" : "Continuar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setEtapa("login");
                  setError(null);
                  setAviso(null);
                }}
              >
                Voltar ao acesso
              </Button>
            </form>
          ) : etapa === "mfa" ? (
            <form onSubmit={(e) => void confirmarCodigo(e)} className="mt-8 space-y-5">
              {modoRecuperacao ? (
                <div className="space-y-2">
                  <Label htmlFor="codigo-recuperacao">Código de recuperação</Label>
                  <Input
                    id="codigo-recuperacao"
                    value={codigoRecuperacao}
                    onChange={(e) => setCodigoRecuperacao(e.target.value)}
                    autoComplete="one-time-code"
                    className="bg-base-50 font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700"
                    required
                  />
                </div>
              ) : (
                <CodigoOtp valor={codigo} onChange={setCodigo} disabled={loading} />
              )}
              {error ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  (modoRecuperacao ? codigoRecuperacao.trim().length < 8 : codigo.length !== 6)
                }
              >
                {loading ? "Conferindo…" : "Continuar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setModoRecuperacao((v) => !v);
                  setError(null);
                  setCodigo("");
                  setCodigoRecuperacao("");
                }}
              >
                {modoRecuperacao ? "Usar código do aplicativo" : "Usar código de recuperação"}
              </Button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier">Usuário ou e-mail</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  className="bg-base-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700"
                  required
                />
              </div>
              <CampoSenha
                id="password"
                label="Senha"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                disabled={loading}
                required
              />
              {aviso ? (
                <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {aviso}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando…" : "Entrar"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-purple-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-purple-700"
                onClick={() => {
                  setEtapa("esqueci");
                  setError(null);
                  setAviso(null);
                }}
              >
                Esqueci a senha
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function AceitarConvite({ token, onPronto }: { token: string; onPronto: (email: string) => void }) {
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
    const v = validarSenhaNova(senha, confirma);
    if (v) {
      setErro(v);
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const r = await aceitar({ data: { token, senha } });
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      const entrou = await supabase.auth.signInWithPassword({ email: r.email, password: senha });
      if (entrou.error) {
        onPronto(r.email);
        return;
      }
      navigate({ to: destinoAposLogin(), replace: true });
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
      <CampoSenha
        id="senha-convite"
        label="Senha"
        value={senha}
        onChange={setSenha}
        autoComplete="new-password"
        disabled={ocupado}
        required
        minLength={SENHA_MIN}
      />
      <MedidorSenha senha={senha} />
      <CampoSenha
        id="confirma-convite"
        label="Confirme a senha"
        value={confirma}
        onChange={setConfirma}
        autoComplete="new-password"
        disabled={ocupado}
        required
        minLength={SENHA_MIN}
      />
      {erro ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Definir senha e entrar"}
      </Button>
    </form>
  );
}

function RedefinirSenha({
  token,
  onPronto,
  onCancelar,
}: {
  token: string;
  onPronto: (email: string) => void;
  onCancelar: () => void;
}) {
  const ver = useServerFn(verRedefinicao);
  const concluir = useServerFn(concluirRedefinicao);
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
        if (vivo) setErro("Este link não vale mais.");
      });
    return () => {
      vivo = false;
    };
  }, [token, ver]);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    const v = validarSenhaNova(senha, confirma);
    if (v) {
      setErro(v);
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const r = await concluir({ data: { token, senha, confirma } });
      onPronto(r.email);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Este link não vale mais.");
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
        <Button type="button" variant="outline" className="w-full" onClick={onCancelar}>
          Ir para o acesso
        </Button>
      </div>
    );
  }
  if (!email) return <p className="mt-8 text-sm text-ink-500">Conferindo o link…</p>;

  return (
    <form onSubmit={(event) => void enviar(event)} className="mt-8 space-y-5">
      <p className="text-sm text-ink-500">{email}</p>
      <CampoSenha
        id="senha-redefinir"
        label="Nova senha"
        value={senha}
        onChange={setSenha}
        autoComplete="new-password"
        disabled={ocupado}
        required
        minLength={SENHA_MIN}
      />
      <MedidorSenha senha={senha} />
      <CampoSenha
        id="confirma-redefinir"
        label="Confirme a senha"
        value={confirma}
        onChange={setConfirma}
        autoComplete="new-password"
        disabled={ocupado}
        required
        minLength={SENHA_MIN}
      />
      {erro ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
