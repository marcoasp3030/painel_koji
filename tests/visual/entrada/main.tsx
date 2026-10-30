/** Prévia das telas ENTRADA1 (depois), dados fictícios. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LuxtiaWordmark, GoldRule } from "@/components/luxtia/Brand";
import { CampoSenha } from "@/components/luxtia/entrada/CampoSenha";
import { CodigoOtp } from "@/components/luxtia/entrada/CodigoOtp";
import { MedidorSenha } from "@/components/luxtia/entrada/MedidorSenha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "./preview.css";

const vista = new URLSearchParams(location.search).get("vista") || "login";

function Moldura({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
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
          {children}
        </div>
      </section>
    </div>
  );
}

function Login() {
  const [senha, setSenha] = useState("••••••••••••");
  return (
    <Moldura titulo="Acessar a plataforma" subtitulo="Use o acesso fornecido pela administração.">
      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="identifier">Usuário ou e-mail</Label>
          <Input
            id="identifier"
            defaultValue="ana.teste@exemplo.com"
            autoComplete="username"
            className="bg-base-50"
          />
        </div>
        <CampoSenha
          id="password"
          label="Senha"
          value={senha}
          onChange={setSenha}
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full">
          Entrar
        </Button>
        <button type="button" className="w-full text-center text-sm text-purple-800 underline-offset-2">
          Esqueci a senha
        </button>
      </form>
    </Moldura>
  );
}

function LoginErro() {
  const [senha, setSenha] = useState("errada");
  return (
    <Moldura titulo="Acessar a plataforma" subtitulo="Use o acesso fornecido pela administração.">
      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="identifier">Usuário ou e-mail</Label>
          <Input id="identifier" defaultValue="ana.teste@exemplo.com" className="bg-base-50" />
        </div>
        <CampoSenha
          id="password"
          label="Senha"
          value={senha}
          onChange={setSenha}
          autoComplete="current-password"
        />
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          E-mail ou senha incorretos.
        </p>
        <Button type="submit" className="w-full">
          Entrar
        </Button>
        <button type="button" className="w-full text-center text-sm text-purple-800">
          Esqueci a senha
        </button>
      </form>
    </Moldura>
  );
}

function SegundoFator() {
  const [codigo, setCodigo] = useState("482");
  return (
    <Moldura
      titulo="Confirmar acesso"
      subtitulo="Digite o código de 6 dígitos do aplicativo autenticador."
    >
      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <CodigoOtp valor={codigo} onChange={setCodigo} />
        <Button type="submit" className="w-full" disabled>
          Continuar
        </Button>
        <Button type="button" variant="ghost" className="w-full">
          Usar código de recuperação
        </Button>
      </form>
    </Moldura>
  );
}

function Convite() {
  const [senha, setSenha] = useState("Tr0c4Segura!9x");
  const [confirma, setConfirma] = useState("Tr0c4Segura!9x");
  return (
    <Moldura titulo="Criar senha" subtitulo="Este convite vale uma vez.">
      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <p className="text-sm text-ink-500">ana.teste@exemplo.com</p>
        <CampoSenha
          id="senha-convite"
          label="Senha"
          value={senha}
          onChange={setSenha}
          autoComplete="new-password"
          minLength={12}
        />
        <MedidorSenha senha={senha} />
        <CampoSenha
          id="confirma-convite"
          label="Confirme a senha"
          value={confirma}
          onChange={setConfirma}
          autoComplete="new-password"
          minLength={12}
        />
        <Button type="submit" className="w-full">
          Definir senha e entrar
        </Button>
      </form>
    </Moldura>
  );
}

function Esqueci() {
  return (
    <Moldura titulo="Esqueci a senha" subtitulo="Informe o e-mail do seu acesso.">
      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="esqueci-email">E-mail</Label>
          <Input
            id="esqueci-email"
            type="email"
            defaultValue="ana.teste@exemplo.com"
            className="bg-base-50"
          />
        </div>
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Peça a redefinição ao gestor da sua empresa.
        </p>
        <Button type="submit" className="w-full">
          Continuar
        </Button>
        <Button type="button" variant="ghost" className="w-full">
          Voltar ao acesso
        </Button>
      </form>
    </Moldura>
  );
}

function Redefinir() {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  return (
    <Moldura titulo="Nova senha" subtitulo="Defina uma senha forte. O link vale uma vez.">
      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <p className="text-sm text-ink-500">ana.teste@exemplo.com</p>
        <CampoSenha
          id="senha-redefinir"
          label="Nova senha"
          value={senha}
          onChange={setSenha}
          autoComplete="new-password"
          minLength={12}
        />
        <MedidorSenha senha={senha} />
        <CampoSenha
          id="confirma-redefinir"
          label="Confirme a senha"
          value={confirma}
          onChange={setConfirma}
          autoComplete="new-password"
          minLength={12}
        />
        <Button type="submit" className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </Moldura>
  );
}

const telas: Record<string, () => React.JSX.Element> = {
  login: Login,
  erro: LoginErro,
  mfa: SegundoFator,
  convite: Convite,
  esqueci: Esqueci,
  redefinir: Redefinir,
};

const Tela = telas[vista] ?? Login;

createRoot(document.getElementById("root")!).render(
  <>
    <div className="selo-demo">DEMONSTRAÇÃO · DADOS FICTÍCIOS · ENTRADA1</div>
    <div className="pt-8">
      <Tela />
    </div>
  </>,
);
