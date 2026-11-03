# Painel Luxtia

Repositório: https://github.com/marcoasp3030/painel_koji

Plataforma de integrações de delivery e mensagens (iFood, 99Food, WhatsApp Oficial e Uazapi).

## Desenvolvimento

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/marcoasp3030/painel_koji.git
cd painel_koji
git pull origin main
bun install
bun run dev
```

Confira que está no commit recente (`git log -1` deve mostrar a correção do MFA / Configurações). Sem `git pull`, o menu pode parecer a versão antiga (só Clientes).

### Com Docker

Sobe banco, autenticação, API e painel em `http://localhost:8080`, com o código montado no container: salvar um arquivo atualiza a tela. O acesso fica restrito à própria máquina.

```sh
python3 docker/gerar-segredos.py
echo "BOOTSTRAP_SUPER_ADMIN_SENHA=$(openssl rand -base64 18)" >> .env
echo "COMPOSE_FILE=docker-compose.local.yml" >> .env
docker network create --internal luxbrain_gateway_proxy
docker compose up -d
```

Entre com `admin@luxtia.local` e a senha de `BOOTSTRAP_SUPER_ADMIN_SENHA`. A conta é criada ao abrir a tela de entrada pela primeira vez.

| Ação | Comando |
| --- | --- |
| Parar, mantendo os dados | `docker compose down` |
| Ver os logs do painel | `docker compose logs -f painel` |
| Aplicar uma migration nova | `docker compose up -d` |
| Instalar dependência nova | `docker compose restart painel` |
| Apagar os dados e recomeçar | `docker compose down -v` |

As telas de Agentes dependem do gateway (repositório `marcoasp3030/gateway`), que roda em projeto próprio com `docker-compose.local.yml`, em modo `dry` e `mock`, sem enviar nada ao WhatsApp. No `.env` do painel, `GATEWAY_ADMIN_URL=http://luxbrain-gateway:8000/admin/v1`; `GATEWAY_PANEL_KEY` e `GATEWAY_PLATFORM_KEY` têm os valores de `PANEL_SERVICE_KEY` e `PANEL_PLATFORM_KEY` do gateway. Sem essas variáveis, as telas mostram "Gateway de agentes temporariamente indisponível".

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

Unidades e horários ocupa a altura da janela, com a lista de unidades à esquerda e o detalhe à direita. A lista tem busca, filtros clicáveis (Abertas, Pausadas, Sem horário), a situação com a hora de fechar ou abrir e Pausar/Reabrir direto na linha. Sem unidade aberta, a área principal mostra a situação do dia, as pausas e as exceções dos próximos sete dias. A unidade abre em abas (Agenda, Pagamentos, Horários, Exceções), e trocar de unidade mantém a aba. Dá para pausar por 30 minutos, 1 hora ou até o fim do turno, copiar a grade de outra unidade para o rascunho e, para o administrador, aplicar pausa ou exceção em várias unidades — inclusive feriados nacionais, só depois de confirmar. O histórico filtra pelo nome da unidade e pelo período no fuso da empresa.

Cada unidade tem Cidade e UF (lista das 27 UFs), usadas pelo gateway para os feriados estaduais e municipais no atendimento. A lista mostra "Cidade/UF" abaixo do endereço; unidade ativa sem cidade recebe o aviso "Sem cidade: só feriados nacionais serão considerados".

## Cardápio

Lista os itens do catálogo do gateway por unidade e por categoria, na ordem definida no painel, em tela cheia: categorias e itens têm rolagem própria. A barra do topo reúne unidade, busca (atalho `/`), Itens/Pratos iguais, Filtros e novo item/categoria, com os indicadores clicáveis logo abaixo. No desktop, a coluna lateral de categorias destaca a seção visível, leva direto ao bloco e marca as que têm item esgotado; no celular, a mesma navegação vira faixa horizontal. Cada categoria recolhe e expande, e categoria sem resultado some durante a busca. Na linha do item: ponto verde quando disponível ou selo quando há exceção, preço editável, interruptor Ativo, Esgotar/Repor com "Desfazer" no aviso, e o menu com Editar, ordem, Duplicar, Mover, Copiar e Arquivar. Clicar na linha abre a ficha. A situação de agora vem do gateway (`disponivel_agora` e o motivo em palavras).

Admin e plataforma (CAT3-a, contrato `gateway/docs/ESPEC_CAT3.md` seção 13):
- Criar, renomear e arquivar categoria. Ao arquivar uma categoria com itens, a tela pergunta se arquiva os itens ou move para outra categoria.
- Na linha: Ativo, Esgotar/Repor (até o fim do dia), preço editável, editar e o menu Duplicar, Mover, Copiar para outra unidade e Arquivar.
- "Novo item" e o painel lateral editam nome, descrição, categoria, preço, código, tipo, alcoólico, delivery, disponibilidade e observação interna. Ao salvar uma edição, pergunta se vale só nesta unidade ou em todas as unidades com este prato.
- Seleção em lote, com prévia antes de aplicar e resultado por item. Tela "Pratos iguais" para ligar, ignorar ou restaurar sugestões, com aviso quando os preços diferem.

Layout de gestão republicado em 30/10/2026 como `painel:bc6c695dbb029ffcc17c5acf75466bf8d20bb251`. A volta imediata é `painel:volta-20261030T165734Z`. O atendente consulta o cardápio e pode esgotar ou repor. Criar, preço, arquivar, lote e ligações ficam com admin e plataforma. O `PATCH` continua só com o que mudou e o `atualizado_em` lido. Preço vazio avisa que o item sai do atendimento. Conflito 409 oferece recarregar ou reaplicar. A disponibilidade tem prévia ao vivo e o histórico do item (quem, quando em Brasília, antes e depois) segue só para admin e plataforma. Prints com dados fictícios: `docs/prints-cat3-enc1/` (`tests/visual/cat3/capturar.cjs`).

## Pedidos

O menu Pedidos, para administrador, plataforma e atendente, ocupa a altura da janela: uma barra única reúne busca (atalho `/`), contagens por status, Quadro/Lista, Filtros e som, e o quadro por status tem rolagem por coluna. O cartão traz o próximo passo liberado pelo gateway (`proximos_status`), que avança o pedido em um clique; recusar, cancelar e informar previsão ficam no detalhe. A espera dos pedidos aguardando usa as mesmas cores da fila de Conversas. O detalhe abre num painel lateral com as ações fixas no rodapé. O cartão traz número, unidade, cliente, canal, entrega ou retirada, total, quantidade de itens e o tempo desde a entrada. O detalhe mostra itens, entrega, cliente, linha do tempo e o atalho da conversa. As ações saem só de `proximos_status`. No conflito 409 a tela recarrega o pedido e avisa que ele já foi atualizado. Filtro de origem (Reais, Piloto, Simulados, Teste; a tela abre com todas) e etiqueta discreta quando a origem não é real ou o canal não é WhatsApp. O contador do menu conta os pedidos aguardando a loja, de qualquer origem, a cada 15 segundos com a aba visível; o som de pedido novo é opcional e fica desligado até a pessoa ligar. Textos de aviso e reenvio vieram no PED1-b; o nome por prioridade, igual ao da conversa, no PED1-c.

## Conversas

Tela de operação: ocupa toda a altura da janela, com fila, conversa e, a partir de 1280 px, um painel fixo com contato, pedido, atendimento e follow-up (em telas menores ele abre pelo botão ao lado de Assumir). A fila tem busca, abas por estado com a contagem de quem aguarda e o botão "Abrir próxima", que abre a espera mais antiga. Agente, canal, ordem e data ficam em Filtros. Cada linha usa duas alturas de texto, com o restante no título. A espera muda de cor: até 5 minutos normal, até 15 atenção, depois crítica. A lista carrega sozinha ao rolar. Atalhos: `/` busca, `Alt+↑/↓` troca de conversa, `N` abre a próxima, `R` vai para a resposta. O texto em digitação de cada conversa fica guardado ao trocar entre elas, enquanto a tela estiver aberta. A pausa ao assumir vai de 15 minutos a 24 horas.

Responsável: quem assume ou responde fica com a conversa, e ela aparece na aba Minhas e com o nome da pessoa na fila. Enquanto isso, ninguém mais assume nem responde; o gateway recusa, mesmo com dois cliques no mesmo instante. Transferir, para si ou para um colega, fica a partir de supervisor (`docs/ESPEC_USUARIOS1.md`). A responsabilidade acaba ao devolver ao agente, ao encerrar ou quando a pausa vence, para ninguém ficar preso a uma conversa de quem saiu do turno.

Notas internas: a aba "Nota interna" da caixa de mensagem (atalho `I`) grava um comentário que só a equipe vê, na linha do tempo da conversa. Funciona mesmo com a conversa com outra pessoa e não pausa o agente. As notas ficam em tabela própria, fora de `mensagens`, então não vão ao cliente nem ao histórico do agente. Apaga quem escreveu ou, a partir de gestor, a equipe. Entram na exportação do contato e são apagadas na anonimização.

Encerrar e próxima: supervisor e gestor têm, no cabeçalho, o botão que encerra o atendimento depois de uma confirmação e abre quem aguarda há mais tempo. Nada é enviado ao cliente.

Busca na conversa: a lupa do cabeçalho procura em mensagens e notas, sem diferenciar acentos, e leva ao trecho, carregando o histórico antigo se precisar. Enter vai ao próximo resultado, e Shift+Enter, ao anterior.

Etiquetas: cada empresa cria as suas, com nome e cor (até 50). Supervisor e gestor gerenciam; todos os papéis aplicam, até 10 por conversa, no painel lateral. Aparecem como pontos coloridos na fila e têm filtro em Filtros. Entram na exportação do contato e saem na anonimização.

Enviar arquivo: o clipe da caixa de mensagem envia PDF, JPG ou PNG de até 10 MB, e o texto digitado vai como legenda. O formato é conferido pelo conteúdo do arquivo. O arquivo não fica guardado: a conversa mostra só o nome, e o agente vê que um arquivo foi enviado. Enviar pelo clipe segue a regra da resposta: assume a conversa e pausa o agente.

Respostas rápidas: `/` na caixa de mensagem (ou o botão de raio) abre a lista, com as mais usadas primeiro e busca por atalho ou texto. A resposta entra no campo para revisão e nunca é enviada sozinha. `{saudacao}`, `{nome}` e `{unidade}` são preenchidas pela conversa; o que ela não souber fica no texto e o envio espera a pessoa completar. "Gerenciar" cria, edita e apaga, partindo do texto já digitado, se houver. Resposta de "Toda a equipe" fica a partir de supervisor; "Só para mim" qualquer papel cria, e ninguém mais vê. Os dados ficam no gateway (migrações 056 a 058), que precisa ser publicado antes do painel; sem a rota, a conversa continua funcionando e o menu avisa que o recurso não está disponível.

Ao abrir, o histórico já fica nas mensagens mais recentes; se a pessoa subir para ler o passado, a posição é mantida e um atalho “Mensagens recentes” volta ao fim. No celular, a conversa ocupa a tela e há um voltar para a lista. Enter envia a mensagem e Shift+Enter quebra a linha. A lista e o detalhe mostram o atendimento atual (número, aberto, com humano ou encerrado, aberto em, encerrado em e motivo), o bloco de follow-up (agendado, cancelado ou ensaio, com horário de Brasília, tipo da pendência, motivo e “Cancelar este” na linha do agendado) e o selo “não quer follow-up” no contato, com Reativar só para admin e plataforma — a confirmação pede um motivo de pelo menos 3 caracteres, enviado no corpo do DELETE; depois, o contato mostra quem reativou e o motivo —, além do estado da conversa (encerrada, aguardando atendente, atendente ou bot), do canal com o nome cadastrado e do telefone legível. O histórico lista os atendimentos anteriores, com resumo, e as mensagens podem ser filtradas por atendimento. Admin e membro encerram o atendimento aberto ou reabrem só o último; se o gateway recusar (409), a tela explica e pede para atualizar. Nenhuma dessas ações envia mensagem ao cliente. Desde o PED1-c, o nome é o de exibição do gateway (cadastro > informado > perfil > telefone) com um selo discreto da origem; conversas de teste levam o selo "teste"; a última mensagem mostra autor e tipo; aparecem a unidade preferida e o pedido aberto, com atalho para o pedido. Filtros por estado (inclusive Encerrada) e ordem por atividade recente; a busca cobre os três nomes e o telefone. Qualquer papel usa "Editar nome" no cabeçalho para gravar o nome de cadastro (vazio apaga e volta ao próximo da prioridade); o gateway audita quem alterou. Os Pedidos mostram o mesmo nome da conversa. A tela pede o último evento confirmado (`GET /admin/v1/tenants/{tenant}/eventos/cursor`) antes de carregar a lista e usa esse `ultimo_id` como `desde` do polling.

## Histórico de gestão

Linha do tempo em tela cheia, agrupada por dia (Hoje, Ontem), com a hora no fuso da empresa. Cada linha mostra a ação, a unidade, quem fez e os campos alterados; clicar abre o antes e depois na própria linha. Unidade e período ficam na barra do topo, e a busca por identificador exato, em um botão ao lado. A lista carrega sozinha ao rolar.

## Avisos de pedido

Tela cheia, com os avisos à esquerda e o editor à direita. O interruptor da lista liga ou desliga na hora. A prévia ao lado do texto atualiza enquanto se digita e mostra também a versão sem dados opcionais; ela só monta o texto e não envia nada. As variáveis entram no ponto do cursor. Supervisor consulta; gravar fica com o gestor.

## Operação

`/ia/operacao`, para supervisor, gestor e plataforma, ocupa a altura da janela e mostra a fila de agora, os pedidos aguardando, a espera na fila, o tempo de resposta, a tabela por atendente e a lista "Fila agora", que abre a conversa em um clique. O período é de 24 horas, 7 ou 30 dias, e os dados atualizam a cada 15 segundos. Os tempos só existem a partir da publicação da migração 058 do gateway; antes dela não se guardava quem respondeu nem quanto a conversa esperou. Tempo de resposta vai da fala do cliente até a mensagem da pessoa logo depois.

## Comportamento do agente

A tela ocupa a área inteira: barra única com escopo, situação e ações do rascunho, seções à esquerda com sinal de alteração ou erro e busca por campo. Um erro ou bloqueio leva direto ao campo. As seções do perfil são só da tela: campo novo do gateway sem assunto aparece em Identidade.

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

## Cardápio interativo

O cliente abre `/cardapio#<token>`, sem login, monta o pedido e envia. O link é da conversa, vale 24 horas e é consumido no pedido. O gateway confere tudo com as mesmas regras do agente, e a página não recebe telefone, nome nem endereço. O atendente insere o link pelo botão de cardápio na conversa, e o agente recebe `link_cardapio` no pacote. Precisa de `PAINEL_PUBLIC_URL` no gateway. Na entrega, o CEP preenche o endereço pelo gateway (ViaCEP, com BrasilAPI de reserva), e o cliente pode editar e informar número, complemento e referência. Na tela Cardápio, "Ver como cliente" abre uma prévia que não envia pedido.

## Aparência do cardápio

Em Loja → Aparência do cardápio, o gestor define nome, frase, logo, banner, cores, cantos e títulos, com prévia ao vivo. Das três cores saem as demais (`src/lib/cardapio-tema.ts`), sempre com contraste legível. Imagens só em PNG, JPG ou WebP: o navegador reduz e converte, e o gateway confere o formato pelos bytes. Elas ficam no banco e saem por `/api/public/cardapio-imagem/<id>`.

Na mesma tela, a seção **Redes e contato** cadastra Instagram, Facebook e telefone (opcional, por empresa). Salva em rota própria (`cardapio/redes`) para não apagar ao mudar as cores. No cardápio do cliente: ícones abaixo do slogan, bloco “Siga a gente” no rodapé e CTA de Instagram após o pedido enviado. Sem redes ativas, nada aparece. Contrato: `gateway/docs/ESPEC_CARD_REDES.md`.

## Clientes da plataforma

A tela Clientes é só do Super Admin e lê os dados com service role depois de conferir o papel, porque a RLS de acessos e integrações exige aal2. Suspender um cliente bloqueia a entrada no painel, mas não para os agentes: isso se faz em Empresas do gateway. Excluir exige digitar o nome do cliente.

## Usuários e papéis

A tela Usuários lista a equipe com busca e filtros; convite e edição abrem em painel lateral. Cada pessoa só altera quem poderia convidar: o supervisor gere funcionários das suas unidades, e a regra `podeGerirUsuario` vale no servidor para papel, unidades, convite e desativação. Ninguém altera o próprio acesso.

USUARIOS1 está no ar (`docs/ESPEC_USUARIOS1.md`). Sem SMTP, quem convida vê o link uma vez, por 24 horas, de uso único e revogável. Com `GATEWAY_PLATFORM_KEY` vazia, a plataforma usa a chave da empresa e o log avisa uma vez por dia. `admin@luxtia.local` é conta de emergência: segunda etapa obrigatória no primeiro login desta versão, sem os 7 dias, e cada entrada dela gera alerta na auditoria. O servidor manda `X-Role` (`plataforma`, `gestor`, `supervisor`, `funcionario`) e `X-Unidades`. Prints em `docs/prints-usuarios/`.

## Entrada (login)

ENTRADA1 publicado (`docs/ESPEC_ENTRADA1.md`), imagem `painel:9f2a6766f10982c00305b8c6808b62b99c99ebf8`. Volta: `painel:volta-20261030T192732Z`. Login com mostrar/ocultar senha, Caps Lock, “Esqueci a senha”, bloqueio após 5 falhas em 15 minutos, MFA com 6 caixas e código de recuperação, senha mínima 12 no convite/redefinição, e “Link de nova senha” em Usuários. Sem SMTP o pedido de redefinição orienta a falar com o gestor. Prints em `docs/prints-entrada/`. MFA1 continua com `MFA1_OBRIGATORIO=0`.
