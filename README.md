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
