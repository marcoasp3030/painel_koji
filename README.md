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

Cada unidade tem Cidade e UF (lista das 27 UFs), usadas pelo gateway para os feriados estaduais e municipais no atendimento. A lista mostra "Cidade/UF" abaixo do endereço; unidade ativa sem cidade recebe o aviso "Sem cidade: só feriados nacionais serão considerados".

## Cardápio

Lista os itens do catálogo do gateway por unidade (abas) e por categoria, na ordem definida no painel. Cada bloco de categoria e cada item dentro dele podem ser reordenados arrastando (ou pelas setas). Há busca, filtros (arquivados, esgotados, categoria e prato) e indicadores. Cada item mostra a situação de agora calculada pelo gateway (`disponivel_agora` e o motivo em palavras: inativo, sem preço, sem delivery, fora do dia, feriado, fora do horário, esgotado) e o resumo da regra de disponibilidade. Os indicadores e os filtros "Disponíveis agora"/"Indisponíveis agora" usam esse valor.

Admin e plataforma (CAT3-a, contrato `gateway/docs/ESPEC_CAT3.md` seção 13):
- Criar, renomear e arquivar categoria. Ao arquivar uma categoria com itens, a tela pergunta se arquiva os itens ou move para outra categoria.
- Na linha: Disponível, "Esgotado hoje" (até o fim do dia, com "Repor" num toque), preço editável e o menu Duplicar, Mover, Copiar para outra unidade e Arquivar.
- "Novo item" e o painel lateral editam nome, descrição, categoria, preço, código, tipo, alcoólico, delivery, disponibilidade e observação interna. Ao salvar uma edição, pergunta se vale só nesta unidade ou em todas as unidades com este prato.
- Seleção em lote, com prévia antes de aplicar e resultado por item. Tela "Pratos iguais nas unidades" para ligar, ignorar ou restaurar sugestões, com aviso quando os preços diferem.

Publicado em 20/10/2026 como `painel:cat3a-20261020`. A volta é `painel:volta-cat3-c1c1c96e2719`. O atendente consulta o cardápio e pode esgotar ou repor. Criar, preço, arquivar, lote e ligações ficam com admin e plataforma. O `PATCH` continua só com o que mudou e o `atualizado_em` lido. Preço vazio avisa que o item sai do atendimento. Conflito 409 oferece recarregar ou reaplicar. A disponibilidade tem prévia ao vivo e o histórico do item (quem, quando em Brasília, antes e depois) segue só para admin e plataforma. Prints com dados fictícios: `docs/prints-cat3-enc1/` (`tests/visual/cat3/capturar.cjs`).

## Pedidos

O menu Pedidos, para administrador, plataforma e atendente, abre com indicadores clicáveis (aguardando loja, confirmados, em preparo, prontos e avisos com falha), uma barra com busca, Quadro/Lista, filtros recolhíveis e som, e o quadro por status com rolagem por coluna. O detalhe abre num painel lateral com as ações fixas no rodapé. O cartão traz número, unidade, cliente, canal, entrega ou retirada, total, quantidade de itens e o tempo desde a entrada. O detalhe mostra itens, entrega, cliente, linha do tempo e o atalho da conversa. As ações saem só de `proximos_status`. No conflito 409 a tela recarrega o pedido e avisa que ele já foi atualizado. Filtro de origem (Reais, Piloto, Simulados, Teste; a tela abre com todas) e etiqueta discreta quando a origem não é real ou o canal não é WhatsApp. O contador do menu conta os pedidos aguardando a loja, de qualquer origem, a cada 15 segundos com a aba visível; o som de pedido novo é opcional e fica desligado até a pessoa ligar. Textos de aviso e reenvio vieram no PED1-b; o nome por prioridade, igual ao da conversa, no PED1-c.

## Conversas

A lista e o detalhe mostram o atendimento atual (número, aberto, com humano ou encerrado, aberto em, encerrado em e motivo), o bloco de follow-up (agendado, cancelado ou ensaio, com horário de Brasília, tipo da pendência, motivo e “Cancelar este” na linha do agendado) e o selo “não quer follow-up” no contato, com Reativar só para admin e plataforma — a confirmação pede um motivo —, além do estado da conversa (encerrada, aguardando atendente, atendente ou bot), do canal com o nome cadastrado e do telefone legível. O histórico lista os atendimentos anteriores, com resumo, e as mensagens podem ser filtradas por atendimento. Admin e membro encerram o atendimento aberto ou reabrem só o último; se o gateway recusar (409), a tela explica e pede para atualizar. Nenhuma dessas ações envia mensagem ao cliente. Desde o PED1-c, o nome é o de exibição do gateway (cadastro > informado > perfil > telefone) com um selo discreto da origem; conversas de teste levam o selo "teste"; a última mensagem mostra autor e tipo; aparecem a unidade preferida e o pedido aberto, com atalho para o pedido. Filtros por estado (inclusive Encerrada) e ordem por atividade recente; a busca cobre os três nomes e o telefone. Qualquer papel usa "Editar nome" no cabeçalho para gravar o nome de cadastro (vazio apaga e volta ao próximo da prioridade); o gateway audita quem alterou. Os Pedidos mostram o mesmo nome da conversa. A tela pede o último evento confirmado (`GET /admin/v1/tenants/{tenant}/eventos/cursor`) antes de carregar a lista e usa esse `ultimo_id` como `desde` do polling.

## Comportamento do agente

Configurações → Comportamento do agente edita o atendimento da empresa ou de um agente. O formulário é montado pelo `esquema` que o gateway devolve (tipos, limites, opções, padrão, `editavel`, `disponivel`), então um campo novo aparece sem mudar o painel. Cada campo mostra o valor em uso, a origem (plataforma, segmento, empresa ou agente), o selo "Personalizado" e a ação "Voltar ao padrão". As alterações viram rascunho e são publicadas com uma nota opcional. Quando o gateway pede confirmação, a tela mostra o trecho de cada aviso antes de reenviar. Abas: Personalidade, Comportamentos, Publicar, Prévia (rascunho ou publicado, como vai ao agente) e Histórico (antes/depois e Restaurar). Itens indisponíveis aparecem com o selo "em breve". "Pediu humano" e "Reclamação" ficam travados. Os campos de operação são só leitura. Admin e plataforma editam; o atendente só vê. O grupo Follow-up (ligar, 1º e 2º em minutos, máximo por dia e janela de horário em 24h) aparece quando o esquema do gateway traz esses campos. Com um agente escolhido, o nome dele fica no topo. Enquanto o follow-up está em ensaio, a ajuda do 2º avisa que só o 1º é registrado. Especificação em `docs/ESPEC_TELAS_CFG1.md`.

## Documentos

`/ia/documentos` lista os arquivos recebidos. O estado vai ao gateway. Tipo e data filtram só a página já carregada (a rota de anexos não aceita esses filtros) e os campos de data são dd/mm/aaaa. O detalhe mostra os campos com rótulo, valor em R$ e data em dd/mm/aaaa, Copiar na linha digitável, no código de barras, na chave de acesso e no ID da transação, os itens da NF-e em tabela e “Apagado automaticamente em” quando há validade. Comprovante PIX traz o aviso de que o pagamento não foi verificado. Admin e plataforma apagam, com o botão em estilo de perigo; o membro só consulta. `/ia/chaves-formulario` cria a chave presa a um agente, com sites permitidos e limite por minuto. O valor aparece uma vez, com Copiar. Revogar pede confirmação e fica com admin e plataforma.

Na chave de API da empresa, nenhum escopo vem marcado. “Resposta assíncrona (em breve)” aparece desabilitada. “Enviar documentos” pode ser marcado na criação e vale em servidor ou n8n.

## Webhooks de saída

`/ia/webhooks-saida`, para admin e plataforma, cria a URL e os eventos. Entram documento pronto, documento falhou, documento apagado, resposta do agente, follow-up agendado, follow-up cancelado e follow-up em ensaio, além dos eventos de pedido que já existiam. O webhook novo nasce ativo. O segredo HMAC aparece uma vez, no mesmo aviso da chave de formulário. “Gerar novo segredo” pede confirmação e chama a rota de rotação; se o gateway ainda não a tiver, a tela avisa. A tela testa o envio e mostra as últimas entregas.

O proxy aceita até 11 MiB só em `/gateway/api/v1/documentos` e subcaminhos. O restante de `/gateway/api/*` continua em 2 MiB.

Prints com dados fictícios: `docs/prints-arq-fup/` (`tests/visual/arq-fup/capturar.cjs`). As telas ainda não foram publicadas.
