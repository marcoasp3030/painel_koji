## [2026-10-21 22:45] — Telas de documentos (não publicadas)
- **Autor:** Grok 4.7
- **Objetivo:** Chaves de formulário, documentos e webhooks de saída no painel, no padrão do cardápio.
- **Arquivos alterados:**
  - `src/routes/_authenticated/ia/documentos.tsx`, `chaves-formulario.tsx`, `webhooks-saida.tsx` — criados
  - `src/components/luxtia/documentos/`, `WebhooksSaida.tsx` — criados
  - `src/lib/gateway/documentos.ts`, `documentos.server.ts`, `webhooks.ts`, `webhooks.server.ts` — criados
  - `src/lib/gateway-documentos.functions.ts`, `gateway-webhooks.functions.ts` — criados
  - `src/lib/gateway/cliente.server.ts`, `modulo.server.ts`, `nav.ts`, `vocabulario.ts` — modificados — download, permissão, menu e escopo
  - `docs/prints-arq-fup/01` a `08` — criados — prints com dados fictícios
- **Resumo das mudanças:** A chave de formulário aparece uma vez. O documento mostra os selos de confiança, baixa o original e apaga com confirmação. Os webhooks incluem os eventos de documento e de follow-up.
- **Decisões e justificativas:** Tipo e data filtram a página carregada; o estado vai ao gateway. Admin e plataforma apagam e revogam; o membro consulta.
- **Comandos executados:** `bun test` documentos e módulo → OK
- **Erros e resoluções:** nenhum neste commit
- **Pendências / TODO:** não publicado
- **Próximos passos:** telas de follow-up no commit seguinte

## [2026-10-21 22:40] — Caddy: 11 MiB só em documentos
- **Autor:** Grok 4.7
- **Objetivo:** Aceitar o PDF do formulário sem abrir o limite no resto da API.
- **Arquivos alterados:**
  - `docker/Caddyfile` — modificado — 11 MiB em `/gateway/api/v1/documentos` e subcaminhos; 2 MiB no restante
- **Resumo das mudanças:** O proxy usa um trecho único e aplica o corpo maior só na rota de documentos. `/gateway/health/ops` continua público, como já estava no ar.
- **Decisões e justificativas:** Recarregar o Caddy, sem reiniciar. O arquivo não entra na imagem do painel.
- **Comandos executados:** `caddy validate` → OK; `caddy reload` → OK
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** painel das telas novas ainda não publicado
- **Próximos passos:** revisar os prints antes de publicar

## [2026-10-20 17:57] — Pedidos voltaram a aparecer (publicado)
- **Autor:** Grok 4.7
- **Objetivo:** O quadro de Pedidos, em Agentes, estava vazio. Analisar e corrigir.
- **Arquivos alterados:**
  - `src/components/luxtia/Pedidos.tsx` — modificado — a tela abre com todas as origens
  - `src/components/luxtia/ContadorPedidos.tsx` — modificado — o aviso conta todo pedido aguardando a loja
  - `README.md`, `instrucoes.md`, `docs/worklog.md` — modificados — registro
- **Resumo das mudanças:** A imagem do CAT3-a ligou o filtro que deixava só pedidos reais. No By Koji há 0 reais, 2 de piloto (1 aguardando a loja) e 12 de teste. O quadro e o número do menu ficavam em zero. A tela volta a listar todas as origens; o filtro continua no painel.
- **Decisões e justificativas:** Não reclassificar pedido em produção: a marcação teste/piloto é do gateway. O padrão “só reais” escondia o único pedido que a loja precisa atender. Nada no gateway foi editado.
- **Comandos executados:** `bun test` pedidos → 8 OK; `tsc` e ESLint → OK. Tag `painel:volta-pedidos-b98f06b75967` = `sha256:b98f06b7…`. Backup `pre-pedidos-20261020T205548Z`, `pg_restore --list` → 279. Build → `painel:pedidos-20261020` = `sha256:71e678d2…`. `verificar-chave-no-bundle.sh` → OK. `up -d --no-deps --no-build painel` → container `6c90da349d93`. HTTPS: `/` 200, `/ia/pedidos` 200, `/gateway/health` 200, `/gateway/admin/v1/tenants` 404. Leitura: 14 pedidos sem filtro; `origem=real` 0; 1 aguardando (piloto). Logs: 1 linha, zero erros.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** não commitado. Os 12 pedidos antigos seguem como teste e aparecem com a etiqueta Teste.
- **Próximos passos:** volta, se precisar: `docker tag painel:volta-pedidos-b98f06b75967 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.

## [2026-10-20 17:30] — CAT3-a e ENC1-a publicados (só o painel)
- **Autor:** Grok 4.7
- **Objetivo:** Publicar o cardápio CAT3-a e os atendimentos ENC1-a, e conferir só com leitura.
- **Arquivos alterados:**
  - `README.md`, `instrucoes.md`, `docs/worklog.md` — modificados — registro da publicação
- **Resumo das mudanças:** Imagem de volta `painel:volta-cat3-c1c1c96e2719` (`sha256:c1c1c96e…`, a mesma do CAT2). Imagem nova `painel:cat3a-20261020` (`sha256:b98f06b7…`). Container do painel `a0c967e48e50`. Backup `pre-cat3a-20261020T202828Z`. Nenhum item, categoria ou atendimento foi alterado.
- **Decisões e justificativas:** Sem mudança de schema: a volta é só a tag da imagem, sem restaurar o dump. Conferência de dados pelo mesmo GET que a tela usa, com papel admin, só leitura.
- **Comandos executados:** tag conferida → OK; `pg_restore --list` → 279; `docker compose build painel` → OK; `verificar-chave-no-bundle.sh` → OK; `up -d --no-deps --no-build painel` → OK. HTTPS: `/` 200, `/ia/cardapio` 307 e 200 (título Cardápio | Luxtia), `/ia/conversas` 200, `/gateway/health` 200, `/gateway/admin/v1/tenants` 404. Leitura: 4 unidades, categorias na ordem do gateway (nenhuma com posição própria), 189 sugestões, 20/20 conversas da página com atendimento. Logs: 1 linha, zero erros, zero chave.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** nenhum dado de produção alterado. Não commitado.
- **Próximos passos:** volta, se precisar: `docker tag painel:volta-cat3-c1c1c96e2719 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.

## [2026-10-20 17:25] — CAT3-a e ENC1-a no painel (não publicado)
- **Autor:** Grok 4.7
- **Objetivo:** Cardápio do dia a dia (CAT3-a, gateway:fbfea15) e atendimentos na conversa (ENC1-a, gateway:0268e06), para revisão antes de publicar.
- **Arquivos alterados:**
  - `src/components/luxtia/cardapio/CardapioCat3.tsx`, `ItemCat3.tsx`, `OperacoesCat3.tsx`, `Cardapio.tsx` — modificados — abas de unidade, categorias e itens arrastáveis, ações rápidas, lote, sugestões
  - `src/lib/gateway/cat3.ts`, `cat3.server.ts`, `gateway-cat3.functions.ts` — modificados — rotas do contrato, membro só esgota e repõe
  - `src/components/luxtia/AtendimentosConversa.tsx`, `Conversas.tsx` — modificados — atendimento atual, histórico, filtro de mensagens, encerrar e reabrir
  - `src/lib/gateway/enc1.ts`, `enc1.server.ts` — modificados — rótulos do contrato e 409 de encerrar/reabrir
  - `src/lib/gateway/cat3-enc1.test.ts`, `tests/visual/cat3/` — modificados — testes e prints
  - `README.md`, `instrucoes.md`, `docs/worklog.md` — modificados — registro
- **Resumo das mudanças:** A tela de cardápio passa a ser por unidade e categoria, com ordem arrastável, esgotado do dia, painel do item com alcance do prato, lote com prévia e sugestões de ligação. A conversa mostra o atendimento atual e o histórico, com mensagens filtradas e os botões Encerrar e Reabrir.
- **Decisões e justificativas:** Contratos só de leitura (`ESPEC_CAT3.md` §13 e `ESPEC_ENC1A.md` §7). Preço rápido e “Disponível” valem só nesta unidade; “em todas” aparece ao salvar o painel. Reabrir só o último. Gateway não foi editado e nada foi publicado.
- **Comandos executados:** `bun test` → 143 OK, 6 ignorados; `tsc --noEmit` → OK; ESLint dos arquivos → OK; Playwright pt-BR → 8 prints, zero erros de JavaScript.
- **Erros e resoluções:** O 409 de encerrar lia a variável `d` fora do `try` (ReferenceError). A ação passou a ficar fora do `try`. Categorias arquivadas vinham duplicadas porque `arquivadas=true` inclui as ativas; a lista agora junta por id.
- **Pendências / TODO:** revisão do Marco; sem commit e sem publicação.
- **Próximos passos:** publicar só o painel depois da revisão dos prints.

## [2026-10-20 10:35] — Gateway: clique de botão no iPhone (ButtonsResponseMessage)
- **Autor:** Auto (Composer)
- **Objetivo:** Fazer o gateway ler o toque em botão de resposta quando o uazapi manda `ButtonsResponseMessage` (aparelhos Apple).
- **Arquivos alterados:**
  - `gateway/app/canais/uazapi.py` — modificado — reconhece `ButtonsResponseMessage`; título/`id` Apple
  - `gateway/tests/fixtures/uazapi/clique_botao_apple.json` — criado — payload real 16/10 mascarado
  - `gateway/tests/test_botoes.py` — modificado — teste do clique Apple
  - `gateway/docs/ESPEC_BOTOES.md`, `gateway/PROGRESS.md` — modificados — registro
- **Resumo das mudanças:** O mesmo caminho do clique Android agora aceita o formato Apple. Publicado no gateway com tag de volta.
- **Decisões e justificativas:** Observação do Marco + payload real do dia 16; sem mudar o contrato do pacote ao agente.
- **Comandos executados:** `SUITE_ALVO=tests/test_botoes.py` → 4 OK; build/up gateway+worker+agendador → health OK; normalize no container → Entrega/`entrega`.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** commit do gateway (ainda não pedido)
- **Próximos passos:** validar com um toque real em iPhone; se ok, commit.

## [2026-10-16 16:48] — Pedidos: filtro origem + contador só reais
- **Autor:** Auto (Composer)
- **Objetivo:** Na tela de Pedidos, usar origem/canal do gateway (1e7c6b6): filtro Reais padrão, etiquetas e contador do menu só reais.
- **Arquivos alterados:**
  - `src/lib/gateway/pedidos.ts` — modificado — ORIGENS/CANAIS, schema `origem` e `so_reais`
  - `src/lib/gateway/pedidos.server.ts` — modificado — query `origem`; contagem `so_reais` via lista
  - `src/lib/gateway/pedidos.test.ts` — modificado — origem na lista; teste so_reais
  - `src/components/luxtia/Pedidos.tsx` — modificado — filtro origem, EtiquetaOrigemCanal
  - `src/components/luxtia/ContadorPedidos.tsx` — modificado — `so_reais: true`
  - `instrucoes.md`, `README.md`, `docs/worklog.md` — modificados — registro
- **Resumo das mudanças:** Lista e detalhe passam a filtrar/exibir origem e canal. Padrão da tela é só reais. Menu conta apenas aguardando_loja reais (workaround sem filtro em `/contagem`).
- **Decisões e justificativas:** Etiqueta só quando origem ≠ real ou canal ≠ whatsapp, para não poluir o caso comum. Contador não usa `/contagem` bruto porque ainda não aceita origem.
- **Comandos executados:** `bun test` → 133 OK, 6 skip; `tsc --noEmit` → OK; ESLint (arquivos alterados) → OK (prettier --fix).
- **Erros e resoluções:** TS2375 `exactOptionalPropertyTypes` em `EtiquetaOrigemCanal` — normalizado com `?? null`. gestao.test já usava `chamadaUnidade`.
- **Pendências / TODO:** revisão do Marco; sem commit/publicação.
- **Próximos passos:** validar na UI autenticada; publicar após aprovação.

## [2026-10-15 19:44] — Acesso cesar.almeida@luxtia.ia.br
- **Autor:** Auto (Composer)
- **Objetivo:** Criar usuário admin no painel com e-mail cesar.almeida@luxtia.ia.br.
- **Arquivos alterados:**
  - `instrucoes.md` — modificado — registro da fase
  - `docs/worklog.md` — modificado — esta entrada
- **Resumo das mudanças:** Conta criada no GoTrue (e-mail confirmado) e papel `super_admin` em `user_roles`. Sem vínculo com cliente, porque o pedido foi de perfil admin do sistema (mesmo padrão de marco.santos).
- **Decisões e justificativas:** Papel `super_admin` para acesso de plataforma; e-mail `@luxtia.ia.br` indica usuário da Luxtia, não admin de um tenant específico.
- **Comandos executados:** POST `/auth/v1/admin/users` → OK (id `7e9e6751-5e2f-4de7-b8dc-d6beebb888f9`). INSERT em `user_roles` → OK. login em `/auth/v1/token` → 200.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** nenhuma
- **Próximos passos:** entrar em https://painel.luxbrain.com.br/ com o e-mail informado

## [2026-10-15 16:04] — MULTI1-a: telas de Modelos de agente e Módulos do agente
- **Autor:** Claude Opus 4.6
- **Objetivo:** Implementar as peças de UI do MULTI1-a: tela de modelos de agente (plataforma), módulos do agente (aba no detalhe), tipos estendidos e filtro de modelos ativos.
- **Arquivos alterados:**
  - `src/lib/gateway/tipos.ts` — modificado — `ModeloAgenteCompleto` com todos os campos §10.2 (segmento, ativo, skyone_ref, modulos_permitidos/padrao, motivos_transferencia, tipos_solicitacao, tipo, etc.) e `ItemRotulado`
  - `src/lib/gateway-modelos.functions.ts` — criado — listarModelosAgente (GET com filtros), obterModeloAgente, criarModeloAgente (POST), editarModeloAgente (PATCH = nova versão); tudo via sessao.plataforma()
  - `src/routes/_authenticated/ia/modelos.tsx` — criado — lista com filtro ativo/inativo, detalhe com módulos/motivos/tipos, criar e editar com aviso claro de nova versão
  - `src/components/luxtia/agente/ModulosDoAgente.tsx` — criado — mostra GET …/agentes/{id}/modulos (permitidos, da_empresa, ligados_no_agente); admin/plataforma altera módulos ligados ou "padrão do modelo" (null); plataforma altera módulo da empresa com aviso que vale para toda a empresa
  - `src/routes/_authenticated/ia/agentes.$agenteId.tsx` — modificado — nova aba "Módulos" para admin/plataforma
  - `src/lib/gateway-agentes.functions.ts` — modificado — listarModelos agora passa ativo=true ao gateway
  - `src/lib/gateway-modulos.functions.ts` — modificado — retorno tipado em alterarModuloEmpresa e alterarModulosAgente
  - `src/routeTree.gen.ts` — modificado — rota /ia/modelos registrada
- **Resumo das mudanças:** Tela completa de Modelos de agente (só plataforma): lista com filtro, detalhe com cartões de módulos/motivos/tipos, criar modelo (v1) e editar (nova versão com aviso explícito). Aba Módulos no detalhe do agente para admin/plataforma. Listagem de modelos para criação de agente agora filtra ativo=true.
- **Decisões e justificativas:** Edição de motivos e tipos no formato id:rótulo[:converte] por linha, simples e sem inventar componente complexo. O aviso de "nova versão" aparece no título, na descrição e num banner amarelo. A lista de modelos para criação de agente passa ativo=true direto na query ao gateway (não só filtro client-side) para garantir que modelos inativos não apareçam. Módulos do agente: "padrão do modelo" = null, como no contrato.
- **Comandos executados:** `tsc --noEmit` → OK; ESLint → 0 erros (17 formatações corrigidas com --fix). Testes não rodados (bun indisponível no host).
- **Erros e resoluções:** (1) TSC TS2345 em ultimas.set(m, m) — chave deveria ser m.id, não m; corrigido e removido código duplicado. (2) TSC TS2339 no cast do editar — trocado para chamada direta tipada. (3) TSC serialization em alterarModuloEmpresa/alterarModulosAgente — retorno trocado para `{ ok: true }` em vez de `unknown`.
- **Pendências / TODO:** testes unitários (bun indisponível), build Docker e publicação. Não commitado.
- **Próximos passos:** build e publicação após validação; conferência visual autenticada como plataforma.

## [2026-10-13 00:20] — CAT2 publicado, com confirmação da própria tela
- **Autor:** Claude Opus 5.5
- **Objetivo:** Trocar o confirm() do navegador ao salvar por uma janela da tela e publicar só o painel.
- **Arquivos alterados:**
  - `src/components/luxtia/cardapio/ItemCat2.tsx` — modificado — janela "Confirmar antes de salvar", com "Salvar mesmo assim" e "Voltar"
  - `tests/visual/cardapio/capturar-cat2.cjs` — modificado — "Voltar" não grava; "Salvar mesmo assim" grava
  - `README.md`, `instrucoes.md` — modificados
- **Resumo das mudanças:** Preço vazio e categoria que deixa de existir, no painel e na edição rápida, abrem um AlertDialog com os mesmos textos dos avisos. Os dois avisos juntos vão na mesma janela. Confirmações de descartar rascunho continuam as que já existiam.
- **Decisões e justificativas:** As três decisões aprovadas ficam: avisos junto do campo, histórico só para admin/plataforma, lote só com disponibilidade e `atualizado_em`.
- **Comandos executados:** `bun test` → 127 OK, 6 ignorados; `tsc` e ESLint → OK; roteiro Playwright → OK (Voltar e Salvar mesmo assim). Tag `painel:volta-cat2-077a798d9a72` = `sha256:077a798d9a729c08672137909411eefa415cffc1774949c28cbd729ca0fa97d2` conferida antes do build. Build → imagem `painel:cat2-20261013` = `sha256:c1c1c96e2719c9182442f97dd5a2124d42881f501c7178fc2678a29548be7c1b`. `up -d --no-deps --no-build painel`. `verificar-chave-no-bundle.sh` → OK. HTTPS: `/` 200, `/ia/cardapio` 307 para `?unidade=&busca=&filtro=todos` e 200, `/gateway/health` 200, `/gateway/admin/v1/tenants` 404. Leitura GET: bykoji 888 itens, 193 com preço, 0 sem `disponivel_agora` (615 sem preço, 80 inativos). "a confirmar" ausente no frontend publicado. Logs sem a chave. Os outros containers não foram recriados.
- **Erros e resoluções:** O roteiro visual comparou a categoria "Petiscos" com o painel aberto; o fundo fica oculto para o leitor de tela, então a contagem vinha 0. A conferência passou a olhar o aviso que continua no painel depois de "Voltar".
- **Pendências / TODO:** nenhum item de produção foi alterado. Não commitado.
- **Próximos passos:** volta, se precisar: `docker tag painel:volta-cat2-077a798d9a72 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.

## [2026-10-13 00:11] — CAT2: edição do item no Cardápio (não publicada)
- **Autor:** Claude Opus 5.5
- **Objetivo:** Atualizar o Cardápio para o contrato CAT2 do gateway (edição do item, preço rápido, 409, agora real, prévia, histórico, erros por campo).
- **Arquivos alterados:**
  - `src/lib/gateway/cardapio-cat2.ts` — modificado — reescrito: preço pt-BR, diferença dos campos, avisos, motivos em palavras, histórico em palavras e no horário de Brasília
  - `src/lib/gateway/cardapio.server.ts` — modificado — leituras do CAT2 numa tabela por ação; histórico projetado
  - `src/lib/gateway/cardapio-ux.ts` — modificado — `ResultadoItem` com `atual` do 409
  - `src/components/luxtia/cardapio/ItemCat2.tsx` — modificado — reescrito: painel do item, preço rápido, conflito, prévia ao vivo, histórico
  - `src/components/luxtia/cardapio/CardapioVista.tsx` — modificado — sem "A confirmar"; situação real; painel antigo virou só lote
  - `src/components/luxtia/cardapio/DisponibilidadeEditor.tsx` — modificado — prop `previa`
  - `src/components/luxtia/Cardapio.tsx` — modificado — `atualizarLocal`, 409 no lote
  - `src/lib/gateway/cardapio-cat2.test.ts` — criado — 10 testes
  - `src/lib/gateway/cardapio.test.ts`, `cardapio-ux.test.ts` — modificados — `atualizado_em` e `disponivel_agora`
  - `tests/visual/cardapio/gateway-falso.ts` (criado), `capturar-cat2.cjs` (criado), `main.tsx` (modificado) — prints
  - `README.md`, `instrucoes.md` — modificados
- **Resumo das mudanças:** Outra sessão tinha começado o CAT2 nos mesmos arquivos (`ItemCat2.tsx`, `cardapio-cat2.ts`, ações no servidor e regras em `modulo.server.ts`/`erros.ts`). Com a autorização do Marco, assumi o trabalho, completei e reformatei. Regras de acesso e `itemAtual` em `erros.ts` mantidos como estavam.
- **Decisões e justificativas:** Os avisos aparecem junto do campo e o salvar também pede confirmação. "Recarregar" também atualiza a lista; sem isso, o próximo salvamento cairia de novo em 409. Histórico só para admin/plataforma, porque `gestao/alteracoes` já era só de admin. A edição em lote continua só com disponibilidade, agora também com `atualizado_em`.
- **Comandos executados:** `bun test` → 127 OK, 6 ignorados; `tsc --noEmit` → OK; ESLint dos arquivos → OK; Playwright (imagem `mcr.microsoft.com/playwright:v1.58.2-noble`, Vite local) → 7 prints e verificações OK, zero erros de JavaScript.
- **Erros e resoluções:** (1) 3 testes antigos falhavam: `"campo": "atualizado_em", "mensagem": "Required"` e `disponivelAgora(item)` → `null`. Causa: o código já exigia o CAT2 e os testes não. Corrigido nos testes. (2) `tsc` TS2379/TS2345 (`exactOptionalPropertyTypes`): `atual?: ItemCardapio | undefined` e `query` omitida quando vazia. (3) Teste da plataforma: `AcessoNegado: Escolha a empresa.` Faltava `empresa` no teste.
- **Pendências / TODO:** revisão do Marco; build Docker e publicação só depois. Não commitado. Prints autenticados de produção dependem de login.
- **Próximos passos:** publicar do jeito de sempre (tag de volta da imagem `077a798d…`, build, troca só do painel) e conferir só com leitura.

## Cardápio — revisão UX (13/10/2026, não publicada)

- Nova lista por unidade/categoria, resumos e filtros, URL persistente, painel lateral de disponibilidade, atalhos/cópia e lote com progresso. Consulta do atendente sem controles de edição; PATCH segue exclusivo de admin/plataforma.
- Prévia visual em Chromium pt-BR com dados fictícios: seis prints em `docs/prints-cardapio/`. Relatório e pendências de contrato em `docs/VALIDACAO_CARDAPIO_UX.md`.
- 117 testes aprovados, 6 REST antigos ignorados, zero falhas; tsc, ESLint e build Vite aprovados. Nenhum item real alterado, nenhum serviço permanente recriado. Gateway somente leitura, sem commits. Aguardar revisão dos prints antes de publicar a nova versão.
- O admin DISP1 não devolve disponibilidade avaliada agora/feriados: itens restritos aparecem “A confirmar”, sem classificação inventada. Edição de preço/nome/descrição/ativo/categoria e prévia operacional continuam pendências explícitas do gateway.

## [2026-10-12 22:30] — DISP1: tela Cardápio publicada
- **Autor:** Claude Opus 5.5
- **Objetivo:** Publicar a tela aprovada pelo Marco e conferir só com leitura.
- **Arquivos alterados:**
  - `README.md` — modificado — seção Cardápio
- **Resumo das mudanças:** Publicação do bloco da entrada abaixo, sem mudança de código. Regras aprovadas pelo Marco: sete dias viram lista vazia; com a chave desligada, pelo menos um dia. "Turno" fica nos horários das unidades.
- **Decisões e justificativas:** Conferência da lista feita pelo mesmo `GET` que a tela usa (100 por página, papel membro), de dentro do contêiner, porque a tela real exige login. Nenhum item alterado.
- **Comandos executados:** tag `painel:cal1-20261012` (= `85b1c122…`) → OK; `docker compose build painel` + `up -d --no-deps painel` → OK, imagem `756361eb…`; `verificar-chave-no-bundle.sh` → OK; `/`, `/ia/cardapio`, `/ia/unidades` 200; `/gateway/admin/v1/tenants` 404; logs sem erro; leitura: 9 páginas, 888 itens (808 ativos), 4 com disponibilidade = os 4 "Almoço executivo" com resumo; navegador: título "Cardápio | Luxtia" e ida ao login sem sessão; `docker rmi zenika/alpine-chrome` (autorizado) → OK
- **Erros e resoluções:** nenhum.
- **Pendências / TODO:** conferência visual autenticada pelo Marco (e os prints do CAL1). Não commitado.
- **Próximos passos:** volta: `docker tag painel:cal1-20261012 painel_koji-painel` + `docker compose up -d --no-deps --no-build painel`.

## [2026-10-12 22:25] — DISP1: tela Cardápio com disponibilidade por item (não publicada)
- **Autor:** Claude Opus 5.5
- **Objetivo:** Mostrar e editar a disponibilidade do item (contrato DISP1 do gateway) e o resumo na lista.
- **Arquivos alterados:**
  - `src/lib/gateway/cardapio.ts` — criado — tipos, rascunho do formulário, corpo do PATCH, validação (reaproveita `problemaGrade`), schema da entrada
  - `src/lib/gateway/cardapio.server.ts` — criado — listar (`GET catalogo/itens`, 100 por página) e `PATCH catalogo/itens/{id}`; projeção sem descrição/observação
  - `src/lib/gateway-cardapio.functions.ts` — criado — função de servidor
  - `src/lib/gateway/modulo.server.ts` — modificado — regras: GET para admin e atendente; PATCH só admin e só com a chave `disponibilidade`
  - `src/lib/gateway/erros.ts` — modificado — ajuda para erro no campo `disponibilidade`
  - `src/components/luxtia/Cardapio.tsx`, `src/routes/_authenticated/ia/cardapio.tsx`, `src/routeTree.gen.ts`, `src/lib/nav.ts` — criados/modificados — tela, rota e menu "Cardápio"
  - `src/components/luxtia/gestao-base.tsx` — modificado — `EditorFaixas` aceita `nome` (padrão "turno"; no cardápio "faixa")
  - `src/lib/gateway/cardapio.test.ts` — criado — 8 testes
- **Resumo das mudanças:** O painel não tinha tela de cardápio; foi criada uma mínima: busca, filtro por unidade, "Carregar mais", etiqueta com o resumo do gateway e "Inativo". Admin/plataforma veem o botão "Disponibilidade" (diálogo com "Sempre disponível", dias, "Exceto feriados" e faixas); atendente só lê.
- **Decisões e justificativas:** "Sempre disponível" envia `null`. Os sete dias marcados vão como lista vazia (o gateway trata igual: sem restrição de dia); desligado sem nenhum dia é recusado no painel. O resumo exibido é sempre o do gateway, nunca montado no painel. A pré-visualização foi feita com dados de exemplo renderizando os componentes reais, porque a tela real exige login e chamaria o gateway de produção.
- **Comandos executados:** `bun test` → 108 OK, 6 ignorados, 0 falhas; `tsc --noEmit` → OK; ESLint → 0 erros (avisos antigos de fast refresh); prints da pré-visualização com Chromium headless (`zenika/alpine-chrome`) → OK. **Sem build e sem publicação.**
- **Erros e resoluções:** TS2353 em `Cardapio.tsx` (`item_id` não existe em `Omit<PedidoCardapio,"empresa">`: `Omit` sobre união só mantém chaves comuns) → `SemEmpresa<T>` distributivo.
- **Pendências / TODO:** aprovação do Marco; depois: tag de volta, build, troca do `painel`, conferência só leitura. Não commitado.
- **Próximos passos:** publicar após aprovação. Imagem em uso hoje: a do CAL1 (`85b1c122…`); volta do CAL1 continua `painel:cfg1a-20261011`.

## [2026-10-12 20:40] — CAL1: Cidade e UF no cadastro de unidades
- **Autor:** Claude Opus 5.5
- **Objetivo:** Editar `cidade`/`uf` da unidade (contrato admin do gateway CAL1) e avisar quando a unidade está sem cidade.
- **Arquivos alterados:**
  - `src/lib/gateway/gestao.ts` — modificado — `UFS` (27), `cidadeUf`, tipo `Unidade` com `cidade`/`uf`, schema de escrita, `alertasUnidade.semCidade`
  - `src/lib/gateway/gestao.server.ts` — modificado — `cidade` e `uf` na projeção da unidade
  - `src/components/luxtia/GestaoUnidades.tsx` — modificado — campos Cidade e UF com ajuda no formulário; Cidade/UF no cartão e no detalhe; etiqueta "Sem cidade…"
  - `src/lib/gateway/gestao.test.ts` — modificado — teste CAL1 e expectativa de `alertasUnidade`
  - `instrucoes.md`, `README.md` — modificados
- **Resumo das mudanças:** Formulário ganha Cidade (até 80) e UF (select das 27, "—" = sem UF); vazio grava `null`. Lista e detalhe mostram "Cidade/UF" em texto pequeno; unidade ativa sem cidade mostra o aviso, junto dos de horário e WhatsApp.
- **Decisões e justificativas:** A escrita no gateway é `PATCH` (não `PUT`), como as demais edições de unidade. A lista é de cartões, então "coluna discreta" virou uma linha discreta no cartão. A lista fechada de UFs fica no painel porque o gateway só confere o formato (duas maiúsculas). O aviso vale só para unidade ativa, como os outros alertas. `cidade`/`uf` vão para todos os papéis (não são dados sensíveis); escrever continua só admin/plataforma.
- **Comandos executados:** `bun test` → 100 OK, 6 ignorados, 0 falhas; `tsc --noEmit` → OK; ESLint nos 4 arquivos → OK (1 aviso antigo de fast refresh); tag `painel:cfg1a-20261011` da imagem em uso → OK; `docker compose build painel` + `up -d --no-deps painel` → OK; `verificar-chave-no-bundle.sh` → OK; `/` e `/ia/unidades` 200, `/gateway/admin/v1/tenants` 404, logs sem erro
- **Erros e resoluções:** no teste novo, esperei exceção para dado inválido, mas `executarGestao` devolve `{ok:false}` (`expect…rejects` → "Received promise that resolved"); corrigida a expectativa, código sem mudança. ESLint acusou só formatação do Prettier nas linhas novas → `prettier --write`.
- **Pendências / TODO:** prints da tela dependem de login do Marco no navegador do Cursor; nenhuma unidade real foi salva. Não commitado (regra do painel).
- **Próximos passos:** prints (lista, formulário aberto sem salvar). Volta: `docker tag painel:cfg1a-20261011 painel_koji-painel` + `docker compose up -d --no-deps --no-build painel`.

## [2026-10-11 16:46] — Proxy: liberar /gateway/health/ops (OPS1)
- **Autor:** Claude Opus 5.5
- **Objetivo:** Deixar o UptimeRobot ler `/gateway/health/ops` por fora, só com `ok` (200/503), sem motivos.
- **Arquivos alterados:**
  - `docker/Caddyfile` — modificado — `/gateway/health/ops` incluído no `@publico` do bloco `gateway_https`
- **Resumo das mudanças:** Uma linha no proxy. A resposta pública já sai sem `motivos`: o Caddy envia `X-Forwarded-For` e o gateway trata a chamada como externa. Os motivos ficam só em `http://127.0.0.1:8100/health/ops`.
- **Decisões e justificativas:** Configuração conferida com `caddy validate` numa cópia dentro do contêiner antes de tocar no arquivo. Arquivo reescrito no lugar (mesmo inode, o bind mount é de arquivo único) e `caddy reload`, sem recriar o contêiner. Nada no gateway mudou.
- **Comandos executados:** `caddy validate` → OK; `caddy reload` → OK; por fora: `/gateway/health/ops` 503 `{"ok":false}` (esperado até o B2 estar no `.env`), `/gateway/health` 200, `/gateway/admin/v1/tenants` 404, `/gateway/api/v1/unidades` sem chave 401, `/gateway/health/opsx` 404, `/` 200; proxy "Up 3 days"
- **Erros e resoluções:** nenhum. O aviso "Unnecessary header_up X-Forwarded-For" no reload já existia e não muda nada.
- **Pendências / TODO:** não commitado (regra do painel). Backup do arquivo anterior em `/home/twadmin/backups/painel/pre-healthops-20261011T194613Z/Caddyfile`.
- **Próximos passos:** depois das credenciais do B2 e do Telegram no `.env`, conferir `{"ok":true}` 200 por fora e apontar o UptimeRobot. Volta: `cat <backup>/Caddyfile > docker/Caddyfile` + `docker exec painel_koji-proxy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.

## [2026-10-11 12:49] — CFG1-a no painel: tela "Comportamento do agente"
- **Autor:** Claude Opus 5.5
- **Objetivo:** Implementar a tela de `docs/ESPEC_TELAS_CFG1.md` sobre o contrato `gateway/docs/ESPEC_CFG1.md` §13.
- **Arquivos alterados:**
  - `src/lib/gateway/atendimento.ts` — criado — schema de entrada, tipos do contrato, rótulos, origem/Personalizado por campo, corpo do rascunho, trechos
  - `src/lib/gateway/atendimento.server.ts` — criado — ler, salvar, descartar, publicar, versões, restaurar, prévia; tradução de erros
  - `src/lib/gateway-atendimento.functions.ts` — criado — função de servidor
  - `src/lib/gateway/modulo.server.ts` — modificado — `regrasAtendimento` (empresa e agente)
  - `src/components/luxtia/comportamento/{ComportamentoAgente,CampoAtendimento,HistoricoVersoes,PreviaAtendimento}.tsx` — criados
  - `src/routes/_authenticated/ia/configuracoes.comportamento.tsx`, `src/routeTree.gen.ts`, `src/lib/nav.ts` — criado/modificados — rota e menu
  - `src/lib/gateway/atendimento.test.ts` — criado; `modulo.test.ts` — modificado
  - `instrucoes.md`, `README.md` — modificados
- **Resumo das mudanças:** Escopo empresa ou agente. Abas Personalidade, Comportamentos (com Operação só leitura), Publicar, Prévia e Histórico. Cada campo mostra o valor em uso, a origem, "Personalizado" e "Voltar ao padrão" (null). Barra fixa de rascunho; publicação com nota, bloqueios e avisos; histórico com antes/depois e Restaurar com confirmação; atalho "Testar no Simular".
- **Decisões e justificativas:** Tipo, limites, opções e `editavel`/`disponivel` vêm só do esquema; no painel ficam apenas os textos (rótulo desconhecido vira a chave legível). Membro é barrado nas escritas antes de chamar o gateway, e o gateway também recusa. Rascunho desatualizado é rebaseado com PUT só de `baseado_em`. O Simular testa o publicado; a tela avisa isso. Nome do segmento por mapa local, porque não há rota global para empresa.
- **Comandos executados:** ESLint → OK; `bun test` → 99 OK, 6 ignorados, 0 falhas; `tsc --noEmit` → OK; build + `up -d --no-deps painel` → OK; `verificar-chave-no-bundle.sh` → OK; rotas 200 e `/gateway/admin/v1/tenants` 404; logs sem segredos; leitura no gateway real como membro (atendimento empresa e agente, versões, prévia) → 200, `pode_editar` false
- **Erros e resoluções:** `tsc` TS2322 em `situacaoCampo` (`valor` podia ser `undefined`) → `?? null` no valor final. TS2345 na rota nova → entrada adicionada em `routeTree.gen.ts`, como no Pedidos. A primeira leitura de conferência deu 404 porque o script repetia `/admin/v1` (já faz parte de `GATEWAY_ADMIN_URL`). Nela foi mandado um PUT como membro, que voltou 404 sem gravar nada; a segunda leitura foi só GET e prévia.
- **Pendências / TODO:** escritas (rascunho, publicar, restaurar) não exercitadas em produção, só nos testes; conferência visual autenticada como admin pelo Marco; atalho na aba do agente não feito.
- **Próximos passos:** validação do Marco; volta: `docker tag painel:ped1c-20261011 painel_koji-painel` + `docker compose up -d --no-deps --no-build painel`.

## [2026-10-11 12:32] — PED1-c no painel: nome de exibição, estado único, filtros e "Editar nome"
- **Autor:** Claude Opus 5.5
- **Objetivo:** Usar o contrato PED1-c (`gateway/docs/ESPEC_PED1.md` §14) em Conversas e Pedidos e permitir editar o nome de cadastro do contato.
- **Arquivos alterados:**
  - `src/lib/gateway/conversas.ts` — modificado — tipos PED1-c (`nome_exibicao`, `nome_origem`, `nomes`, `canal_info`, `estado`, `ultima`, `unidade_preferida(_nome)`, `pedido_aberto`, `ContatoPainel`); `estadoConversa` prefere o estado do gateway; selo de origem; `resumoUltima` (autor e tipo); `canalDaConversa`; `validarNomeCadastro` (mesma regra do gateway) e `nomeSemCadastro`; `ordenarConversas` com opção de manter a ordem do servidor
  - `src/lib/gateway-conversas.functions.ts` — modificado — `estado` (lista) e `ordem` em `listarConversas`; nova `editarNomeContato` (conversa visível + contato da própria conversa, PATCH só `{nome}`, motivos traduzidos, 409 anonimizado)
  - `src/lib/gateway/modulo.server.ts` — modificado — regra `PATCH contatos/*` para admin e membro, corpo só com `nome` (texto ou null)
  - `src/lib/gateway/pedidos.server.ts`, `src/lib/gateway/pedidos.ts` — modificados — nome atual da conversa juntado ao pedido (lista e detalhe) e `nomeClientePedido`
  - `src/components/luxtia/Conversas.tsx` — modificado — filtros Estado (inclui Encerrada) e Ordenar; busca pelos três nomes; selos de origem e "teste"; última com autor/tipo; unidade preferida; atalho do pedido aberto; "Editar nome" no cabeçalho
  - `src/components/luxtia/Pedidos.tsx`, `src/routes/_authenticated/ia/pedidos.tsx` — modificados — mesmo nome no cartão, na lista e no detalhe; `?pedido=` abre o detalhe
  - `src/lib/gateway/{conversas,pedidos,modulo}.test.ts` — modificados — testes PED1-c
- **Resumo das mudanças:** Conversas mostram o nome de exibição com selo discreto (cadastro, informado, perfil, telefone), telefone formatado, canal do `canal_info` com selo "teste", estado único, última mensagem com autor e tipo, unidade preferida e o pedido aberto (atalho no cabeçalho). Filtro de estado e ordem por atividade recente (padrão). Qualquer papel edita o nome de cadastro; vazio apaga e volta ao próximo da prioridade. Pedidos exibem o mesmo nome da conversa.
- **Decisões e justificativas:** O gateway grava `cliente.nome` no fechamento e não atualiza; para mostrar o mesmo nome, o servidor do painel junta o `nome_exibicao` da conversa (uma leitura `ordem=recentes` em cache de 30 s por empresa, até 5 buscas pelo telefone para o que faltar; falha não quebra, fica o nome do pedido; cache limpo ao editar nome). A edição confere que o contato é o da conversa visível, para o ID não servir de atalho a contatos de agentes ocultos. "Só aguardando" virou a opção "Aguardando atendente" do filtro de estado (mesma fila global). Selo "telefone" em vez de esconder, para o atendente saber que falta nome.
- **Comandos executados:** `bun test` → 94 OK, 6 ignorados, 0 falhas; `tsc --noEmit` → OK; ESLint nos arquivos alterados → OK; `docker compose build painel` + `up -d --no-deps painel` → OK; `verificar-chave-no-bundle.sh` → OK; rotas públicas 200, `/gateway/admin/v1/tenants` 404; logs sem segredos; leitura de conferência no gateway real (campos PED1-c, `ordem=recentes`, `estado=encerrada`, estado inválido 400) → OK
- **Erros e resoluções:** `tsc` TS2379 em `editarNomeContato` (`mensagem: string | undefined` com `exactOptionalPropertyTypes`, índice de `MOTIVO_NOME`) → fallback "Nome inválido." e checagem antes do uso.
- **Pendências / TODO:** PATCH de nome não exercitado em produção (escrita; coberto por testes); conferência visual autenticada pelo Marco. Tela própria de Contatos não existe no painel (edição só no cabeçalho da conversa).
- **Próximos passos:** validação do Marco; volta: `docker tag painel:9afa7b3 painel_koji-painel` + `docker compose up -d --no-deps --no-build painel`.

## [2026-10-11 10:55] — Especificação da tela "Comportamento do agente" (CFG1)
- **Autor:** Claude Opus 5.5
- **Objetivo:** Especificar, sem implementar, as telas de Personalidade, Comportamentos, Base de conhecimento, Publicar e Histórico a partir de `gateway/docs/ESPEC_CFG1.md`.
- **Arquivos alterados:**
  - `docs/ESPEC_TELAS_CFG1.md` — criado — cinco telas, permissões, selos de origem, "em breve", motivos travados, bloqueio das regras da casa e 19 pendências do contrato
  - `instrucoes.md`, `README.md`, `docs/worklog.md` — modificados
- **Resumo das mudanças:** Página única com escopo empresa ou agente e cinco abas. Cada campo mostra "Padrão do segmento" ou "Personalizado", com "voltar ao padrão" (campo `null` no rascunho). Itens `disponivel=false` ficam desabilitados com selo "em breve". `pediu_humano` e `reclamacao` ficam ligados e travados. Regras da casa com contador de caracteres e de quebras de linha, bloqueio destacando o trecho e confirmação nos casos duvidosos.
- **Decisões e justificativas:** Nenhum campo ou rota inventado; o que falta virou pendência P1–P19. "Testar no Simular" avisa que testa a versão publicada (não existe simulação de rascunho) e fica desabilitado com envio real. Base de conhecimento só depois do CFG1-b, conforme a ordem do Marco. Piloto e operação continuam fora da versão.
- **Comandos executados:** leitura de `ESPEC_CFG1.md`, da aba Comportamento do agente, do Simular e das permissões → especificação escrita
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** aprovação do Marco; pendências P1–P19 dependem do gateway (CFG1-a ainda não implementado)
- **Próximos passos:** aguardar aprovação; implementar telas 1, 2, 4 e 5 só depois do CFG1-a publicado no gateway

## PED1-b — avisos de pedido (11/10/2026)

- Publicado `painel:6027ea7`: X-Role da sessão em todas as chamadas administrativas; Configurações → Avisos de pedido por status/modalidade, prévia e padrão; reenvio na linha do tempo com confirmação e tratamento de entrega incerta. Contador existente preservado.
- 87 testes aprovados, 6 integrações REST antigas ignoradas, zero falhas. TypeScript, lint, builds e bundle aprovados. Validação autenticada: 12 avisos, prévia e contagem; zero escritas/envios em produção.
- Imagem de volta `painel:54188e4` conferida antes do build. Backup validado em `/home/twadmin/backups/painel/pre-ped1b-20261011T030002Z`, permissões 700/600. Só painel recriado; zero segredos nos logs, gateway intocado, nenhum prune.
- Relatório completo, volta e conferência visual: `docs/VALIDACAO_PED1B_PAINEL.md`. Alterações locais anteriores preservadas separadamente no commit `54188e4`. Parar para validação do Marco; PED1-c não iniciado.

## [2026-10-10 22:50] — Pedidos: layout mais compacto e moderno
- **Autor:** Grok 4.7
- **Objetivo:** Deixar a tela de Pedidos mais compacta, moderna e intuitiva, com menos espaço vazio.
- **Arquivos alterados:**
  - `src/components/luxtia/Pedidos.tsx` — modificado — indicadores clicáveis, barra única, filtros recolhíveis, colunas com rolagem, cartões densos, lista em tabela, detalhe em painel lateral
  - `instrucoes.md`, `README.md` — modificados
- **Resumo das mudanças:** Contagem virou cinco indicadores que levam à coluna. Busca, Quadro/Lista, Filtros (com número de ativos e fichas removíveis) e som ficam numa linha. Cartão com cor por status, tempo de espera, canal, entrega/retirada, itens, aviso e total. Detalhe em painel lateral com ações fixas no rodapé e atalhos de previsão (20/30/45/60 min).
- **Decisões e justificativas:** Nenhuma regra ou chamada mudou; as ações continuam saindo de `proximos_status`. O destaque de espera (borda dourada e tempo em vermelho a partir de 15 min) é só visual. Os números das colunas contam o que foi carregado (“+” se há mais), porque a contagem do gateway ignora filtros.
- **Comandos executados:** `bun test` → 81 aprovados, 6 ignorados; `tsc` e ESLint → OK; build, verificação da chave, recriação só do painel → OK; rotas públicas 200 e admin do gateway 404; segredos nos logs: zero
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** conferência visual autenticada, inclusive no celular
- **Próximos passos:** Marco revisar o layout logado

## [2026-10-10 22:41] — Tela de Pedidos (PED1-a)
- **Autor:** Grok 4.7
- **Objetivo:** Publicar a tela de Pedidos só com o contrato PED1-a já em produção.
- **Arquivos alterados:**
  - `src/lib/gateway/pedidos.ts` — criado — status, ações, avisos e validação
  - `src/lib/gateway/pedidos.server.ts` — criado — lista, contagem, detalhe e mudança de status
  - `src/lib/gateway/pedidos.test.ts` — criado — 409, cancelamento, isolamento e atendente
  - `src/lib/gateway-pedidos.functions.ts` — criado — função de servidor
  - `src/components/luxtia/Pedidos.tsx` — criado — quadro, lista, detalhe e ações
  - `src/components/luxtia/ContadorPedidos.tsx` — criado — contador e som
  - `src/lib/pedidos-som.ts` — criado — preferência local do som
  - `src/routes/_authenticated/ia/pedidos.tsx` — criado — rota do menu
  - `src/lib/nav.ts`, `src/components/luxtia/AppShell.tsx`, `src/lib/gateway/modulo.server.ts`, `src/lib/gateway/modulo.test.ts` — modificados — menu e permissão
  - `src/components/luxtia/Conversas.tsx`, `src/routes/_authenticated/ia/conversas.tsx` — modificados — atalho da conversa
  - `src/routeTree.gen.ts`, `docs/ESPEC_TELAS_PEDIDOS.md`, `instrucoes.md`, `README.md` — modificados
- **Resumo das mudanças:** O quadro e a lista leem os pedidos da empresa. O detalhe mostra itens, entrega, cliente, aviso e linha do tempo. As ações usam só `proximos_status`. O 409 recarrega o pedido e avisa que ele já foi atualizado.
- **Decisões e justificativas:** Textos de aviso, reenvio, `X-Role`, nome por prioridade e filtro de encerradas ficam de fora. O motivo da recusa continua opcional; o do cancelamento exige 3 caracteres antes da chamada. O som começa desligado.
- **Comandos executados:** `bun test` → 81 aprovados, 6 ignorados; `tsc` e ESLint → OK; verificação da chave → OK; recriação só do painel → OK; rotas públicas 200 e admin do gateway 404
- **Erros e resoluções:** O ator da sessão é o e-mail do perfil, não o id; o teste passou a esperar esse e-mail. `exactOptionalPropertyTypes` recusou filtro com `undefined`; o objeto só inclui o que foi preenchido.
- **Pendências / TODO:** conferência visual autenticada; PED1-b, PED1-c e pagamento G4
- **Próximos passos:** Marco revisar Pedidos logado, inclusive o celular e o som

## [2026-10-10 22:11] — Conversas: estado, canal e telefone
- **Autor:** Grok 4.7
- **Objetivo:** Corrigir a lista e o cabeçalho de Conversas com os campos que o gateway já devolve.
- **Arquivos alterados:**
  - `src/lib/gateway/conversas.ts` — modificado — estado, telefone legível, rótulo do canal e nome de exibição
  - `src/lib/gateway/conversas.test.ts` — modificado — cobre a ordem do estado e a máscara
  - `src/components/luxtia/Conversas.tsx` — modificado — lista e cabeçalho
  - `docs/ESPEC_TELAS_PEDIDOS.md`, `instrucoes.md`, `README.md` — modificados
- **Resumo das mudanças:** Cada conversa mostra Encerrada, Aguardando atendente, Atendente ou Bot, o tipo do canal com o nome cadastrado e o celular no formato +55 11 9xxxx-xxxx. O nome continua o campo atual.
- **Decisões e justificativas:** Pedidos e os campos do PED1-c ficam de fora até o contrato ser publicado. O filtro de encerrada não foi inventado. `nome_exibicao` e `telefone_formatado`, se um dia vierem, passam na frente.
- **Comandos executados:** `bun test` → 76 aprovados, 6 ignorados; `tsc --noEmit` → OK; build e verificação da chave → OK; recriação só do painel → OK; rotas públicas 200 e admin do gateway 404
- **Erros e resoluções:** TypeScript recusou `canal={undefined}` com `exactOptionalPropertyTypes`; a prop passou a aceitar `undefined` explicitamente
- **Pendências / TODO:** conferência visual autenticada; Pedidos, avisos e nome por prioridade esperam o PED1
- **Próximos passos:** Marco revisar Conversas logado; Pedidos só depois do contrato publicado

## [2026-10-10 22:04] — Especificação de pedidos e conversas
- **Autor:** Grok 4.7
- **Objetivo:** Levantar Pedidos e o defeito de Conversas e escrever a especificação, sem implementar.
- **Arquivos alterados:**
  - `docs/ESPEC_TELAS_PEDIDOS.md` — criado — telas, pendências do PED1 e o que Conversas já pode corrigir
  - `docs/ESPEC_TELAS_GESTAO.md` — modificado — a tela 8 aponta para a especificação nova
  - `instrucoes.md`, `README.md` — modificados
- **Resumo das mudanças:** A lista de conversas lê `nome`, `telefone` e ignora canal e encerramento. Nome, unidade preferida e os status novos de pedido dependem do PED1, que ainda não está publicado.
- **Decisões e justificativas:** Nada de rota ou campo inventado. Pagamento e troco continuam no G4. A correção parcial de Conversas fica separada da tela de Pedidos.
- **Comandos executados:** leitura de `ESPEC_PED1.md`, `API_ADMIN.md` e da tela de Conversas → especificação escrita
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** aprovação desta especificação; horário do pedido na lista não está no contrato; motivo da recusa opcional no PED1
- **Próximos passos:** esperar o Marco aprovar antes de implementar

## [2026-10-10 19:27] — Operação do dia nas unidades
- **Autor:** Grok 4.7
- **Objetivo:** Visão Hoje, pausa rápida, aplicação em várias unidades, feriados, cópia de grade, alertas e período do histórico no fuso da empresa, sem rota nova no gateway.
- **Arquivos alterados:**
  - `src/lib/gateway/gestao.ts` — modificado — prazos, feriados, alertas, cópia e ações de lote
  - `src/lib/gateway/gestao.server.ts` — modificado — fuso projetado e uma chamada por unidade
  - `src/lib/gateway/gestao.test.ts` — modificado — atendente, lote e feriados
  - `src/lib/gateway/modulo.server.ts` — modificado — admin pode ler a raiz do tenant
  - `src/lib/gateway/modulo.test.ts` — modificado — leitura da raiz para admin e recusa para atendente
  - `src/components/luxtia/GestaoOperacao.tsx` — criado — Hoje, seleção e feriados
  - `src/components/luxtia/gestao-base.tsx` — criado — hook e pausa rápida
  - `src/components/luxtia/GestaoUnidades.tsx` — modificado — alertas, atalhos e cópia de grade
  - `src/components/luxtia/HistoricoGestao.tsx` — modificado — período no fuso da empresa
  - `instrucoes.md`, `README.md`, `docs/ESPEC_TELAS_GESTAO.md` — modificados
- **Resumo das mudanças:** O topo mostra situação, pausas e exceções de sete dias. A pausa rápida vale para o atendente. Lote e feriados só existem para admin/plataforma e não repetem sucesso. A grade copiada fica no rascunho até salvar. O histórico usa o timezone do tenant.
- **Decisões e justificativas:** O campo `timezone` já existe no tenant, então não há pendência de contrato. Brasília só entra se o valor vier ausente ou inválido, com aviso na tela. A leitura da raiz devolve ao navegador apenas o fuso.
- **Comandos executados:** `bun test` → 75 aprovados, 6 ignorados; `tsc --noEmit` → OK; eslint → 0 erros, avisos Fast Refresh; build e verificação da chave → OK; recriação só do painel → OK; rotas públicas 200 e admin do gateway 404
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** conferência visual autenticada; fallback de Brasília só se o fuso do tenant não vier válido
- **Próximos passos:** Marco revisar Hoje, pausa rápida, lote e feriados numa empresa de teste, sem alterar unidades reais

## [2026-10-10 21:50] — Uso de unidades e histórico
- **Autor:** Grok 4.7
- **Objetivo:** Deixar Unidades e horários e Histórico de gestão mais diretos, com menos cliques para achar cada função.
- **Arquivos alterados:**
  - `src/components/luxtia/GestaoUnidades.tsx` — modificado — lista com ações visíveis, detalhe ao lado e grade/exceção mais curtas
  - `src/components/luxtia/HistoricoGestao.tsx` — modificado — filtro por nome e período; resumo da alteração sem abrir o detalhe
  - `src/routes/_authenticated/ia/unidades.tsx` — modificado — unidade e seção no endereço
  - `src/routes/_authenticated/ia/gestao.alteracoes.tsx` — modificado — unidade no endereço
  - `src/lib/gateway/gestao.ts` — modificado — período com fuso de Brasília e filtros publicados
  - `src/lib/gateway/gestao.server.ts` — modificado — envia `unidade_id`, `desde` e `ate`; recusa a combinação proibida
  - `src/lib/gateway/gestao.test.ts` — modificado — cobre o período e a combinação
  - `instrucoes.md`, `README.md`, `docs/ESPEC_TELAS_GESTAO.md`, `docs/VALIDACAO_G1_PAINEL.md` — modificados
- **Resumo das mudanças:** Agenda, horários e exceções abrem no primeiro clique. A grade mostra a semana resumida. O histórico escolhe a unidade pelo nome e inclui as exceções dela.
- **Decisões e justificativas:** Os filtros `unidade_id`, `desde` e `ate` já estão no contrato publicado. O identificador exato não vai junto com a unidade. A data da linha continua com o offset recebido; só o filtro usa Brasília.
- **Comandos executados:** `bun test` → 73 aprovados, 6 ignorados; `tsc --noEmit` → OK; eslint → 0 erros, 1 aviso Fast Refresh já existente; build e verificação da chave → OK; recriação só do painel → OK; rotas públicas 200 e admin do gateway 404
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** conferência visual autenticada; a sessão de revisão caiu na tela de acesso
- **Próximos passos:** Marco revisar pausa, grade, exceção e o filtro de histórico numa unidade real, só em leitura se não houver unidade de teste

Entradas anteriores (até 10/10/2026) estão em `docs/worklog-arquivo/2026-10.md`.
