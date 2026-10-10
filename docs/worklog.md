## 2026-10-10 — Gestão G1 do painel

Unidades, grade/agenda, pausa/reabertura, exceções e histórico publicados. Atendente lê unidades/agenda e pausa/reabre; gestão restante só plataforma/admin, por regra no servidor. X-Actor da sessão. 72 testes aprovados, TypeScript e build OK, lint sem erros. Validação autenticada de quatro unidades/agendas e histórico somente em leitura; zero escritas de produção. Backup/tag de volta preservados; só painel recriado; gateway intocado e zero segredos no bundle/logs. Relatório e descrição das telas: `docs/VALIDACAO_G1_PAINEL.md`. Aguardar revisão visual do Marco; sem outros blocos.

## 2026-10-10 — Limites de capacidade exclusivos da plataforma

- Empresa (Editar → Avançado) e agente (aba Avançado): 1–100, reset null, valor efetivo do gateway, ajuda e erro junto ao campo.
- Funções do servidor exigem plataforma nas leituras/escritas; nenhum segredo no navegador e nenhuma alteração no repositório gateway.
- 60 testes aprovados, seis integrações REST antigas ignoradas; TypeScript/lint/build aprovados. Publicação com imagem de volta `painel:4f0eaea` e backup validado `pre-capacidade-20261010T014040Z`.
- Apenas painel recriado, saúde OK, admin público 404, zero segredos no bundle/logs. HTTP autenticado confirmou valores efetivos (30/30 By Koji) e recusou 101 nos dois campos sem gravar. Nenhuma configuração alterada. Detalhes e volta em `instrucoes.md`; revisão visual pendente do Marco.

# Worklog

Registro de desenvolvimento do Painel Koji. Entradas mais recentes no topo.

## [2026-10-10] — Aguardando atendente no painel

- Selo com tempo e motivo, filtro no servidor, prioridade pela espera mais antiga e aviso discreto por evento visível. Sem botão para limpar; reflete o estado do gateway após atendimento.
- Fallback com exemplo, mínimo de 15 caracteres e letra, vazio herdado, erro de campo seguro; papéis conferidos no servidor.
- 57 testes aprovados, TypeScript/lint/build verdes. Publicação apenas do painel, imagem anterior `painel:ed9de0c`, backup validado; chave ausente do front/logs. HTTP autenticado conferido sem alterar dados do gateway. Detalhes e checklist em `instrucoes.md`.

## [2026-10-09 15:52] — Publicação do cursor oficial
- **Autor:** Auto (Cursor)
- **Objetivo:** Publicar só o painel, com imagem de volta e backup, para validação de `/ia/conversas`.
- **Arquivos alterados:**
  - `instrucoes.md` — modificado — volta, backup e conferências
  - `docs/worklog.md` — modificado — esta entrada
- **Resumo das mudanças:** A imagem em uso foi marcada `painel:24c8436` antes do build. O painel novo é `painel:ed9de0c`. Banco, gateway e demais containers não foram recriados.
- **Decisões e justificativas:** A volta é o commit que a imagem anterior contém (`24c8436`), não o código novo. Sem mudança de schema, o dump não deve ser restaurado numa volta.
- **Comandos executados:** tag conferida → OK; `pg_restore --list` → OK; `docker compose build painel` → OK; verificação da chave no bundle → OK; `up -d --no-deps --no-build painel` → OK; páginas 200 e admin do gateway 404; segredos nos logs → 0.
- **Erros e resoluções:** `pg_restore` não existe no host; a lista do dump foi conferida com a imagem `postgres:16-alpine`.
- **Pendências / TODO:** validação visual de `/ia/conversas` pelo Marco
- **Próximos passos:** nenhuma continuação até essa validação

## [2026-10-09 15:44] — Cursor oficial no acompanhamento das conversas
- **Autor:** Auto (Cursor)
- **Objetivo:** Trocar a varredura provisória pelo `GET /eventos/cursor` do gateway.
- **Arquivos alterados:**
  - `src/lib/gateway-conversas.functions.ts` — modificado — lê `ultimo_id` antes da lista
  - `src/lib/gateway/conversas.ts` — modificado — `desde` parte desse id
  - `src/lib/gateway/modulo.server.ts` — modificado — admin da empresa e membro podem ler o cursor
  - `src/components/luxtia/Conversas.tsx` — modificado — lista e polling só depois do cursor
  - `src/lib/gateway/conversas.test.ts`, `src/lib/gateway/modulo.test.ts` — modificados
  - `instrucoes.md`, `README.md`, `docs/worklog.md` — modificados
- **Resumo das mudanças:** Ao abrir Conversas, o painel pede `{"ultimo_id": N}` e só então carrega a lista. O polling usa esse N como `desde` e não pede o cursor de novo. Páginas de eventos só alcançam o que chegou depois.
- **Decisões e justificativas:** O contrato pede o cursor antes da carga para não perder o que for confirmado enquanto a lista carrega. A varredura desde zero deixou de ser o ponto de partida.
- **Comandos executados:** `bun test` → 52 pass, 6 skip; `tsc --noEmit` e eslint dos arquivos alterados → OK. Sem build nem publicação.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** validação do Marco antes de publicar o painel
- **Próximos passos:** depois da validação, imagem de volta, backup e recriar só o painel

## [2026-10-09] — Conversas e conexão Skyone em simulação

- Implementadas lista/filtros, histórico paginado, atendimento humano, polling limitado no servidor e novidades locais por usuário/empresa. Destaque de transferência preparado para a Fase 3.
- Teste real pelo painel: HTTP 200 em 6.762 ms; Bench segundo agente permanece mock/dry.
- 51 testes aprovados, TypeScript/lint/build verdes. Somente painel recriado com imagem de volta e backup; funções HTTP autenticadas e proteções verificadas após publicação.
- Procedimento, backup, limitações e resultados completos em `instrucoes.md`. Aguardando validação do Marco; nenhuma continuação da Fase 0.6.

## [2026-10-07 23:54] — Visual do painel mais moderno
- **Autor:** Grok 4.7
- **Objetivo:** Melhorar a experiência do painel sem sair das cores do designer.
- **Arquivos alterados:**
  - `src/components/luxtia/Superficie.tsx` — criado — cabeçalho, métricas, cartão, vazio e iniciais
  - `src/components/luxtia/AppShell.tsx` — modificado — monograma, barra superior e fundo creme
  - `src/routes/_authenticated/admin/index.tsx` — modificado — resumo, busca e lista
  - `src/routes/_authenticated/admin/$tenantId.tsx` — modificado — cartões de conexão e acessos
  - `src/routes/_authenticated/equipe.tsx` — modificado — mesmo padrão visual
  - `src/routes/index.tsx` — modificado — formulário de login em cartão
  - `instrucoes.md`, `docs/worklog.md` — modificados
- **Resumo das mudanças:** O fundo ficou no creme da marca e os blocos brancos se separam com borda e sombra leve. A lista de clientes mostra totais, busca e a situação de cada um.
- **Decisões e justificativas:** Ouro continua só no traço e no L do menu, como o teto da paleta. Verde de sucesso, já definido no tema, marca conexão ativa.
- **Comandos executados:** docker compose build painel && up -d → OK. Busca, lista e ficha do cliente conferidas no navegador, inclusive em 390px.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** nenhuma
- **Próximos passos:** repetir o mesmo padrão se novas telas entrarem no menu

## [2026-10-07 23:26] — Menu sem Integrações, Diagnóstico e Auditoria
- **Autor:** Grok 4.7
- **Objetivo:** Remover do menu Integrações, Debug iFood, Debug 99Food e Auditoria.
- **Arquivos alterados:**
  - `src/lib/nav.ts` — modificado — menus reduzidos a Clientes e Equipe
  - `src/components/luxtia/AppShell.tsx` — modificado — ícones que não entram mais no menu
  - `src/routes/_authenticated/admin/$tenantId.tsx` — modificado — atalhos para as telas removidas
  - `src/routes/_authenticated/painel.tsx` — modificado — cliente entra em Equipe
  - `instrucoes.md`, `docs/worklog.md` — modificados
- **Resumo das mudanças:** O menu do super admin mostra só Clientes. O do cliente mostra só Equipe. Os grupos Diagnóstico e Governança deixaram de aparecer.
- **Decisões e justificativas:** As rotas continuam no código para não quebrar endereços antigos, mas não há mais entrada no menu nem atalho na ficha do cliente.
- **Comandos executados:** docker compose build painel && up -d → OK. Menu em /admin conferido no navegador: só Clientes.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** nenhuma
- **Próximos passos:** se essas telas não forem mais usadas, apagar as rotas correspondentes

## [2026-10-07 23:12] — Menu lateral organizado
- **Autor:** Grok 4.7
- **Objetivo:** Deixar o painel mais organizado, com menu lateral agrupado.
- **Arquivos alterados:**
  - `src/components/luxtia/AppShell.tsx` — modificado — barra superior virou menu lateral
  - `src/lib/nav.ts` — modificado — grupos Operação, Diagnóstico e Governança
  - `instrucoes.md`, `docs/worklog.md` — modificados
- **Resumo das mudanças:** A marca e o contexto ficam no topo do menu. Cada página tem ícone e o item ativo leva a faixa dourada. No celular o menu entra pela esquerda e some ao navegar.
- **Decisões e justificativas:** As páginas já passavam a lista de navegação para o AppShell, então o agrupamento ficou só na definição do menu, sem alterar cada rota.
- **Comandos executados:** docker compose build painel && docker compose up -d painel → OK. Navegação no navegador em /admin, /integracoes e /auditoria, em 1440px e 390px → OK.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** nenhuma
- **Próximos passos:** se surgirem novas telas, incluí-las no grupo correspondente em `src/lib/nav.ts`

## [2026-10-07 23:06] — Acesso de Marco Santos
- **Autor:** Grok 4.7
- **Objetivo:** Criar o usuário marco.santos@ticway.com.br no painel.
- **Arquivos alterados:**
  - `instrucoes.md` — modificado — registro da fase
  - `docs/worklog.md` — modificado — esta entrada
- **Resumo das mudanças:** Conta criada no GoTrue (e-mail confirmado) e papel `super_admin` em `user_roles`. Sem vínculo com cliente, porque o pedido foi de usuário do sistema.
- **Decisões e justificativas:** Sem o papel de super admin o login cairia na tela sem cliente. O acesso `admin@luxtia.local` foi mantido.
- **Comandos executados:** POST no admin do GoTrue → OK. INSERT em user_roles → OK. login em `/auth/v1/token` → 200.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** nenhuma
- **Próximos passos:** entrar em http://painel.luxbrain.com.br/ com o e-mail informado

## [2026-10-07 23:02] — Remoção da marca Lovable
- **Autor:** Grok 4.7
- **Objetivo:** Tirar do painel publicado tudo que ainda identificava o Lovable, inclusive ícone e favicon.
- **Arquivos alterados:**
  - `public/favicon.ico` — modificado — coração substituído pelo monograma Luxtia
  - `public/favicon.svg` — criado — mesmo monograma em SVG
  - `src/routes/__root.tsx` — modificado — links do ícone e remoção da telemetria
  - `src/lib/lovable-error-reporting.ts` — removido
  - `src/integrations/supabase/previewAuthStorage.ts` — removido
  - `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `cron-auth.ts` — modificados — sessão local e textos sem a plataforma antiga
  - `vite.config.ts`, `package.json`, `bun.lock`, `bunfig.toml` — modificados — build próprio, sem o pacote `@lovable.dev`
  - `README.md`, `AGENTS.md`, `instrucoes.md` — modificados
- **Resumo das mudanças:** A aba deixa de mostrar o coração e passa a usar o L roxo e dourado. O JavaScript publicado não cita mais a plataforma. O Vite usa TanStack Start e Nitro direto.
- **Decisões e justificativas:** O pacote de configuração só existia para o editor antigo. A sessão no domínio próprio já caía no localStorage; o atalho do editor foi removido sem mudar o login.
- **Comandos executados:** docker compose build painel → OK. docker compose up -d painel → OK. curl da página, do favicon e busca no bundle → sem ocorrências.
- **Erros e resoluções:** nenhum
- **Pendências / TODO:** nenhuma desta tarefa
- **Próximos passos:** se a aba ainda mostrar o coração, forçar atualização (o navegador guarda favicon antigo)

## [2026-10-07 18:30] — Stack no ar nesta máquina
- **Autor:** Grok 4.7
- **Objetivo:** Subir o painel em Docker com PostgreSQL para responder em painel.luxbrain.com.br.
- **Arquivos alterados:**
  - `docker/inicializar-banco.sh` — modificado — shebang compatível com a imagem Alpine
- **Resumo das mudanças:** Compose subiu Postgres, GoTrue, PostgREST, o painel e o Caddy nas portas 80 e 443. Migrations aplicadas. Login do super admin testado com sucesso em localhost.
- **Decisões e justificativas:** O DNS de painel.luxbrain.com.br aponta para 177.67.71.227, que é o firewall. As portas 80/443 desse IP ainda caem no Apache/nginx de outro servidor, então o Let's Encrypt não validou e a URL pública continua na página antiga.
- **Comandos executados:** docker compose up -d --build → OK. curl local do painel, /auth/v1/health e login → OK.
- **Erros e resoluções:** desafio ACME em 177.67.71.227 respondeu 404 do Apache, não deste Caddy.
- **Pendências / TODO:** no pfSense, encaminhar TCP 80 e 443 de 177.67.71.227 para 10.0.0.211.
- **Próximos passos:** repetir o teste da URL pública depois do ajuste do NAT.

## [2026-10-07 16:20] — Deploy Docker e PostgreSQL
- **Autor:** Grok 4.7
- **Objetivo:** Clonar o painel e deixá-lo no ar em painel.luxbrain.com.br com Docker e Postgres.
- **Arquivos alterados:**
  - `Dockerfile`, `docker-compose.yml`, `docker/*`, `.dockerignore`, `.env.example` — criados — stack de produção
  - `.env` — criado — senha do Postgres e chaves JWT (não versionado)
  - `vite.config.ts` — modificado — preset Nitro `node-server`
  - `src/integrations/supabase/client.ts` — modificado — URL da API igual à origem da página
  - `README.md`, `instrucoes.md` — modificados — fase de deploy
- **Resumo das mudanças:** Repositório clonado para `/home/twadmin/painel_koji`. Compose sobe Postgres, autenticação, PostgREST, o painel e o Caddy nas portas 80/443.
- **Decisões e justificativas:** O app fala com a API no estilo Supabase (JWT, RLS e `auth.uid()`). Postgres sozinho não atende o login; GoTrue e PostgREST ficam na mesma origem do domínio. `/opt` é root e o Docker do host ainda não estava instalado.
- **Comandos executados:** git clone; python3 docker/gerar-segredos.py → OK. Instalação do Docker via sudo → senha exigida.
- **Erros e resoluções:** `sudo` pede senha; instalação do Docker ainda não concluiu.
- **Pendências / TODO:** instalar Docker, `docker compose up -d --build`, apontar o DNS de painel.luxbrain.com.br para o IP público desta máquina (177.126.168.114).
- **Próximos passos:** subir a stack e conferir login em http://painel.luxbrain.com.br

## [2026-10-07 15:55] — Publicação no GitHub
- **Autor:** Grok 4.7
- **Objetivo:** Enviar o código local para o repositório GitHub `painel_koji`.
- **Arquivos alterados:**
  - `.gitignore` — modificado — passa a ignorar `.env` e variantes
  - `README.md` — modificado — link do repositório
  - `instrucoes.md` — criado — fase de publicação
  - `docs/worklog.md` — criado — este registro
- **Resumo das mudanças:** Repositório remoto `marcoasp3030/painel_koji` já existia e estava vazio. O projeto local ainda não era um repositório Git. O código-fonte foi commitado na branch `main` e enviado para o GitHub.
- **Decisões e justificativas:** O `.env` ficou de fora porque o repositório é público e contém chaves do Supabase. O `gh` não estava autenticado no terminal; o envio usou a autenticação já configurada do GitHub no Cursor.
- **Comandos executados:** git init, git add, git commit, git push → ver resultado na mesma sessão
- **Erros e resoluções:** nenhum até o envio
- **Pendências / TODO:** conferir no GitHub se todos os arquivos subiram
- **Próximos passos:** conectar o Lovable a este repositório, se ainda não estiver ligado
