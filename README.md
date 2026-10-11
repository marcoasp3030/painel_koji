# Painel Luxtia

Repositório: https://github.com/marcoasp3030/painel_koji

Plataforma de integrações de delivery e mensagens (iFood, 99Food, WhatsApp Oficial e Uazapi).

## Desenvolvimento

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Produção (Docker + PostgreSQL)

O painel sobe com Postgres, autenticação e API REST na mesma origem `painel.luxbrain.com.br`.

```sh
python3 docker/gerar-segredos.py
docker compose up -d --build
```

O proxy escuta nas portas 80 e 443. O arquivo `.env` fica só na máquina e não entra no Git.

## Unidades e histórico

Em Unidades e horários, cada unidade oferece Agenda, Horários e Exceções no primeiro clique. O topo mostra a situação do dia, as pausas e as exceções dos próximos sete dias. Dá para pausar por 30 minutos, 1 hora ou até o fim do turno, copiar a grade de outra unidade para o rascunho e, para o administrador, aplicar pausa ou exceção em várias unidades — inclusive feriados nacionais, só depois de confirmar. O histórico filtra pelo nome da unidade e pelo período no fuso da empresa.

## Pedidos

O menu Pedidos, para administrador, plataforma e atendente, abre com indicadores clicáveis (aguardando loja, confirmados, em preparo, prontos e avisos com falha), uma barra com busca, Quadro/Lista, filtros recolhíveis e som, e o quadro por status com rolagem por coluna. O detalhe abre num painel lateral com as ações fixas no rodapé. O cartão traz número, unidade, cliente, canal, entrega ou retirada, total, quantidade de itens e o tempo desde a entrada. O detalhe mostra itens, entrega, cliente, linha do tempo e o atalho da conversa. As ações saem só de `proximos_status`. No conflito 409 a tela recarrega o pedido e avisa que ele já foi atualizado. O contador do menu usa a contagem, atualizada a cada 15 segundos com a aba visível; o som de pedido novo é opcional e fica desligado até a pessoa ligar. Textos de aviso, reenvio e o nome por prioridade ficam para o PED1-b e o PED1-c.

## Conversas

A lista e o cabeçalho mostram o estado (encerrada, aguardando atendente, atendente ou bot), o canal com o nome cadastrado e o telefone legível. O nome continua o que o gateway manda hoje. A tela pede o último evento confirmado (`GET /admin/v1/tenants/{tenant}/eventos/cursor`) antes de carregar a lista e usa esse `ultimo_id` como `desde` do polling.
