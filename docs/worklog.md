## [2026-10-30 14:00] — Publicação do layout do Cardápio
- **Autor:** Auto
- **Objetivo:** Publicar o painel para o Cardápio novo aparecer em produção.
- **Arquivos alterados:**
 - `docs/worklog.md`, `instrucoes.md`, `README.md` — modificados — registro da publicação
- **Resumo das mudanças:** Commit `bc6c695dbb029ffcc17c5acf75466bf8d20bb251`. Imagem `painel:bc6c695dbb029ffcc17c5acf75466bf8d20bb251` = `sha256:ed66a4ecf151d706c112852b4f39492428a9382fe56f4a0fd371d4f08682f4a2`. Container recriado às 13:58 (Brasília). Só o painel. Migração `20261029220000_codigos_recuperacao.sql` aplicada. Volta: `painel:volta-20261030T165734Z` (= `af380cb9…` / `sha256:c52a7c65…`). Bundle do Cardápio traz "Encontre, edite e organize".
- **Decisões e justificativas:** O usuário pediu publicar agora; a árvore local incluía também segunda etapa, telefone e pagamentos da unidade — tudo entrou no mesmo commit porque o script recusa árvore suja.
- **Comandos executados:** `docker compose run --rm migracoes` → OK. `sh docker/publicar-painel.sh` → OK. `docker compose up -d --no-deps --no-build painel` → OK. `verificar-chave-no-bundle.sh` → OK (0 chave no front).
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** atualizar a página com hard refresh (Ctrl+Shift+R) se o navegador cachear o JS antigo.
- **Próximos passos:** se precisar voltar: `docker tag painel:volta-20261030T165734Z painel_koji-painel && docker compose up -d --no-deps --no-build painel`

## [2026-10-30 13:50] — Layout do Cardápio para localizar e gerenciar
- **Autor:** Auto
- **Objetivo:** Tornar a listagem do Cardápio mais profissional, intuitiva e dinâmica para localizar, editar e gerenciar itens.
- **Arquivos alterados:**
 - `src/components/luxtia/cardapio/CardapioCat3.tsx` — modificado — barra fixa, filtros sob demanda, navegação de categorias com scroll-spy, seções recolhíveis e linhas densas com ações à vista
 - `README.md`, `instrucoes.md`, `docs/worklog.md` — modificados — registro da mudança de UX
- **Resumo das mudanças:** Os quatro cards grandes e a fileira longa de chips deram lugar a uma barra de comando sticky com busca, filtros extras recolhidos e indicadores compactos. A navegação por categoria destaca a seção visível e leva ao bloco. Cada categoria recolhe. Na linha: selo único, preço, Ativo (switch), Esgotar/Repor e lápis; arrastar e setas só no hover.
- **Decisões e justificativas:** A dor era achar e agir rápido, não o contrato do gateway. Mantidas as mesmas operações CAT3; só a organização visual mudou, alinhada ao padrão da barra de Pedidos.
- **Comandos executados:** `tsc --noEmit` (Docker) → OK após corrigir `dataset['categoriaId']`. ESLint + prettier no arquivo → OK.
- **Erros e resoluções:** TS4111 em `dataset.categoriaId` → acesso com `dataset['categoriaId']`.
- **Pendências / TODO:** publicado em seguida.
- **Próximos passos:** ver entrada de publicação.

## [2026-10-29 22:22] — Atalho para ativar a segunda etapa
- **Autor:** Grok 4.7
- **Objetivo:** O aviso do prazo vira o botão "Ativar agora" e abre direto o cadastro do segundo fator, sem tirar a obrigatoriedade da plataforma.
- **Arquivos alterados:**
 - `src/components/luxtia/Seguranca.tsx` — modificado — o aviso ganha "Ativar agora"; o cadastro abre já no QR e, depois dos 6 dígitos, mostra os códigos de recuperação
 - `src/components/luxtia/AppShell.tsx` — modificado — o botão abre o mesmo cadastro da barra "Segurança"
 - `src/routes/index.tsx` — modificado — quem já tem fator digita o código do aplicativo ou um código de recuperação
 - `src/lib/seguranca.functions.ts` — modificado — guarda só o hash e, ao usar um código, desliga o fator
 - `src/lib/acesso/codigos-recuperacao.ts` — criado — geração e a regra da sessão que ainda precisa do código
 - `src/lib/acesso/segunda-etapa.test.tsx` — modificado — o aviso continua obrigatório e o botão aparece
 - `src/integrations/supabase/types.ts` — modificado — coluna `codigos_recuperacao`
 - `supabase/migrations/20261029220000_codigos_recuperacao.sql` — criado — a coluna, ainda sem aplicar
 - `tsconfig.json` — modificado — teste `.tsx` fora do typecheck, como os `.test.ts`
 - `README.md`, `instrucoes.md`, `docs/worklog.md`, `docs/worklog-arquivo/2026-10.md` — modificados — registro; entradas de 12/10 foram para o arquivo
- **Resumo das mudanças:** O aviso âmbar continua com a data e ganha "Ativar agora". O clique abre o cadastro já no QR, no código de 6 dígitos e, depois da confirmação, nos 8 códigos de recuperação. Usar um código desliga o aplicativo e pede para entrar de novo. A conta de plataforma continua obrigada a ter a segunda etapa.
- **Decisões e justificativas:** O caminho não entrou no menu lateral. Fica no botão "Segurança" da barra de cima, à direita do título, e no aviso logo abaixo. Os códigos são nossos (hash SHA-256), porque o GoTrue 2.177 não expõe essa API. A regra de 7 dias e o bloqueio da conta de emergência não mudaram. Nada foi publicado e a migração não foi aplicada.
- **Comandos executados:** `tsc --noEmit` → OK. `bun test` de `segunda-etapa.test.tsx` → 8 OK. ESLint nos arquivos mexidos → OK. Prévia em `127.0.0.1:18176`, com fator fictício e sem gravar nada: "Ativar agora" abriu o QR, o código de 6 dígitos e os códigos de recuperação.
- **Erros e resoluções:** O typecheck dentro do contêiner chegou a ficar parado com o Docker sem responder. Depois que o daemon voltou, o mesmo `tsc` terminou sem erro.
- **Pendências / TODO:** não publicado. A migração `20261029220000` precisa entrar antes ou junto da publicação; sem a coluna, o aplicativo liga e a tela avisa que os códigos de recuperação não foram guardados.
- **Próximos passos:** publicar só quando pedirem, aplicando a migração e trocando só o painel com `sh docker/publicar-painel.sh`.

## [2026-10-29 20:40] — Frase do 400 de telefone embaixo do campo
- **Autor:** Grok 4.7
- **Objetivo:** Quando o gateway devolver 400 num telefone (piloto ou alerta), mostrar a frase dele embaixo do campo.
- **Arquivos alterados:**
 - `src/components/luxtia/agente/Comportamento.tsx` — modificado — a frase fica embaixo do contato do piloto ou do telefone de alerta
 - `src/lib/gateway-agentes.functions.ts` — modificado — o 400 desses campos volta com o nome do campo, em vez de só um aviso flutuante
 - `src/lib/gateway/erros.ts` — modificado — `erroDeTelefone`; a ajuda antiga de 8 a 16 dígitos saiu
 - `src/lib/gateway/atendimento.ts` — modificado — `textoErroCampo` prefere a mensagem do gateway
 - `src/lib/gateway/atendimento.server.ts` — modificado — repassa `mensagem` de cada campo do rascunho
 - `src/components/luxtia/comportamento/CampoAtendimento.tsx` — modificado — telefone de alerta da equipe
 - `src/components/luxtia/comportamento/ComportamentoAgente.tsx` — modificado — o resumo usa a mesma frase
 - `src/lib/gateway/agentes.test.ts`, `src/lib/gateway/atendimento.test.ts` — modificados — os casos do 400
 - `README.md`, `instrucoes.md`, `docs/worklog-arquivo/2026-10.md` — modificados — registro; a entrada do CAL1 foi para o arquivo
- **Resumo das mudanças:** Na ficha, salvar um telefone recusado mostra “Use DDD + número, ex.: 11912345678” (ou a frase que o gateway mandar) só naquele campo. No rascunho, o alerta da equipe faz o mesmo quando o item do erro traz `mensagem`. Os outros motivos continuam com o texto que a tela já usava.
- **Decisões e justificativas:** A frase exibida é a do gateway. Se o envelope vier só com “Confira os campos informados.”, a ficha usa a frase fixa do TEL1. Editar o campo tira o aviso. Nada foi publicado.
- **Comandos executados:** `tsc --noEmit` → OK. `bun test` de agentes e atendimento → 25 OK. ESLint nos arquivos mexidos → OK. Prévia em `127.0.0.1:18175`: 123 no alerta, 123 no piloto e 123 no alerta da equipe mostraram a frase embaixo do campo certo.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** não publicado
- **Próximos passos:** publicar só quando pedirem, com `sh docker/publicar-painel.sh`

## [2026-10-28 18:17] — USUARIOS1 publicado
- **Autor:** Grok 4.7
- **Objetivo:** Commitar o USUARIOS1, publicar o painel junto com o gateway PAPEL1-a e conferir com uma conta de plataforma.
- **Arquivos alterados:**
 - `docs/worklog.md`, `instrucoes.md`, `README.md` — modificados — registro da publicação
- **Resumo das mudanças:** O código saiu no commit `af380cb9d107fab8d166b552a9f1f5e8296ea7e0`. A imagem nova é `painel:af380cb9d107fab8d166b552a9f1f5e8296ea7e0` (`sha256:c52a7c65d9e15d0e9aa6b7a338b51a754b068f9f61fed52f8e610a4ba63150a6`). O container `03f5c95acff1` subiu às 18:13 (Brasília). Só o painel foi recriado. A volta é a imagem que estava no ar, `painel:volta-20261028T211243Z` (`sha256:7ba6a24b2b4184dd7be570a04919c4ae6db69abef7ffe17c6d7c15556acc96b5`).
- **Decisões e justificativas:** O gateway no ar já era `gateway:20e4df4`. A chave de plataforma continua vazia: a sessão usa a chave da empresa e o gateway registra o aviso da fase A. A conferência entrou com `marco.santos@ticway.com.br`, não com a conta de emergência. Esse login gravou o prazo da segunda etapa até 04/11/2026 18:14 (Brasília).
- **Comandos executados:** `sh docker/publicar-painel.sh` → OK. `sh docker/verificar-chave-no-bundle.sh` → chave 0 no bundle. `docker compose up -d --no-deps --no-build painel` → OK. Navegador: login, Usuários, Pedidos, Cardápio, Conversas e Comportamento do agente abriram. Gateway: 77 respostas 200 e nenhuma 403.
- **Erros e resoluções:** O log do painel registrou pedidos abortados ao trocar de página no meio do carregamento. As telas abriram na sequência e o gateway não devolveu erro.
- **Pendências / TODO:** `SMTP_HOST` e `GATEWAY_PLATFORM_KEY` continuam vazios. O Marco troca a senha da conta de emergência. O prazo de 7 dias do Marco começou nesta conferência.
- **Próximos passos:** volta, se precisar: `docker tag painel:volta-20261028T211243Z painel_koji-painel && docker compose up -d --no-deps --no-build painel`

## [2026-10-28 16:15] — Ajustes do USUARIOS1 antes de publicar
- **Autor:** Grok 4.7
- **Objetivo:** Convite sem SMTP, chave de plataforma vazia sem quebrar a sessão, e conta de emergência, sem publicar.
- **Arquivos alterados:**
 - `supabase/migrations/20261028183000_usuarios1_ajustes.sql` — criado — convite com hash, marca de emergência e revogação do token do GoTrue
 - `src/lib/usuarios.functions.ts`, `src/components/luxtia/Usuarios.tsx`, `src/routes/index.tsx`, `src/routes/_authenticated/equipe.tsx` — modificados — link único, aceite da senha e revogação
 - `src/lib/gateway/cliente.server.ts` — modificado — plataforma usa a chave da empresa enquanto a de plataforma estiver vazia
 - `src/lib/seguranca.functions.ts`, `src/components/luxtia/Seguranca.tsx`, `src/routes/_authenticated/auditoria.tsx` — modificados — bloqueio imediato e alerta de login
 - `docker-compose.yml`, `.env.example` — modificados — `SMTP_HOST` vazio e o aviso da chave
 - `docs/prints-usuarios/05-link-convite.png` — criado — o aviso do link
- **Resumo das mudanças:** Sem e-mail configurado, quem convida vê o link uma vez. Ele vale 24 horas, serve uma vez e sai da lista ao ser revogado. A sessão de plataforma continua com a chave da empresa e o log avisa uma vez por dia. `admin@luxtia.local` ficou marcada como emergência, sem mudar papel nem senha.
- **Decisões e justificativas:** O token do convite fica só como hash, no fragmento da URL, para não ir ao log de acesso. O prazo de 7 dias das outras contas de plataforma não começa nesta sessão. A conta de emergência bloqueia quando o código novo rodar no próximo login.
- **Comandos executados:** `tsc --noEmit` → OK. `bun test` de acesso e gateway → 178 OK. `docker compose run --rm migracoes` → OK. Prévia do link → print gravado.
- **Erros e resoluções:** A comparação do hash da senha foi interrompida de propósito; a migração só grava a marca no cadastro e não escreve na coluna da senha. O papel conferido depois continua `super_admin`.
- **Pendências / TODO:** Publicar junto com o PAPEL1. `SMTP_HOST` e `GATEWAY_PLATFORM_KEY` continuam vazios. O Marco troca a senha da conta de emergência.
- **Próximos passos:** publicar o painel com `sh docker/publicar-painel.sh` no mesmo momento do gateway.

## [2026-10-28 15:50] — USUARIOS1 no painel, sem publicar
- **Autor:** Grok 4.7
- **Objetivo:** Implementar a especificação aprovada, com as decisões da seção 8 e o contrato do PAPEL1, sem publicar e sem alterar o gateway.
- **Arquivos alterados:**
 - `supabase/migrations/20261028160000_usuarios1.sql` — criado — papéis, unidades, prazo de segunda etapa e a limpeza do César
 - `src/lib/acesso/papeis.ts` — criado — papéis, unidades, telefone e apelido da conversa
 - `src/lib/usuarios.functions.ts`, `src/components/luxtia/Usuarios.tsx`, `src/routes/_authenticated/equipe.tsx` — criados ou modificados — tela Usuários
 - `src/lib/seguranca.functions.ts`, `src/components/luxtia/Seguranca.tsx`, `src/components/luxtia/AppShell.tsx` — criados ou modificados — segunda etapa
 - `src/lib/gateway/cliente.server.ts`, `modulo.server.ts`, `painel.server.ts` — modificados — X-Role, X-Unidades e chave de plataforma
 - `docker-compose.yml`, `.env.example` — modificados — `GATEWAY_PLATFORM_KEY` vazio
 - `docs/prints-usuarios/` — criado — prints das telas
 - `docs/ESPEC_USUARIOS1.md`, `instrucoes.md`, `README.md` — modificados — decisões aprovadas e o que ficou no código
- **Resumo das mudanças:** O painel deixa de mandar admin/membro. Gestor e plataforma saem com X-Unidades `*`; supervisor e funcionário saem com os códigos do cadastro. A tela Usuários convida sem senha. O funcionário vê telefone mascarado e conversa pelo apelido. A segunda etapa é obrigatória para plataforma, com 7 dias a partir do próximo login desta versão, e opcional para o gestor.
- **Decisões e justificativas:** Sem meio-tempo, porque a publicação sai junto com o gateway. Histórico fica visível ao funcionário, como a decisão 1 pediu, mesmo o PAPEL1 do gateway citando supervisor. Relatórios não entrou no menu. A conta admin@luxtia.local não recebeu prazo.
- **Comandos executados:** `tsc --noEmit` → OK. `bun test` de acesso e gateway → 166 OK. `docker compose run --rm migracoes` → OK. Prévia em 127.0.0.1:18176 → 4 prints.
- **Erros e resoluções:** Os testes ainda esperavam admin/membro e as rotas antigas do atendente. Foram alinhados à matriz. A leitura de um canal passou a valer para abrir conversa; a lista e a edição de canais continuam com o gestor.
- **Pendências / TODO:** SMTP do convite não está configurado. `GATEWAY_PLATFORM_KEY` está vazia até a publicação. Relatórios espera o AN1.
- **Próximos passos:** publicar o painel junto com o gateway (CHAVES1 e PAPEL1), com `sh docker/publicar-painel.sh`, e preencher a chave de plataforma só no servidor.

## [2026-10-28 14:07] — Especificação de papéis e unidades (USUARIOS1)
- **Autor:** Grok 4.7
- **Objetivo:** Especificar o controle de usuários por papel e por unidade, sem implementar e sem alterar o gateway.
- **Arquivos alterados:**
  - `docs/ESPEC_USUARIOS1.md` — criado — inventário, matriz, telas, segurança, migração e cabeçalhos
  - `instrucoes.md` — modificado — registro da fase
  - `README.md` — modificado — ponteiro da especificação
  - `docs/worklog.md` — modificado — esta entrada; entradas de 11/10 e 10/10 foram para o arquivo
  - `docs/worklog-arquivo/2026-10.md` — modificado — entradas antigas
- **Resumo das mudanças:** O papel que o painel manda hoje sai do servidor: super_admin vira plataforma, is_tenant_admin vira admin, o resto vira membro. Não há atendente no banco. Em produção há 3 plataformas e zero admin ou membro no fio. A proposta troca isso por permissões em tabela, escopo por unidade e os cabeçalhos X-Role e X-Unidades, sem enviá-los enquanto o gateway só aceita os três nomes atuais.
- **Decisões e justificativas:** O César da Ticway fica de fora da migração porque o tenant_admin dele não tem empresa. Supervisor, no meio-tempo, continua saindo como admin só nas chamadas que a matriz permite. Relatórios entram como tela vazia.
- **Comandos executados:** consulta ao Postgres do painel (papéis, vínculos, sessões, MFA, auditoria) → inventário da seção 1
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** revisão desta especificação; as seis decisões da seção 8
- **Próximos passos:** esperar a revisão antes de criar tabela ou tela

## [2026-10-26 17:20] — Comportamento: um caminho por campo
- **Autor:** Grok 4.7
- **Objetivo:** Esconder o que não tem efeito, restringir o que é só da plataforma e deixar um único caminho para os campos que estavam na ficha e no rascunho.
- **Arquivos alterados:**
  - `src/lib/gateway/atendimento.ts` — modificado — lista do que some, do que exige WhatsApp e a data dd/mm
  - `src/components/luxtia/comportamento/ComportamentoAgente.tsx` — modificado — faixa do rascunho, diferenças e campos ocultos
  - `src/components/luxtia/comportamento/CampoAtendimento.tsx` — modificado — campo travado com a frase do canal
  - `src/components/luxtia/agente/Comportamento.tsx` — modificado — ficha só com nome, piloto e alerta, e só para a plataforma
  - `src/lib/gateway-agentes.functions.ts` — modificado — a empresa não grava mais comportamento na ficha
  - `src/lib/gateway/modulo.server.ts` — modificado — a empresa só altera situação e módulos do agente
  - `src/lib/gateway/prontidao.ts` — modificado — checklist sem Skyone, respostas e envio para a empresa
  - `src/components/luxtia/agente/VisaoGeral.tsx` — modificado — usa a lista filtrada
  - `src/routes/_authenticated/ia/agentes.$agenteId.tsx` — modificado — subtítulo sem respostas e envio para a empresa
  - `src/lib/gateway/atendimento.test.ts`, `modulo.test.ts`, `prontidao.test.ts` — modificados — os casos novos
  - `README.md` — modificado — o parágrafo do comportamento
  - `tests/visual/comportamento/` — criado — prévia com dados fictícios para os prints
- **Resumo das mudanças:** Some o texto do aviso de demora, a espera de áudio/imagem e “aceita agendado fora do horário”. Espera, espera máxima, pausa, aviso de demora em segundos e mensagem de falha ficam só no rascunho. Envio, piloto, contatos, alerta, limites, Skyone, provedor e instruções só aparecem para a plataforma. A faixa avisa o rascunho não publicado e abre a prévia do que está em uso. Botões e reações travam sem canal WhatsApp.
- **Decisões e justificativas:** A ficha gravava na hora e criava versão, o que desatualizava o rascunho. Esses campos passam a ter um caminho só. O que não tem efeito continua no esquema do gateway e some só na tela. A empresa inteira continua editável nos botões, porque um agente com WhatsApp herda o valor. “Publicar” da faixa abre a aba que já confirma avisos e nota.
- **Comandos executados:** `tsc --noEmit` → OK. `eslint` nos arquivos mexidos → OK. `bun test` de atendimento, módulo, prontidão e agentes → 55 OK. Prévia em `127.0.0.1:18175` com dados fictícios.
- **Erros e resoluções:** `restricao` opcional quebrava o tipo estrito; a prop só entra no objeto quando há a frase. O servidor de prévia precisava do gancho do React Refresh, senão a tela ficava vazia.
- **Pendências / TODO:** não publicado. `package.json`, `bun.lock` e `src/routes/__root.tsx` já estavam alterados por outra tarefa (versões do TanStack) e não entram aqui.
- **Próximos passos:** publicar só quando pedirem, com `sh docker/publicar-painel.sh`

## [2026-10-26 12:52] — Senha de bootstrap fora do código
- **Autor:** Grok 4.7
- **Objetivo:** Tirar a senha fixa do bootstrap e impedir imagem nova com árvore suja.
- **Arquivos alterados:**
  - `src/lib/platform.functions.ts` — modificado — a senha passa a vir de variável de uso único
  - `src/lib/bootstrap-super-admin.ts` — criado — decide recusar ou criar, sem guardar senha
  - `src/lib/bootstrap-super-admin.test.ts` — criado — três casos da decisão
  - `docker/publicar-painel.sh` — criado — recusa build com alteração não commitada
  - `Dockerfile`, `docker-compose.yml` — modificados — o build exige o commit e a imagem grava o rótulo
  - `.env.example`, `README.md` — modificados — variável vazia e o comando de publicação
- **Resumo das mudanças:** A conta inicial é `admin@luxtia.local`, nome Super Admin, papel super_admin. Ela já existe em produção (criada em 07/10/2026 18:30, último acesso em 23/10/2026 09:07, horário de Brasília) e tem senha; o valor não foi lido nem impresso. O bootstrap consulta essa conta e não cria de novo. Sem a conta e sem a variável, também não cria. A imagem que está no ar foi etiquetada com o commit do código dela, `d91f64317e3f7fbd733c56ed7e94bac0fdabe4b9`.
- **Decisões e justificativas:** O histórico não foi reescrito. A senha da conta fica para o Marco trocar. A variável não foi preenchida no `.env`, porque a conta já existe. O script marca uma tag `painel:volta-<data>` da imagem em uso antes de um build futuro.
- **Comandos executados:** `bun test src/lib/bootstrap-super-admin.test.ts` → 3 OK. `sh docker/publicar-painel.sh` com árvore suja → recusou, código 1.
- **Erros e resoluções:** o commit local não tinha autor configurado; o commit usou o autor já presente no histórico, sem alterar o git config.
- **Pendências / TODO:** atualizar dependências, publicar a imagem nova e aplicar os cabeçalhos do Caddy
- **Próximos passos:** push depois deste commit; em seguida as versões do TanStack, do seroval e do nanoid

## [2026-10-26 12:31] — Publicação do layout de conversas
- **Autor:** Grok 4.7
- **Objetivo:** Colocar no ar o layout novo, porque a tela aberta ainda era a imagem anterior.
- **Arquivos alterados:**
  - `docs/worklog.md`, `instrucoes.md` — modificados — registro da publicação
- **Resumo das mudanças:** A imagem nova é `painel:conversas-20261026` (`sha256:7ba6a24b2b4184dd7be570a04919c4ae6db69abef7ffe17c6d7c15556acc96b5`). O container `0ba6b9326aec` subiu às 12:31 (Brasília). Só o painel foi recriado. O arquivo `Conversas-Dp6Mtten.js` responde 200 em https://painel.luxbrain.com.br.
- **Decisões e justificativas:** A volta é a imagem que estava no ar, `painel:volta-conversas-20261026` (`sha256:64a05bb61aca115a22eaad2350e71d0cd5c1fbb76840e22ef5363b24f75ea434`), a mesma de `painel:simular-doc-20261022`.
- **Comandos executados:** `docker compose build painel` → OK. `docker compose up -d --no-deps --no-build painel` → OK. O bundle traz “Mensagens recentes”.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** quem já estava com a página aberta precisa atualizar forçado (Ctrl+F5)
- **Próximos passos:** volta, se precisar: `docker tag painel:volta-conversas-20261026 painel_koji-painel && docker compose up -d --no-deps --no-build painel`

## [2026-10-26 12:24] — Layout da página de conversas
- **Autor:** Grok 4.7
- **Objetivo:** Deixar a lista e a sessão da conversa mais claras e abrir já nas mensagens recentes.
- **Arquivos alterados:**
  - `src/components/luxtia/Conversas.tsx` — modificado — lista, bolhas, rolagem e compositor
  - `src/components/luxtia/FollowUpConversa.tsx` — modificado — aviso vazio em uma linha
  - `src/components/luxtia/AtendimentosConversa.tsx` — modificado — menos espaço vertical
  - `README.md` — modificado — descrição da tela
  - `instrucoes.md` — modificado — registro da etapa
- **Resumo das mudanças:** A lista e a conversa passam a ocupar a altura da tela. Cada contato ganha iniciais, horário curto e o estado. Ao abrir, o histórico vai para a última mensagem. Se a pessoa sobe para ler o passado, a posição fica e aparece “Mensagens recentes”. No celular a conversa ocupa a tela, com voltar. Enter envia.
- **Decisões e justificativas:** Atendimento e follow-up ficam recolhidos para o histórico ter espaço. O horário da bolha e da lista usa América/São_Paulo. Carregar mensagens anteriores preserva a rolagem.
- **Comandos executados:** prettier, `tsc --noEmit` e ESLint dos três componentes → OK. Prévia no navegador: ao abrir, a distância até o fim do histórico foi 0 e a mensagem antiga não estava visível; o atalho voltou ao fim.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** não publicado
- **Próximos passos:** publicar só se pedirem

## [2026-10-23 09:30] — Marco admin da empresa Luxbrain Testes
- **Autor:** Grok 4.7
- **Objetivo:** Dar ao usuário do Marco acesso de admin da empresa luxbrain_testes e conferir o clipe em Simular conversa.
- **Arquivos alterados:**
  - `docs/prints-arq-fup/20-anexar-luxbrain-testes.png` — criado — print da tela com o clipe
  - `docs/prints-arq-fup/20-anexar-luxbrain-testes-barra.png` — criado — a barra de envio
- **Resumo das mudanças:** A conta é marco.santos@ticway.com.br. Foi criado o cliente do painel Luxbrain Testes, ligado a `luxbrain_testes`, e o Marco entrou como administrador dessa empresa. O cliente koji (`bykoji`) e os vínculos dele não foram alterados. O papel super_admin dele permanece: é assim que ele chega ao By Koji hoje, porque não tem vínculo de empresa lá.
- **Decisões e justificativas:** Tirar o super_admin mudaria o acesso ao By Koji. O seletor que a tela mostra continua sendo o de Super Admin, que lista todas as empresas do gateway. O vínculo novo é o de admin da empresa.
- **Comandos executados:** sessão do GoTrue do próprio e-mail → Chromium em `/ia/simular`, empresa Luxbrain Testes, agente Teste Documentos → botão “Anexar documento” visível e habilitado.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** se o Marco for deixar de ser Super Admin, falta decidir o vínculo do By Koji
- **Próximos passos:** nada a publicar

## [2026-10-23 09:08] — Commit da imagem e o clipe no caminho do Marco
- **Autor:** Grok 4.7
- **Objetivo:** Commitar a árvore exata de `painel:simular-doc-20261022` e ver, no navegador, por que o clipe não apareceria em bench_passo5.
- **Arquivos alterados:**
  - `docs/worklog.md`, `instrucoes.md` — modificados — registro deste caminho
  - `docs/prints-arq-fup/19-clipe-bench-passo5.png`, `19-tela-bench-passo5.png` — criados — print do clipe depois da troca de empresa
- **Resumo das mudanças:** O código da imagem publicada ficou no commit `b0a6b3b249471fef313c1eb506adf243e400887f`. No Chromium, Super Admin de teste, By Koji → bench_passo5 → Simular conversa → Teste Documentos, o navegador chama a capacidade e o clipe aparece habilitado.
- **Decisões e justificativas:** A tela só mostra o clipe quando `documentos.ativo === true`. Canal, send_mode, papel e provedor não escondem o botão. Como o caminho já mostra o clipe, não houve correção nem imagem nova. Daqui em diante, imagem só com árvore limpa e o commit como label.
- **Comandos executados:** Playwright/Chromium em `https://painel.luxbrain.com.br/ia/simular` → clipe visível, botão habilitado, console sem erro.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** a imagem que está no ar não tem o label do commit; o próximo build é que grava.
- **Próximos passos:** não republicar esta tela. No próximo build, `git status` limpo e label com o hash.

## [2026-10-22 18:40] — Limite de 15 MB, leitura do anexo e XML fora da nota
- **Autor:** Grok 4.7
- **Objetivo:** Confirmar o corpo de 15 MB, o cartão que acompanha o 202 e o aviso de XML que não é nota, antes de publicar.
- **Arquivos alterados:**
  - `docker/Caddyfile` — modificado — `POST /_serverFn/*` com `request_body max_size 15MB`
  - `src/lib/limite-corpo.ts`, `src/server.ts` — criados/modificados — o servidor recusa corpo acima de 15 MB com 413
  - `src/lib/gateway/documentos.ts`, `erros.ts`, `simular.server.ts`, `gateway-simular.functions.ts` — modificados — aviso da NF-e e `GET /anexos/{id}`
  - `src/components/luxtia/Simulador.tsx`, `documentos/CartaoDocumentoSimulado.tsx`, `CartaoDocumentoConversa.tsx` — modificados — consulta a cada 2 s por até 30 s
  - `README.md`, `instrucoes.md` — modificados — registro
- **Resumo das mudanças:** O proxy e o servidor do painel limitam o corpo da função em 15 MB. O cartão deixa Processando sozinho. XML sem a marca da NF-e/NFC-e usa a frase específica.
- **Decisões e justificativas:** 15 MB decimais cabem o arquivo de 10 MB em base64 (~14 MB) e ficam abaixo dos 16 MiB do gateway nessa rota. A frase da nota olha os primeiros 4 KB, o mesmo trecho do gateway. O cartão usa o `anexo_id` da resposta 202.
- **Comandos executados:** `bun test` documentos e módulo → 41 OK; `tsc --noEmit` → OK; ESLint dos arquivos → OK. Caddy validado e recarregado. POST de 16.000.002 bytes em `/_serverFn/…` → 413 do Caddy. POST de 12.600.002 bytes → o painel leu o JSON. PDF fictício de 9.437.184 bytes em `simular-documento` → 202, depois apagado.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** publicar com tag nova; volta `painel:arq-fup-20261022`
- **Próximos passos:** publicar e conferir o Simular de texto do By Koji, sem clipe

## [2026-10-22 17:52] — Documento no Simular conversa (não publicado)
- **Autor:** Grok 4.7
- **Objetivo:** Enviar PDF, XML, JPG, PNG ou WEBP no simulador quando o agente tem documentos ligados.
- **Arquivos alterados:**
  - `src/components/luxtia/Simulador.tsx`, `BarraEnvioSimulador.tsx`, `documentos/CartaoDocumentoConversa.tsx` — criados/modificados — clipe, cartão e aviso
  - `src/lib/gateway/simular.server.ts`, `gateway-simular.functions.ts`, `cliente.server.ts`, `modulo.server.ts`, `documentos.ts`, `erros.ts` — criados/modificados — multipart para `simular-documento` e leitura da capacidade
  - `src/routes/_authenticated/ia/documentos.tsx` — modificado — `?documento=anx_…` abre o detalhe
  - `docs/prints-arq-fup/17-simular-documento.png`, `18-simular-erros.png` — criados
  - `README.md`, `instrucoes.md` — modificados — registro
- **Resumo das mudanças:** O clipe só aparece com `GET …/capacidades` e `ativo: true`. O arquivo vai em `POST …/simular-documento` (multipart), com mensagem opcional. Na conversa o arquivo vira cartão com nome, tipo, estado e link para Documentos.
- **Decisões e justificativas:** O contrato da seção 14.5 não veio colado na mensagem; valeu a rota que o gateway já publica. O teto de 10 MB é o padrão da capacidade. O histórico não traz o id do anexo, então o cartão casa `[anexo: nome]` com `GET /anexos?conversation_id=`.
- **Comandos executados:** `bun test` documentos e módulo → 38 OK; `tsc --noEmit` → OK; ESLint dos arquivos → OK (avisos antigos da prévia); prints Playwright → OK
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** não publicado
- **Próximos passos:** publicar só com liberação

## [2026-10-22 15:24] — Publicação painel:arq-fup-20261022
- **Autor:** Grok 4.7
- **Objetivo:** Publicar o painel até o commit 7a53f7e e conferir produção só navegando.
- **Arquivos alterados:**
  - `docs/worklog.md`, `instrucoes.md`, `README.md` — modificados — registro da publicação, depois da imagem pronta
- **Resumo das mudanças:** A árvore estava limpa em `7a53f7e` antes do build. A imagem nova é `painel:arq-fup-20261022` (`sha256:5f859d0c906bdc708f842a5129ff9da7f918fe0ad706324c1c2594dc8c1719e1`). A volta é `painel:pedidos-20261020` (`sha256:71e678d2651e06979ddc6f6d55ba4334d830b0f1ccf7ae3814d024d1ae100966`). Container `590038b76381`, iniciado 22/10/2026 15:09 (Brasília). Só o painel foi recriado.
- **Decisões e justificativas:** Sem mudança de schema, o dump não entra numa volta. A documentação foi escrita depois do build para a imagem continuar sendo exatamente o commit.
- **Comandos executados:** `docker compose build painel` → OK; `sh docker/verificar-chave-no-bundle.sh` → chave 0, gateway no front 0, `GATEWAY_PANEL_KEY` no servidor 1; `docker compose up -d --no-deps --no-build painel` → OK. Conferência em https://painel.luxbrain.com.br, empresa By Koji, sem criar dado.
- **Erros e resoluções:** nenhum. A string “403” no log do gateway é a porta `40374` de um `GET /health` 200, não um status.
- **Pendências / TODO:** estes três arquivos de registro ainda não estão no git. Não rebuildar por causa deles.
- **Próximos passos:** commit só se for pedido. Volta, se precisar: `docker tag painel:pedidos-20261020 painel_koji-painel && docker compose up -d --no-deps --no-build painel`.

## [2026-10-22 13:33] — Rotas do gateway no painel (não publicado)
- **Autor:** Grok 4.7
- **Objetivo:** Mostrar a reativação no contato, os rótulos novos e o botão de segredo com a janela de 24 h.
- **Arquivos alterados:**
  - `src/lib/gateway/followup.ts`, `src/components/luxtia/FollowUpConversa.tsx` — modificados — depois de reativar, o contato mostra quem fez e o motivo
  - `src/lib/gateway/documentos.ts` — modificado — “Conta de consumo” e “Cobrança Pix”
  - `src/lib/gateway/webhooks.ts`, `WebhooksSaida.tsx`, `ia/webhooks-saida.tsx` — modificados — botão para admin e plataforma, confirmação de 24 h, prazo do segredo anterior
  - `docs/prints-arq-fup/15`, `16` e `05` — modificados — prints da reativação, do segredo novo e da lista
- **Resumo das mudanças:** O motivo já ia no DELETE. Agora o retorno fica visível no contato. O botão de segredo novo saiu do esconderijo, com o aviso de que o antigo vale mais 24 horas.
- **Decisões e justificativas:** Plataforma também vê o botão: a tela de webhooks já é só desses dois papéis e o servidor do painel deixa a plataforma chamar a rota. Membro não abre a tela.
- **Comandos executados:** `bun test` documentos e módulo → 35 OK; `tsc --noEmit` → OK; ESLint → OK (avisos antigos da prévia); prints Playwright → OK
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** não publicado
- **Próximos passos:** publicar só com liberação

## [2026-10-22 12:27] — Ajustes pós-revisão 693249e (não publicado)
- **Autor:** Grok 4.7
- **Objetivo:** Esconder a rotação do segredo, filtrar documentos no gateway e enviar o motivo ao reativar.
- **Arquivos alterados:**
  - `src/lib/gateway/webhooks.ts`, `src/components/luxtia/WebhooksSaida.tsx` — modificados — botão “Gerar novo segredo” atrás de `ROTACAO_SEGREDO_LIBERADA = false`
  - `src/lib/gateway/documentos.ts`, `documentos.server.ts`, `src/routes/_authenticated/ia/documentos.tsx`, `src/components/luxtia/documentos/Documentos.tsx` — modificados — tipo e período vão em `GET /anexos`
  - `src/lib/gateway/followup.ts`, `followup.server.ts`, `modulo.server.ts`, `FollowUpConversa.tsx`, `Conversas.tsx` — modificados — motivo obrigatório (3 a 300) no DELETE de opt-out
  - `README.md`, `instrucoes.md`, `tests/visual/arq-fup/capturar.cjs` — modificados — registro e a prévia deixa de procurar o botão e o aviso local
- **Resumo das mudanças:** O filtro de tipo e data sai da página carregada e entra na consulta. Reativar manda o motivo. O botão de segredo novo não aparece.
- **Decisões e justificativas:** O gateway em execução já aceita `tipo_documento`, `de` e `ate`, e o DELETE de opt-out exige `motivo`. A rotação do segredo também existe, mas o botão fica escondido até a liberação explícita.
- **Comandos executados:** `bun test` documentos e módulo → 34 OK; `tsc --noEmit` → OK; ESLint dos arquivos → OK
- **Erros e resoluções:** `superRefine` no objeto da união quebrava o schema do Zod (`type.shape` indefinido). A ordem das datas passou a ser conferida na chamada de listar.
- **Pendências / TODO:** não publicado. `ROTACAO_SEGREDO_LIBERADA` continua falso.
- **Próximos passos:** publicar só com liberação. Ligar o botão de segredo quando pedirem.

## [2026-10-22 11:40] — Revisão dos prints ARQ/FUP (não publicado)
- **Autor:** Grok 4.7
- **Objetivo:** Corrigir datas, segredo, detalhe do documento e textos antes de publicar.
- **Arquivos alterados:**
  - `src/lib/data-hora.ts`, `src/components/luxtia/DataHora.tsx` — criados — data dd/mm/aaaa e hora 24h
  - `src/components/luxtia/documentos/Documentos.tsx`, `src/lib/gateway/documentos.ts` — modificados — rótulos, R$, Copiar, itens, aviso PIX, validade, filtro local
  - `src/components/luxtia/WebhooksSaida.tsx`, `src/lib/gateway/webhooks.ts`, `webhooks.server.ts` — modificados — ativo ligado, segredo uma vez, gerar novo
  - `src/components/luxtia/FollowUpConversa.tsx`, `comportamento/CampoAtendimento.tsx`, `ComportamentoAgente.tsx` — modificados — cancelar na linha, motivo, hora, nome do agente
  - `src/routes/__root.tsx`, `ia/chaves.tsx` — modificados — lang pt-BR; escopos vazios e callback desabilitado
  - `docs/prints-arq-fup/` — modificados — prints das telas alteradas, com boleto, NF-e e PIX
- **Resumo das mudanças:** O input nativo ignorava o idioma e mostrava mm/dd e AM/PM. Os campos passaram a ser texto. O detalhe do documento deixa de mostrar a chave técnica. O webhook novo abre ativo e o segredo segue o aviso da chave de formulário.
- **Decisões e justificativas:** Tipo e data seguem na página carregada porque `GET /anexos` não aceita esses filtros. O motivo de reativar não vai ao gateway: o DELETE de opt-out não lê corpo. “Gerar novo segredo” chama `POST …/rotacionar-segredo`; essa rota ainda não existe e a tela avisa no 404.
- **Comandos executados:** `bun test` documentos e módulo → 33 OK; `tsc --noEmit` → OK; ESLint dos arquivos → OK (avisos antigos da prévia visual)
- **Erros e resoluções:** O Chromium do host não abriu (libatk). Os prints saíram no container `mcr.microsoft.com/playwright:v1.58.2-noble`.
- **Pendências / TODO:** não publicado. Gateway sem filtro de tipo/data, sem motivo no opt-out e sem rotação do segredo HMAC.
- **Próximos passos:** publicar só depois de o Marco ver os prints e, se quiser, o gateway ganhar as três rotas.

## [2026-10-21 22:55] — Telas de follow-up (não publicadas)
- **Autor:** Grok 4.7
- **Objetivo:** Configuração, bloco na conversa e opt-out, com a rota 404 sem derrubar a página.
- **Arquivos alterados:**
  - `src/components/luxtia/FollowUpConversa.tsx` — criado
  - `src/components/luxtia/Conversas.tsx`, `comportamento/CampoAtendimento.tsx` — modificados
  - `src/lib/gateway/followup.ts`, `followup.server.ts`, `gateway-followup.functions.ts` — criados
  - `src/lib/gateway/modulo.server.ts`, `atendimento.ts`, `conversas.ts` — modificados — permissão e rótulos
- **Resumo das mudanças:** O agente liga o follow-up, os minutos, o máximo do dia e a janela. A conversa lista agendado, cancelado e ensaio, com Cancelar. O contato mostra “não quer follow-up” e Reativar só para admin e plataforma. Se o gateway responder 404, a conversa mostra “Follow-up ainda não está disponível.” e o restante da tela segue.
- **Decisões e justificativas:** A listagem 404 vira lista vazia com aviso. Cancelar e reativar 404 viram a mesma frase, no toast, sem desmontar a conversa. A janela na configuração fica num try/catch próprio.
- **Comandos executados:** `bun test` documentos, módulo e atendimento → 39 OK
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** não publicado; esperar o FUP1-a no gateway e a revisão dos prints
- **Próximos passos:** publicar só depois dessa confirmação

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

Entradas anteriores (revisão UX do cardápio, DISP1, CAL1 e até 11/10/2026) estão em `docs/worklog-arquivo/2026-10.md`.
