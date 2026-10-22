/** Chaves de formulário: presas a um agente, com sites permitidos e limite por minuto. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Etiqueta, RotuloCampo, SegredoUmaVez, Vazio, dataHora } from "@/components/luxtia/Gateway";
import { Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { origensDoTexto, type ChaveFormulario } from "@/lib/gateway/documentos";

export function ChavesFormularioTela({
  itens,
  agentes,
  podeCriar,
  carregando,
  erro,
  salvando,
  onCriar,
  onRevogar,
  chaveNova,
  onFecharChave,
}: {
  itens: ChaveFormulario[];
  agentes: { id: string; nome: string }[];
  podeCriar: boolean;
  carregando: boolean;
  erro?: string | undefined;
  salvando: boolean;
  onCriar: (dados: {
    nome: string;
    agente_id: string;
    limite_por_minuto: number;
    origens: string[];
  }) => void;
  onRevogar: (chave: ChaveFormulario) => void;
  chaveNova: string | null;
  onFecharChave: () => void;
}) {
  const [criando, setCriando] = useState(false);
  const nomeAgente = (id: string) => agentes.find((a) => a.id === id)?.nome ?? id;
  return (
    <>
      {podeCriar ? (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden /> Nova chave
          </Button>
        </div>
      ) : null}
      <Cartao className={podeCriar ? "mt-4" : "mt-6"}>
        {carregando ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : erro ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={erro} />
        ) : itens.length === 0 ? (
          <Vazio
            titulo="Nenhuma chave de formulário"
            texto="Crie uma chave presa a um agente para o site enviar documentos."
            acao={
              podeCriar ? (
                <Button onClick={() => setCriando(true)}>
                  <Plus className="size-4" aria-hidden /> Criar chave
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {itens.map((c) => {
              const revogada = Boolean(c.revogada_em);
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 border-b border-base-200 px-5 py-4 last:border-0 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{c.nome}</p>
                      <Etiqueta tom={revogada ? "perigo" : "sucesso"}>
                        {revogada ? "Revogada" : "Ativa"}
                      </Etiqueta>
                      <Etiqueta tom="roxo">{nomeAgente(c.agente_id)}</Etiqueta>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {c.limite_por_minuto} por minuto · criada {dataHora(c.criado_em)}
                      {c.origens_permitidas.length
                        ? ` · sites ${c.origens_permitidas.join(", ")}`
                        : " · qualquer origem de servidor"}
                    </p>
                  </div>
                  {podeCriar && !revogada ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={salvando}>
                          Revogar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar a chave {c.nome}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O site deixa de conseguir enviar documentos na hora. Não dá para
                            desfazer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRevogar(c)}>
                            Revogar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
      <NovaChaveFormulario
        aberto={criando}
        agentes={agentes}
        salvando={salvando}
        onFechar={() => setCriando(false)}
        onCriar={(dados) => {
          onCriar(dados);
          setCriando(false);
        }}
      />
      <SegredoUmaVez
        titulo="Nova chave de formulário"
        descricao="Envie no cabeçalho X-Form-Key. O painel não consegue mostrá-la de novo."
        valor={chaveNova}
        onFechar={onFecharChave}
      />
    </>
  );
}

function NovaChaveFormulario({
  aberto,
  agentes,
  salvando,
  onFechar,
  onCriar,
}: {
  aberto: boolean;
  agentes: { id: string; nome: string }[];
  salvando: boolean;
  onFechar: () => void;
  onCriar: (dados: {
    nome: string;
    agente_id: string;
    limite_por_minuto: number;
    origens: string[];
  }) => void;
}) {
  const [nome, setNome] = useState("");
  const [agente, setAgente] = useState("");
  const [limite, setLimite] = useState("10");
  const [sites, setSites] = useState("");
  const [erro, setErro] = useState("");
  const lidas = origensDoTexto(sites);
  const limiteNum = Number(limite);
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova chave de formulário</DialogTitle>
          <DialogDescription>
            A chave fica presa a um agente. O site só envia documento se a origem estiver na lista.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nome.trim()) return setErro("Dê um nome para a chave.");
            if (!agente) return setErro("Escolha o agente.");
            if (!Number.isInteger(limiteNum) || limiteNum < 1 || limiteNum > 600) {
              return setErro("O limite por minuto vai de 1 a 600.");
            }
            if (lidas.invalidas.length) {
              return setErro(
                `Endereço inválido: ${lidas.invalidas[0]}. Use https://site.com.br, sem caminho.`,
              );
            }
            setErro("");
            onCriar({
              nome: nome.trim(),
              agente_id: agente,
              limite_por_minuto: limiteNum,
              origens: lidas.origens,
            });
          }}
        >
          <div className="space-y-1.5">
            <RotuloCampo
              htmlFor="cf-nome"
              campo={{ rotulo: "Nome", ajuda: "Para achar a chave nesta lista." }}
            />
            <Input id="cf-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <RotuloCampo
              htmlFor="cf-agente"
              campo={{ rotulo: "Agente", ajuda: "Os documentos desta chave entram neste agente." }}
            />
            <Select value={agente} onValueChange={setAgente}>
              <SelectTrigger id="cf-agente">
                <SelectValue placeholder="Escolha o agente" />
              </SelectTrigger>
              <SelectContent>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <RotuloCampo
              htmlFor="cf-limite"
              campo={{
                rotulo: "Limite por minuto",
                ajuda: "Quantos envios esta chave aceita por minuto. Padrão: 10.",
              }}
            />
            <Input
              id="cf-limite"
              type="number"
              min={1}
              max={600}
              className="max-w-[8rem]"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <RotuloCampo
              htmlFor="cf-sites"
              campo={{
                rotulo: "Sites permitidos",
                ajuda:
                  "Um endereço por linha, como https://loja.exemplo.com.br. Vazio: só servidor, sem navegador.",
              }}
            />
            <Textarea
              id="cf-sites"
              rows={3}
              value={sites}
              placeholder={"https://loja.exemplo.com.br"}
              onChange={(e) => setSites(e.target.value)}
            />
          </div>
          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              Criar chave
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
