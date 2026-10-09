# Build do painel (TanStack Start + Nitro em modo node-server).
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY . .
ARG VITE_SUPABASE_URL=https://painel.luxbrain.com.br
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV NITRO_PRESET=node-server
RUN bun install --frozen-lockfile && bun run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TZ=America/Sao_Paulo
COPY --from=build /app/.output ./.output
COPY docker/aguardar-servicos.mjs /app/aguardar-servicos.mjs
EXPOSE 3000
CMD ["sh", "-c", "node aguardar-servicos.mjs && node .output/server/index.mjs"]
