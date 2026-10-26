# Build do painel (TanStack Start + Nitro em modo node-server).
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY . .
ARG VITE_SUPABASE_URL=https://painel.luxbrain.com.br
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG GIT_COMMIT=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV NITRO_PRESET=node-server
# Sem o commit, o build para. Quem publica é docker/publicar-painel.sh, e ele recusa árvore suja.
RUN if [ -z "$GIT_COMMIT" ]; then \
      echo "Build recusado: use docker/publicar-painel.sh com a árvore commitada." >&2; \
      exit 1; \
    fi \
 && bun install --frozen-lockfile && bun run build

FROM node:22-bookworm-slim
ARG GIT_COMMIT=
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TZ=America/Sao_Paulo
COPY --from=build /app/.output ./.output
COPY docker/aguardar-servicos.mjs /app/aguardar-servicos.mjs
EXPOSE 3000
CMD ["sh", "-c", "node aguardar-servicos.mjs && node .output/server/index.mjs"]
