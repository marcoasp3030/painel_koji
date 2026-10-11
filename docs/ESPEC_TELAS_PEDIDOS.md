# Telas — Pedidos e correção de Conversas

**Situação:** PED1-a (seção 12) publicado no gateway e implementado na tela Pedidos. Textos de aviso, reenvio, `X-Role`, nome por prioridade e filtro de encerradas continuam fora, à espera do PED1-b e do PED1-c. Pagamento e troco continuam no G4.
**Data:** 10/10/2026.
**Fonte do contrato novo:** `gateway/docs/ESPEC_PED1.md` (especificação para aprovação; o próprio documento diz que nada foi implementado no gateway).
**Contrato já publicado:** `gateway/docs/API_ADMIN.md` (conversas, canais e o recorte atual de pedidos).

O painel só fala com `/admin/v1` pelo servidor, com `X-Actor` da sessão. A chave do gateway não entra no navegador. Esta tela não chama `/api/v1` (carrinho, Skills, notificar).

O PED1 está dividido, no gateway, em PED1-a (status, linha do tempo, lista, detalhe, contagem), PED1-b (avisos e `X-Role`) e PED1-c (conversas e contatos). A tela segue essa divisão: Conversas tem uma parte que já dá para corrigir; Pedidos e Avisos esperam o contrato publicado.

## 1. O que o painel tem hoje

Não existe menu Pedidos nem tela de pedido. O menu (`src/lib/nav.ts`) tem Conversas para plataforma, admin e membro. Não existe página “Configurações”.

Conversas (`src/components/luxtia/Conversas.tsx` e `src/lib/gateway-conversas.functions.ts`) chama `GET /tenants/{t}/conversas` e repassa o JSON ao navegador sem montar nome, telefone ou canal. O tipo em `src/lib/gateway/conversas.ts` declara `nome`, `telefone`, `canal`, `status` (`ativa` | `pausada`), `ultima_mensagem` e `ultima_em`. Não declara `encerrada_em`, `desfecho`, `canal_id` nem `atualizado_em`, embora o gateway já os envie (PED1, seção 2.1).

## 2. Conversas — de onde a tela lê, e por que está errado

A lista e o cabeçalho usam só o objeto da lista. O histórico de mensagens (`GET .../conversas/{id}/mensagens`) é outra leitura: ele já mostra direção, origem e hora de cada balão. O defeito está na lista e no cabeçalho.

| O que a tela devia mostrar | De onde lê hoje | Por que sai errado |
|---|---|---|
| Nome do cliente | `conversa.nome`, senão `conversa.telefone`, senão “Contato” (`Conversas.tsx`, lista e título) | `nome` é o perfil do WhatsApp (`senderName`) gravado só na primeira mensagem. Em produção, 5 de 103 conversas do By Koji têm nome (PED1, 2.2). Não há nome informado nem nome de cadastro |
| WhatsApp | O mesmo `telefone`, cru, sem máscara | O gateway manda só dígitos (`5511947281513`). Em canal API ou site esse campo pode ser um identificador que não é telefone (PED1, 2.2) |
| Canal com ícone e nome | Não lê. O filtro “Canal” usa `GET /canais` (`id` e `nome`). O item da conversa traz `canal_id` e `canal` (o tipo: `uazapi`, `api`…) e a lista não junta os dois | O tipo sozinho apareceria como `uazapi`. O vocabulário atual chama todo canal `api` de “API (para testes)” (`src/lib/gateway/vocabulario.ts`); isso mistura canal de integração com conversa de simulação |
| Unidade preferida | Não há campo na lista | O dado existe na conversa e o gateway não o devolve (PED1, 2.2). Pendência PED1-c |
| Estado | `status === "pausada"` vira “Com atendente”; o resto vira “Com o agente”. “Aguardando atendente” é um selo à parte. `encerrada_em` é ignorado | Quatro campos já vêm na lista (`encerrada_em`, `aguardando_atendente_desde`, `bot_pausado_ate`, `status`) e a tela não aplica a ordem da seção 6.2 |
| Última mensagem com horário | `ultima_mensagem` e `ultima_em` | Texto e hora já vêm. Não vêm direção, origem nem tipo (áudio, imagem). Pendência PED1-c (`ultima`) |
| Filtro por estado | `status=ativa\|pausada` e `aguardando=true`, que o contrato atual publica | Não há filtro de encerrada. `estado=` é pendência PED1-c |
| Busca por nome ou telefone | `busca`, já enviada ao gateway (substring de nome/telefone) | Procura o `nome` incompleto de hoje. Passar a procurar nos três nomes é pendência PED1-c |

A ordem da lista no gateway é pelo identificador da conversa. O painel reordena só a página carregada (espera mais antiga primeiro, depois `ultima_em`). `ordem=recentes` é pendência PED1-c.

## 3. Conversas — o que corrigir com o contrato atual

Dá para fazer antes do PED1, só com `GET /conversas` e `GET /canais` já publicados. Quando o PED1-c existir, a tela troca para os campos prontos e deixa de calcular.

1. **Estado, nesta ordem, com os campos que já chegam:** `encerrada_em` preenchido → Encerrada; senão `aguardando_atendente_desde` → Aguardando atendente; senão pausa vigente (`status=pausada` ou `bot_pausado_ate` no futuro) → Atendente; senão → Bot. Um rótulo só. O selo de espera e o motivo (`aguardando_motivo`) continuam junto de “Aguardando atendente”.
2. **Canal:** ícone e rótulo pelo tipo que já vem em `canal`, cruzando `canal_id` com o nome de `GET /canais` (a lista de canais a tela já carrega). Rótulos: `uazapi` e `meta` → WhatsApp; `site` → Site; `api` → API; `email` → E-mail; `teams` → Teams; `luxbrain` → Luxbrain. O nome cadastrado do canal aparece ao lado (“WhatsApp · Loja”). Não usar o rótulo “API (para testes)” para todo canal `api`.
3. **Telefone:** se `telefone` tiver 10 a 15 dígitos, mostrar com `+` e, no caso `55` + DDD + 9 dígitos, no formato `+55 11 9xxxx-xxxx`. Se não for só dígitos nessa faixa, mostrar o identificador como veio, sem máscara de telefone.
4. **Nome, até o PED1-c:** mostrar `nome` quando vier; senão o telefone formatado; senão “Contato”. Não inventar prioridade no navegador.
5. **Cabeçalho da conversa:** nome, telefone formatado, canal e o estado. A última linha da lista continua com o texto e a hora que já vêm.
6. **Filtros que já existem:** canal (id) e busca. O filtro de estado da tela, nesta etapa, usa `status` e `aguardando` publicados. Encerrada não vira filtro de servidor enquanto `estado=` não existir; a tela não esconde encerrada só dentro da página e chama isso de filtro.

### O que espera o PED1-c (seção 6)

| Pedido da tela | Campo | Enquanto não existir |
|---|---|---|
| Nome pela prioridade informado > cadastro > perfil > telefone | `nome_exibicao` e `nome_origem` | Mostrar `nome` como acima |
| WhatsApp já formatado | `telefone_formatado` / `telefone_e164` | Formatação local do `telefone` |
| Canal “Teste” | `canal_info.teste` (não existe tipo `test`) | Sem selo Teste. Simulação hoje entra por canal `api` |
| Unidade preferida | `unidade_preferida_nome` | Omitir a linha |
| Última mensagem: de quem e o tipo | `ultima.direcao`, `ultima.origem`, `ultima.tipo` | Texto e hora atuais |
| Filtro `estado=` e busca nos três nomes | parâmetros novos | Filtros atuais |
| Ordem pela última atividade | `ordem=recentes` | Ordem atual do gateway, com a reordenação da página |
| Atalho “pedidos deste cliente” | `GET /pedidos?busca=` (PED1-a, seção 5.1) | Sem o atalho. Não há filtro por `conversation_id` |

Quando `nome_exibicao` e `telefone_formatado` vierem, a tela exibe esses valores e para de montar nome e máscara. Contato anonimizado: o gateway manda `nome_exibicao` = “Contato anonimizado” e telefones nulos; a tela mostra isso e não reconstitui o número.

O atalho de pedidos, depois do PED1-a, busca pelos dígitos do telefone (2 a 100 caracteres). Sem telefone, busca pelo nome se tiver pelo menos 2 caracteres e avisa que pode haver homônimos. Sem os dois, o atalho não aparece.

Abrir a conversa a partir de um pedido usa o `conversation_id` do pedido e o `GET .../mensagens` que já existe. Não há `GET` de uma conversa solta; o cabeçalho usa o cliente que veio no pedido até a lista trazer o item.

## 4. Pedidos — menu e visões

Rota nova do painel: `/ia/pedidos`. Menu “Pedidos”, grupo Agentes, papéis plataforma, admin e membro. Contador no item: `aguardando_loja.total` de `GET /tenants/{t}/pedidos/contagem` (PED1, 5.4).

**Pendência:** a rota de contagem, os status `em_preparo`, `pronto_retirada`, `saiu_entrega` e `concluido`, a busca, o período, a modalidade e `proximos_status` não existem no gateway. A tela de Pedidos não entra em produção só com o contrato atual. O que esse contrato já publicou fica na seção 8, para não ser refeito de outro jeito.

### 4.1 Quadro e lista

Quadro, no computador, com cinco colunas. O status continua o do gateway; a coluna só agrupa:

| Coluna | Status |
|---|---|
| Aguardando loja | `aguardando_loja` |
| Confirmado | `confirmado` |
| Em preparo | `em_preparo` |
| Pronto/Saiu | `pronto_retirada` e `saiu_entrega` (o cartão diz qual) |
| Concluído | `concluido` |

`recusado` e `cancelado` não têm coluna. Aparecem na lista, pelo filtro de status.

Lista: filtros `status` (um ou vários, como a vírgula do contrato), `unidade` (o **código** da unidade, PED1 5.1), período e busca. Período: `desde` inclusivo e `ate` exclusivo, data/hora com fuso, sobre `criado_em`, no fuso da empresa (o mesmo já usado no histórico). Busca: número, nome ou telefone, 2 a 100 caracteres; no telefone o gateway compara só dígitos. Abaixo de 2 caracteres a tela não envia `busca`.

Paginação pelo `cursor` / `proximo_cursor`, mais recentes primeiro, `limite` 50. “Carregar mais” conserva os filtros. A tela não anuncia total de registros: a contagem leve é outra rota e não substitui a lista.

### 4.2 Cartão

Número, nome da unidade (`unidade_nome`), cliente (`cliente.nome` e `cliente.telefone`), entrega ou retirada (`modalidade`), total (texto do gateway, sem recalcular), tempo desde `criado_em` (“há N min”, atualizado junto da consulta de 15 s).

**Pendência de campo:** o cartão pedido inclui horário. O item da lista (PED1, 5.1) não traz `horario`; ele está em `entrega.horario` no detalhe (5.2). Até o contrato incluir o horário na lista, o cartão não inventa esse valor e o detalhe mostra o que vier.

### 4.3 Detalhe

`GET /tenants/{t}/pedidos/{numero}`:

- Itens copiados (`codigo`, `nome`, `quantidade`, `preco_unitario`, `subtotal`, `observacao`, `alcoolico`). Preço e total são os do pedido, não os do catálogo agora.
- Observação do pedido (`entrega.observacao`) e observação de cada item.
- Endereço (`entrega.endereco`) e horário (`entrega.horario`) quando vierem. Retirada com endereço nulo: “Retirada”, sem endereço em branco disfarçado de entrega.
- Linha do tempo (`linha_do_tempo`): de → para, quem (`por`), quando (`em`, com o offset recebido), motivo, previsão e o aviso (`enviado`, `simulado`, `pendente`, `falhou`, `descartado`, `desligado` ou nulo). Falha mostra o erro recebido, sem texto técnico extra.
- Atalho para a conversa (`conversation_id`), como na seção 3.

**Pagamento e troco:** o PED1 não define esses campos. Continuam pendência G4 (`docs/ESPEC_TELAS_GESTAO.md`, tela 8: bairro, CEP, pagamento, troco, agendamento e frete grátis). A seção só aparece quando o contrato G4 publicar os nomes. Não usar carrinho nem Skill para completar.

Pedidos antigos: a linha do tempo é a que o gateway reconstruir. A tela não fabrica eventos.

### 4.4 Ações

Os botões são exatamente `proximos_status` do detalhe. A tela não calcula a máquina.

| Status no botão | Rótulo | Corpo |
|---|---|---|
| `confirmado` | Confirmar | `POST .../pedidos/{numero}/status` com `{"status":"confirmado"}` e, se preenchido, `previsao_min` (inteiro 1–600) |
| `em_preparo` | Em preparo | `{"status":"em_preparo"}`. `previsao_min` só se o pedido ainda está `aguardando_loja` (PED1, seção 3: a previsão também vale nesse pulo) |
| `pronto_retirada` | Pronto para retirada | `{"status":"pronto_retirada"}` |
| `saiu_entrega` | Saiu para entrega | `{"status":"saiu_entrega"}` |
| `concluido` | Concluir | `{"status":"concluido"}` |
| `recusado` | Recusar | ver alinhamento abaixo |
| `cancelado` | Cancelar | `motivo` obrigatório, 3 a 300 caracteres |

`POST .../confirmar` e `POST .../recusar` continuam no contrato como atalhos. A tela usa `POST .../status`, que devolve o detalhe já com a linha nova.

**Alinhamento para aprovar:** o pedido desta tela é motivo obrigatório em Recusar e em Cancelar. O PED1 deixa o motivo da recusa opcional (como hoje) e exige motivo só no cancelamento do painel (3–300). A implementação segue o contrato publicado. Se a recusa também for obrigatória, o PED1 precisa dizer isso antes; a tela não inventa a validação no gateway.

409 (`CONFLICT`, com `detalhes.status`): recarregar o detalhe e avisar “Este pedido já foi atualizado”, mostrando o status que voltou. Não reenviar a transição. 404: pedido inexistente nesta empresa. 400: mensagem no campo (`motivo` ou `previsao_min`).

### 4.5 Alerta de pedido novo

A cada 15 s, com a aba visível (`refetchIntervalInBackground: false`): `GET .../pedidos/contagem`. O menu mostra `aguardando_loja.total`. Pedido novo destaca a coluna e, se o total subiu desde a última leitura desta aba, pode tocar um som.

O som é preferência do usuário no navegador (ligada/desligada), padrão desligado. Não é campo do gateway. Não toca na primeira carga. Não há papel só de leitura no painel; quem vê o menu ouve, se ligou o som.

`em_andamento` e `avisos_com_falha` da mesma resposta servem de resumo no topo. Unidade sem pedido novo não aparece em `por_unidade`; a tela não completa com zeros.

### 4.6 Celular

Abaixo da largura de quadro, as colunas viram uma lista por status (seletor com os mesmos cinco grupos, mais Recusados e Cancelados). Ações com alvo de pelo menos 44 px. Filtros e detalhe continuam os mesmos.

## 5. Avisos de pedido

Rota do painel: `/ia/pedidos/avisos`. Menu “Avisos de pedido”, só plataforma e admin. Não existe página Configurações; o item fica no mesmo grupo, ao lado de Pedidos.

Contrato (PED1, 5.5), quando publicado:

- `GET /tenants/{t}/pedidos/avisos` — variáveis e um item por status (`ativo`, `texto`, `padrao`, `texto_padrao`, `ativo_padrao`).
- `PUT /tenants/{t}/pedidos/avisos/{status}` — `ativo` e/ou `texto`. `texto: null` volta ao padrão.
- `POST .../avisos/{status}/previa` com o rascunho — devolve o texto de exemplo. Não envia nada ao cliente.

A prévia e o liga/desliga são por status. Variável desconhecida ou texto fora de 1–1000: erro no campo, rascunho preservado. A ajuda explica `{numero}`, `{unidade}`, `{previsao}`, `{motivo}`, `{nome_cliente}` e o trecho `[[ ... ]]` (some inteiro se alguma variável de dentro vier vazia). A lista de variáveis é a do GET, não uma lista fixa da tela.

Esta rota não é o `GET /tenants/{t}/avisos` de hoje. Esse lista a caixa de envio (`pedido_unidade`, `pedido_cliente`, …) e não os textos editáveis.

**Reenvio:** `POST .../pedidos/{numero}/avisos/{status}/reenviar` (PED1, 5.6) aparece no detalhe quando `pode_reenviar` é verdadeiro. É ação de operação, para os mesmos papéis que mudam status, não configuração de texto. 409: o aviso não está `falhou` ou o pedido já saiu daquele status; a tela recarrega.

**Alinhamento:** o PED1 deixa o membro ler os textos e barra a alteração com 403. Esta tela esconde a página inteira do membro, e o servidor do painel recusa o GET e o PUT para esse papel. O gateway, quando tiver `X-Role`, é a segunda trava.

## 6. Permissões

O papel é resolvido no servidor do painel, como nas outras telas. O navegador não escolhe o tenant nem o `X-Actor`.

| Ação | Plataforma | Admin | Membro (atendente) |
|---|---|---|---|
| Ver pedidos, contagem, detalhe e conversas da própria empresa | sim | sim | sim |
| Mudar status, inclusive recusar e cancelar | sim | sim | sim |
| Reenviar aviso que falhou | sim | sim | sim |
| Abrir e alterar textos / liga-desliga | sim | sim | não |

O PED1 (seção 7) propõe o cabeçalho `X-Role`. Isso ainda é decisão do gateway (seção 10, item 3) e não está no `API_ADMIN.md`. **Pendência:** o painel só envia `X-Role` depois que o contrato publicado o exigir. Até lá, a barreira do membro é a função do painel, que nem chama o gateway.

Telefone e endereço do pedido vêm inteiros para os três papéis, como o PED1 propõe. Não há papel só de leitura no painel.

## 7. Pendências de contrato

Nada disto será inventado na tela. “Publicado” significa presente no `API_ADMIN.md` em vigor, não só escrito no PED1.

| Necessidade da tela | Onde está | Estado |
|---|---|---|
| Lista com `status`, `unidade`, cursor | API_ADMIN e PED1 1.3 | Publicado. Status de hoje: `aguardando_loja`, `confirmado`, `recusado`, `cancelado` |
| Detalhe, `POST confirmar`, `POST recusar` (motivo opcional) | API_ADMIN | Publicado. 409 com `detalhes.status` |
| `GET /avisos` (caixa de envio, sem texto) | API_ADMIN | Publicado. Não serve para editar aviso |
| `em_preparo`, `pronto_retirada`, `saiu_entrega`, `concluido`, `proximos_status`, `POST .../status`, `previsao_min` | PED1 3 e 5.3 | Pendência PED1-a |
| Busca, período, modalidade, `unidade_nome`, cliente com canal, `numero_itens` | PED1 5.1 | Pendência PED1-a |
| Horário no item da lista | — | Pendência: não está na 5.1 nem no contrato atual. No detalhe, `entrega.horario` está na 5.2 |
| Linha do tempo e aviso por evento | PED1 5.2 | Pendência PED1-a |
| `GET .../pedidos/contagem` | PED1 5.4 | Pendência PED1-a |
| Textos, liga/desliga, prévia, reenvio | PED1 5.5 e 5.6 | Pendência PED1-b |
| `X-Role` | PED1 7 | Pendência PED1-b, e ainda é decisão |
| `nome_exibicao`, telefone formatado, `canal_info`, `estado`, `ultima`, unidade preferida, `ordem=recentes` | PED1 6 | Pendência PED1-c |
| Pagamento, troco, bairro, CEP, frete grátis, agendamento | ESPEC de gestão, tela 8 | Pendência G4. Fora do PED1 |
| Filtro de pedidos por `conversation_id` | — | Não existe. O atalho usa `busca` por telefone ou nome |

## 8. Fora deste bloco

- Não implementar até a aprovação desta especificação.
- A correção de Conversas da seção 3 pode ser o primeiro entregável depois do sim, sozinha, sem esperar o PED1.
- Pedidos, contador, som e Avisos esperam o trecho correspondente do PED1 publicado no `API_ADMIN.md`.
- Decisões 1 a 7 da seção 10 do PED1 continuam com o gateway. A tela usa a prioridade de nome já escrita lá quando `nome_exibicao` existir.
- Nenhuma unidade, pedido ou conversa real é alterada nesta etapa: este arquivo é só especificação.
