# Instruções do projeto — Painel Koji

Registro das fases do desenvolvimento. Ler este arquivo antes de continuar uma nova instrução.

## Fase — Remoção da marca Lovable (2026-10-07 23:02)

- Favicon e ícone da aba passaram a ser o monograma Luxtia (roxo e dourado).
- Saíram a dependência de build `@lovable.dev/vite-tanstack-config`, a telemetria, o armazenamento de sessão do editor e os textos que citavam essa plataforma.
- O painel foi republicado em http://painel.luxbrain.com.br/ e a página de acesso continua no ar.

## Fase — Stack em execução (2026-10-07 18:30)

- `docker compose` está no ar em `/home/twadmin/painel_koji`.
- Nesta máquina, http://10.0.0.211 responde o painel Luxtia, com autenticação e API.
- O DNS `painel.luxbrain.com.br` → `177.67.71.227` está certo, mas o firewall ainda entrega as portas 80 e 443 a outro servidor (Apache/nginx). O encaminhamento precisa ir para `10.0.0.211`.

## Fase — Deploy Docker + PostgreSQL (2026-10-07)

- Código clonado em `/home/twadmin/painel_koji` (o diretório `/opt` não é gravável por este usuário).
- Stack: Postgres 16 (fuso `America/Sao_Paulo`), GoTrue, PostgREST, painel TanStack (Nitro `node-server`) e Caddy em `painel.luxbrain.com.br`.
- Segredos gerados em `.env` (não versionado). Migrations em `supabase/migrations` rodam no serviço `migracoes`.
- O navegador usa a mesma origem da página para `/auth/v1` e `/rest/v1`.

## Fase — Publicação no GitHub (2026-10-07)

- O projeto local já era o painel Lovable (TanStack Start, React, TypeScript, Tailwind e Supabase).
- O código foi publicado no repositório https://github.com/marcoasp3030/painel_koji (conta `marcoasp3030`, branch `main`).
- O arquivo `.env` não entra no Git. As chaves ficam só na máquina local.
