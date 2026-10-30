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
docker compose up -d
```

Uma imagem nova do painel só sai com a árvore commitada. `docker/publicar-painel.sh` recusa alteração não commitada, grava o commit na imagem e marca a tag `painel:<commit>`.

```sh
sh docker/publicar-painel.sh
docker compose up -d --no-deps --no-build painel
```

O primeiro acesso `admin@luxtia.local` só é criado se a conta ainda não existe, e a senha vem de `BOOTSTRAP_SUPER_ADMIN_SENHA` no `.env`. Com a conta já criada, a variável fica vazia e o bootstrap não roda. O proxy escuta nas portas 80 e 443. O arquivo `.env` fica só na máquina e não entra no Git.

## Unidades e histórico

Em Unidades e horários, cada unidade oferece Agenda, Horários e Exceções no primeiro clique. O topo mostra a situação do dia, as pausas e as exceções dos próximos sete dias. Dá para pausar por 30 minutos, 1 hora ou até o fim do turno, copiar a grade de outra unidade para o rascunho e, para o administrador, aplicar pausa ou exceção em várias unidades — inclusive feriados nacionais, só depois de confirmar. O histórico filtra pelo nome da unidade e pelo período no fuso da empresa.

Cada unidade tem Cidade e UF (lista das 27 UFs), usadas pelo gateway para os feriados estaduais e municipais no atendimento. A lista mostra "Cidade/UF" abaixo do endereço; unidade ativa sem cidade recebe o aviso "Sem cidade: só feriados nacionais serão considerados".

## Cardápio

Lista os itens do catálogo do gateway por unidade e por categoria, na ordem definida no painel. A barra de comando fica fixa no topo: busca, filtros (os extras abrem sob demanda), indicadores compactos clicáveis e atalho para novo item/categoria. No desktop, a coluna lateral de categorias destaca a seção visível e leva direto ao bloco; no celular, a mesma navegação vira faixa horizontal. Cada categoria recolhe e expande. Na linha do item: selo único de situação, preço editável, interruptor Ativo, Esgotar/Repor e lápis para abrir a ficha — arrastar e setas aparecem ao passar o mouse. A situação de agora vem do gateway (`disponivel_agora` e o motivo em palavras).

Admin e plataforma (CAT3-a, contrato `gateway/docs/ESPEC_CAT3.md` seção 13):
- Criar, renomear e arquivar categoria. Ao arquivar uma categoria com itens, a tela pergunta se arquiva os itens ou move para outra categoria.
- Na linha: Ativo, Esgotar/Repor (até o fim do dia), preço editável, editar e o menu Duplicar, Mover, Copiar para outra unidade e Arquivar.
- "Novo item" e o painel lateral editam nome, descrição, categoria, preço, código, tipo, alcoólico, delivery, disponibilidade e observação interna. Ao salvar uma edição, pergunta se vale só nesta unidade ou em todas as unidades com este prato.
- Seleção em lote, com prévia antes de aplicar e resultado por item. Tela "Pratos iguais" para ligar, ignorar ou restaurar sugestões, com aviso quando os preços diferem.

Layout de gestão republicado em 30/10/2026 como `painel:bc6c695dbb029ffcc17c5acf75466bf8d20bb251`. A volta imediata é `painel:volta-20261030T165734Z`. O atendente consulta o cardápio e pode esgotar ou repor. Criar, preço, arquivar, lote e ligações ficam com admin e plataforma. O `PATCH` continua só com o que mudou e o `atualizado_em` lido. Preço vazio avisa que o item sai do atendimento. Conflito 409 oferece recarregar ou reaplicar. A disponibilidade tem prévia ao vivo e o histórico do item (quem, quando em Brasília, antes e depois) segue só para admin e plataforma. Prints com dados fictícios: `docs/prints-cat3-enc1/` (`tests/visual/cat3/capturar.cjs`).

## Pedidos

O menu Pedidos, para administrador, plataforma e atendente, abre com indicadores clicáveis (aguardando loja, confirmados, em preparo, prontos e avisos com falha), uma barra com busca, Quadro/Lista, filtros recolhíveis e som, e o quadro por status com rolagem por coluna. O detalhe abre num painel lateral com as ações fixas no rodapé. O cartão traz número, unidade, cliente, canal, entrega ou retirada, total, quantidade de itens e o tempo desde a entrada. O detalhe mostra itens, entrega, cliente, linha do tempo e o atalho da conversa. As ações saem só de `proximos_status`. No conflito 409 a tela recarrega o pedido e avisa que ele já foi atualizado. Filtro de origem (Reais, Piloto, Simulados, Teste; a tela abre com todas) e etiqueta discreta quando a origem não é real ou o canal não é WhatsApp. O contador do menu conta os pedidos aguardando a loja, de qualquer origem, a cada 15 segundos com a aba visível; o som de pedido novo é opcional e fica desligado até a pessoa ligar. Textos de aviso e reenvio vieram no PED1-b; o nome por prioridade, igual ao da conversa, no PED1-c.

## Conversas

A lista e a conversa aberta dividem a altura da tela. Cada contato aparece com iniciais, horário curto e o estado. Ao abrir, o histórico já fica nas mensagens mais recentes; se a pessoa subir para ler o passado, a posição é mantida e um atalho “Mensagens recentes” volta ao fim. No celular, a conversa ocupa a tela e há um voltar para a lista. Enter envia a mensagem e Shift+Enter quebra a linha. A lista e o detalhe mostram o atendimento atual (número, aberto, com humano ou encerrado, aberto em, encerrado em e motivo), o bloco de follow-up (agendado, cancelado ou ensaio, com horário de Brasília, tipo da pendência, motivo e “Cancelar este” na linha do agendado) e o selo “não quer follow-up” no contato, com Reativar só para admin e plataforma — a confirmação pede um motivo de pelo menos 3 caracteres, enviado no corpo do DELETE; depois, o contato mostra quem reativou e o motivo —, além do estado da conversa (encerrada, aguardando atendente, atendente ou bot), do canal com o nome cadastrado e do telefone legível. O histórico lista os atendimentos anteriores, com resumo, e as mensagens podem ser filtradas por atendimento. Admin e membro encerram o atendimento aberto ou reabrem só o último; se o gateway recusar (409), a tela explica e pede para atualizar. Nenhuma dessas ações envia mensagem ao cliente. Desde o PED1-c, o nome é o de exibição do gateway (cadastro > informado > perfil > telefone) com um selo discreto da origem; conversas de teste levam o selo "teste"; a última mensagem mostra autor e tipo; aparecem a unidade preferida e o pedido aberto, com atalho para o pedido. Filtros por estado (inclusive Encerrada) e ordem por atividade recente; a busca cobre os três nomes e o telefone. Qualquer papel usa "Editar nome" no cabeçalho para gravar o nome de cadastro (vazio apaga e volta ao próximo da prioridade); o gateway audita quem alterou. Os Pedidos mostram o mesmo nome da conversa. A tela pede o último evento confirmado (`GET /admin/v1/tenants/{tenant}/eventos/cursor`) antes de carregar a lista e usa esse `ultimo_id` como `desde` do polling.

## Comportamento do agente

Configurações → Comportamento do agente edita o atendimento da empresa ou de um agente. O formulário é montado pelo `esquema` que o gateway devolve (tipos, limites, opções, padrão, `editavel`, `disponivel`), então um campo novo aparece sem mudar o painel. Cada campo mostra o valor em uso, a origem (plataforma, segmento, empresa ou agente), o selo "Personalizado" e a ação "Voltar ao padrão". As alterações viram rascunho e são publicadas com uma nota opcional. Quando o gateway pede confirmação, a tela mostra o trecho de cada aviso antes de reenviar. Abas: Personalidade, Comportamentos, Publicar, Prévia (rascunho ou publicado, como vai ao agente) e Histórico (antes/depois e Restaurar). Itens indisponíveis aparecem com o selo "em breve". "Pediu humano" e "Reclamação" ficam travados. O texto do aviso de demora, a espera por áudio e imagem e “Aceita pedido agendado” não aparecem. Espera, espera máxima, pausa do bot, aviso de demora em segundos e mensagem de falha só se editam aqui, em rascunho; a ficha do agente não grava mais esses campos na hora. Envio, piloto, contatos do piloto, telefone de alerta, limites, URL e credencial do Skyone, provedor e instruções só aparecem para a plataforma, e lá continuam com efeito imediato. Se o gateway recusar o telefone do piloto, do alerta ou do alerta da equipe, a frase que ele devolve (por exemplo “Use DDD + número, ex.: 11912345678”) aparece embaixo do campo. Admin e plataforma editam o rascunho; o atendente só vê. Se há rascunho não publicado, uma faixa avisa desde quando, com “Ver diferenças” (a prévia publicada, o que o agente recebe hoje) e “Publicar”. Botões e reações ficam desabilitados, com “Disponível só em canal WhatsApp”, no agente sem canal uazapi. O grupo Follow-up (ligar, 1º e 2º em minutos, máximo por dia e janela de horário em 24h) aparece quando o esquema do gateway traz esses campos. Com um agente escolhido, o nome dele fica no topo. Enquanto o follow-up está em ensaio, a ajuda do 2º avisa que só o 1º é registrado. Especificação em `docs/ESPEC_TELAS_CFG1.md`.

## Simular conversa

Admin e plataforma conversam com o agente por um canal API, sem enviar nada ao cliente. Quando o agente tem a capacidade de documentos ligada (`documentos.ativo`), um clipe ao lado da mensagem aceita PDF, XML, JPG, PNG e WEBP de até 10 MB, com texto opcional. Canal, modo de envio, papel e provedor não escondem esse clipe. O arquivo aparece na conversa como cartão (nome, tipo e estado) com link para o detalhe em Documentos. Enquanto está processando, o cartão consulta o anexo a cada 2 s, por até 30 s, e muda sozinho; depois disso avisa “Ainda lendo, atualize em instantes”. Arquivo grande demais, formato fora da lista ou capacidade desligada ganham um aviso curto. XML que não é NF-e/NFC-e avisa para enviar o XML da nota ou o PDF. O corpo dessa chamada aceita até 15 MB no servidor e no proxy.

## Documentos

`/ia/documentos` lista os arquivos recebidos. Estado, tipo e período (de/até, dia de Brasília, dd/mm/aaaa) vão ao gateway em `GET /anexos`. O detalhe mostra os campos com rótulo, valor em R$ e data em dd/mm/aaaa, Copiar na linha digitável, no código de barras, na chave de acesso e no ID da transação, os itens da NF-e em tabela e “Apagado automaticamente em” quando há validade. Comprovante PIX traz o aviso de que o pagamento não foi verificado. Admin e plataforma apagam, com o botão em estilo de perigo; o membro só consulta. `/ia/chaves-formulario` cria a chave presa a um agente, com sites permitidos e limite por minuto. O valor aparece uma vez, com Copiar. Revogar pede confirmação e fica com admin e plataforma.

Na chave de API da empresa, nenhum escopo vem marcado. “Resposta assíncrona (em breve)” aparece desabilitada. “Enviar documentos” pode ser marcado na criação e vale em servidor ou n8n.

## Webhooks de saída

`/ia/webhooks-saida`, para admin e plataforma, cria a URL e os eventos. Entram documento pronto, documento falhou, documento apagado, resposta do agente, follow-up agendado, follow-up cancelado e follow-up em ensaio, além dos eventos de pedido que já existiam. O webhook novo nasce ativo. O segredo HMAC aparece uma vez, no mesmo aviso da chave de formulário. “Gerar novo segredo” aparece para admin e plataforma, com confirmação de que o segredo antigo vale mais 24 horas. O novo aparece uma vez. Enquanto o anterior ainda assina, a lista mostra até quando. A tela testa o envio e mostra as últimas entregas.

O proxy aceita até 11 MiB só em `/gateway/api/v1/documentos` e subcaminhos. O restante de `/gateway/api/*` continua em 2 MiB.

Prints com dados fictícios: `docs/prints-arq-fup/` (`tests/visual/arq-fup/capturar.cjs`). Publicado em 22/10/2026 como `painel:arq-fup-20261022`. A volta é `painel:pedidos-20261020`.

## Usuários e papéis

USUARIOS1 está no ar (`docs/ESPEC_USUARIOS1.md`). Sem SMTP, quem convida vê o link uma vez, por 24 horas, de uso único e revogável. Com `GATEWAY_PLATFORM_KEY` vazia, a plataforma usa a chave da empresa e o log avisa uma vez por dia. `admin@luxtia.local` é conta de emergência: segunda etapa obrigatória no primeiro login desta versão, sem os 7 dias, e cada entrada dela gera alerta na auditoria. O servidor manda `X-Role` (`plataforma`, `gestor`, `supervisor`, `funcionario`) e `X-Unidades`. Prints em `docs/prints-usuarios/`.

## Entrada (login)

ENTRADA1 (`docs/ESPEC_ENTRADA1.md`): login com mostrar/ocultar senha, Caps Lock, “Esqueci a senha”, bloqueio após 5 falhas em 15 minutos, MFA com 6 caixas e código de recuperação, senha mínima 12 no convite/redefinição, e “Link de nova senha” em Usuários. Sem SMTP o pedido de redefinição orienta a falar com o gestor. Prints em `docs/prints-entrada/`. MFA1 continua com `MFA1_OBRIGATORIO=0`.
