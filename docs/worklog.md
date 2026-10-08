# Worklog

Registro de desenvolvimento do Painel Koji. Entradas mais recentes no topo.

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
