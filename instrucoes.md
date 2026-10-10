# Instruções do projeto — Painel Koji

Registro das fases do desenvolvimento. Ler este arquivo antes de continuar uma nova instrução.

## Regras permanentes

- **Imagem de volta antes de todo build que substitua a imagem em uso.** Marcar a imagem do container atual com o commit do código que ela contém e conferir que a tag existe e aponta para a mesma imagem:

  ```sh
  IMG=$(docker inspect painel_koji-painel-1 --format '{{.Image}}')
  docker tag "$IMG" painel:<commit>
  docker image inspect painel:<commit> --format '{{.Id}}'   # deve ser igual a $IMG
  ```

  Só depois rodar `docker compose build painel`. Para voltar: apontar o serviço para `painel:<commit>` (ou `docker tag painel:<commit> painel_koji-painel`) e `docker compose up -d --no-deps --no-build painel`.
- **Nenhum `docker image prune`, `docker builder prune` ou `docker system prune`** sem confirmação do Marco. (Em 09/10 a imagem anterior sumiu depois de um rebuild sem tag e a volta teve de ser feita com cópia do `/app`.)
- Imagem de volta atual: `painel:ed9de0c` (antes de Aguardando atendente). Tags anteriores preservadas.

## Fase — Aguardando atendente e fallback (2026-10-10)

- Somente painel: `/ia/conversas` usa `aguardando_atendente_desde` e `aguardando_motivo`; selo com minutos (atualiza em 30 s), quatro motivos traduzidos, filtro `aguardando=true` e fila antes das conversas normais, da espera mais antiga para a mais nova.
- Como o gateway pagina por ID, o servidor reúne até 20 páginas de 100 da fila de espera, aplica visibilidade de agentes e ordena por data. Acima disso, exige restringir filtros sem apresentar uma fila incompleta como completa. Conversas normais continuam paginadas, com `aguardando=false`.
- Polling reconhece `conversa.aguardando_atendente`, atualiza lista/histórico e mostra aviso discreto dispensável. Apenas contagem de eventos visíveis chega ao navegador; alvos de agentes `[teste]` e eventos brutos não são expostos. As ações existentes de assumir/devolver/responder invalidam a lista; não existe botão para limpar a marca. Cursor oficial e marcadores locais por usuário/empresa preservados.
- Fallback: exemplo `Tive uma instabilidade agora. Pode repetir sua mensagem em instantes? 🙏`; mínimo de 15 caracteres Unicode e uma letra, validado na tela e no servidor. Vazio vira null (herança). `salvarComportamento` restringe campos, aplica papéis no servidor, preserva validação de piloto e devolve apenas erro seguro de `detalhes.campo=fallback` para exibição junto ao campo.
- Testes: 57 aprovados; seis cenários REST antigos ignorados por ausência de variáveis próprias. TypeScript, lint dos arquivos alterados e build aprovados. Cobertura de motivos, cronômetro, ordem/remoção por null, eventos invisíveis, fallback e permissões.
- Imagem anterior conferida e preservada: `painel:ed9de0c`. Backup `/home/twadmin/backups/painel/pre-espera-20261010T001312Z` (diretório 700, dump/ambiente/Compose 600), `pg_restore --list` válido; SHA-256 `1f6df048bbfb4ae73f20471103a54b6f2c17e935f1f9b3f770e8b2cabf57eeb1`.
- Volta sem mudança de schema: conferir `docker image inspect painel:ed9de0c`, executar `docker tag painel:ed9de0c painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`, conferir saúde. Não restaurar dump sobre o banco em uso.
- Pós-publicação: somente painel recriado; IDs de gateway/API, workers/agendador, bancos, Redis, autenticação, REST e proxy preservados. Nenhum arquivo do repositório gateway editado, nenhuma chamada ao Skyone, nenhuma credencial ou configuração de agente alterada.
- Verificação do bundle: zero valor de chave e zero referências internas no front. Busca das credenciais locais nos logs do painel novo: zero ocorrências. `/`, `/ia/conversas`, `/ia/agentes`, health de autenticação/gateway → 200; admin público do gateway → 404.
- Funções HTTP autenticadas: filtro normal retornou 43 conversas com marca nula; filtro de espera retornou zero (sem provocar falha artificial em agente real); cursor/eventos retornaram o contador esperado. Fallback curto → erro seguro no campo antes de qualquer PATCH. Motivos, idade, prioridade e remoção por null validados com dados sintéticos nos testes, não com uma transferência real nesta implantação.
- Conferência visual pendente do Marco: selo/motivo com uma conversa marcada, filtro e ordem, aviso discreto ao chegar evento, marca removida após atendimento e fallback com erro junto ao campo. Sem botão de limpeza. Nenhum rollback necessário.

## Fase — Publicação do cursor oficial nas Conversas (2026-10-09 15:52)

- Código `ed9de0c`. Imagem publicada `painel:ed9de0c` (`sha256:c69c8f3249728e106d736066a436536f62334479d9ecc514043ce520433cd020`), igual à do container em uso.
- Imagem de volta conferida antes do build: `painel:24c8436` (`sha256:76f4abb772b94bcfd2984fd85c183bb041ab74ec4c86e7907a1388ea71ba5b44`).
- Backup em `/home/twadmin/backups/painel/pre-cursor-20261009T185130Z` (diretório 700, arquivos 600): dump, `.env`, Compose e IDs dos containers. `pg_restore --list` aprovado (279 entradas). SHA-256 do dump: `84ba6ba0ae7f0cf672cfa864b056258a8f8070ef43505f4d955ee63a9168c16e`.
- `docker/verificar-chave-no-bundle.sh`: zero ocorrências da chave, zero referências no front; o servidor lê a chave. Recriado somente o painel. Gateway, Postgres, Redis, autenticação, REST e proxy mantiveram os mesmos IDs. Nenhum prune ou migração.
- `/`, `/ia/conversas`, `/ia/agentes`, `/ia/simular`, `/auth/v1/health` e `/gateway/health` → 200. `/gateway/admin/v1/tenants` → 404. Nos logs do painel novo, chave do gateway, segredo JWT, service role e senha do Postgres → zero ocorrências.
- A revisão de `/ia/conversas` no navegador fica com Marco.

### Volta desta publicação

Sem alteração de schema: não restaurar o dump. Conferir `docker image inspect painel:24c8436 --format '{{.Id}}'`, executar `docker tag painel:24c8436 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.

## Fase — Conversas e teste real em simulação (2026-10-09)

- Tela `/ia/conversas` e menu para plataforma, admin da empresa e membro: filtros por agente/canal/situação/nome ou telefone/data, paginação de conversas, histórico paginado, assumir por prazo, devolver e mensagem humana (pausa automática). Nenhuma configuração de envio foi alterada.
- Lista preparada para priorizar e destacar **Aguardando atendente** quando o gateway passar a enviar `aguardando_humano` (Fase 3); hoje não inventa esse estado.
- Ponto de partida de `/eventos`: ao abrir Conversas, o servidor lê `GET /eventos/cursor` (`ultimo_id`) **antes** da lista. O polling começa com `desde=ultimo_id` e não repete essa leitura. Páginas de 100 (no máximo 20 por chamada) só alcançam eventos novos; se houver mais, a chamada seguinte retoma do cursor confirmado. A auditoria bruta não vai ao navegador. Polling a cada 2,5 s; lista/histórico também se atualizam, sem polling em segundo plano.
- Novidades em `localStorage`, chave por usuário autenticado e tenant efetivo; guarda somente datas de leitura por conversa, sem conteúdo. Abrir histórico e lê-lo marca a conversa; sem armazenamento, funciona em memória. Agentes `[teste]` ocultos para usuários da empresa, inclusive em páginas posteriores; falha ao conferir canal recusa histórico/ação.
- Chamada real autorizada, pelas funções HTTP autenticadas do próprio painel: `alterarAgente` colocou `[teste] Bench segundo agente` em `agente_mode=mock`; `testarConexaoSkyone` enviou `usar_provedor_real=true` → **HTTP 200, ok=true, 6.762 ms**, resposta recebida. Leitura posterior confirmou **mock/dry**. Nenhuma senha lida/exibida e nenhum outro agente alterado.
- Testes: **51 aprovados**, seis cenários de integração REST antigos ignorados por ausência das variáveis próprias; testes de acesso/permissões do módulo executados. TypeScript (`tsc --noEmit`), lint dos arquivos novos/alterados e build aprovados. Testes novos cobrem limite/continuação do cursor, cursor sem avanço, marcadores por usuário/empresa, combinação do histórico, prioridade humana e ocultação paginada.
- Implantação: imagem anterior preservada e conferida como `painel:15f98ec` (`sha256:575132fdd09184df60fcbf18cdcf611ff9ad5114b8ec706e64299d2e0193461a`). Backup do banco/ambiente/Compose em `/home/twadmin/backups/painel/pre-conversas-20261009T181251Z`, diretório 700 e arquivos 600; `pg_restore --list` aprovado. SHA-256 do dump: `62e9e0f1774b688b78658cdcd745c15daef0887dcf4e6bdb737a817b6c05298b`.
- `docker/verificar-chave-no-bundle.sh`: zero ocorrências da chave, zero referências internas no front; servidor lê a chave. Recriado **somente painel**. IDs de gateway, banco, Redis, autenticação, REST e proxy preservados; o container temporário da suíte foi encerrado normalmente. Nenhum prune ou migração.
- Pós-publicação: `/`, `/ia/conversas`, `/ia/agentes`, `/ia/simular`, `/auth/v1/health` e `/gateway/health` → 200; `/gateway/admin/v1/tenants` → 404. Busca das credenciais locais nos logs do painel novo → zero ocorrências.
- Validação autenticada das funções do painel: conversa sintética `bykoji:can_6128998aa8cbfd1b9dc59812:validacao-conversas-1791569656`, agente `bykoji_atendimento` mock/dry. Resposta mock, filtros, pausa, mensagem `origem=humano` em dry, `antes`/`tem_mais`, retomada e cursor por usuário conferidos. Conversa sintética preservada. Estado final do Bench segundo agente confirmado mock/dry novamente. Nenhuma mensagem enviada a cliente.
- Os testes acima validam HTTP e funções do painel; a revisão visual e de uso no navegador fica com Marco. Não iniciada a Fase 0.6 do gateway.

### Volta da tela Conversas

Sem alteração de schema: manter banco e ambiente atuais. Se precisar voltar, conferir `docker image inspect painel:15f98ec --format '{{.Id}}'`, executar `docker tag painel:15f98ec painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`; conferir as rotas de saúde. Não restaurar o dump sobre a base em uso. O agente de teste deve continuar mock/dry, conforme pedido. Nenhuma volta foi necessária.

## Fase — Experiência das telas dos agentes (2026-10-09)

- Vocabulário único em `src/lib/gateway/vocabulario.ts` (sem nomes técnicos na tela) e ajuda em cada campo; listas vazias com orientação.
- Agente em `/ia/agentes/<id>` com abas Visão geral (checklist de prontidão), Comportamento, Conexão com IA (só plataforma, em passos) e Canais.
- “Salvar e testar conexão” fica desativado até o gateway publicar o `/testar` com provedor real: preencher `PARAMETRO_TESTE_REAL` em `src/lib/gateway/recursos.ts`.
- Piloto ligado com lista vazia é recusado na tela e no servidor.
- Agentes com nome iniciado por `[teste]` somem para admin da empresa e membro (listas, canais e acesso direto → não encontrado). Renomeado: “[teste] Bench segundo agente” (bykoji). Agentes de `bench_passo5` não precisam de prefixo.
- Assistente `/ia/empresas/nova` em seis passos, retomável pelo endereço.
- Chat do Simular (item 4) aguarda o gateway liberar IA real no `/simular`.

## Fase — Telas dos agentes e permissões por papel (2026-10-09)

- Permissões no servidor (`src/lib/gateway/modulo.server.ts`, tabela `REGRAS`): admin da plataforma pode tudo; admin da empresa altera no agente só `aviso_demora, fallback, modo_piloto, contatos_permitidos, debounce_s, max_wait_s, pause_minutes, slow_notice_s, alerta_telefone, status (ativo/pausado)`, gerencia unidades, testa, simula, vê canais e consumo e atende conversas; membro só lê agentes, canais e consumo e atende conversas. O resto é recusado antes de chamar o gateway, com motivo em `audit_logs`.
- Telas em **`/ia/...`** (não `/gateway/...`: o Caddy reserva esse prefixo para o gateway): Empresas (só plataforma, com vínculo ao cliente do painel), Agentes (comportamento; Skyone e criar só plataforma; Testar), Canais (criar/ativar/rotacionar só plataforma; URL do webhook uma vez), Chaves de API (só plataforma; valor uma vez), Simular (plataforma e admin da empresa). O menu filtra os itens pelo papel.
- `send_mode` não é editável pelo painel: os agentes ficaram em mock/dry, exceto `postman_teste` (live/dry), conferido após a implantação.
- Implantação: backup em `/home/twadmin/backups/painel/pre-telas-*` (Compose, `.env`, `/app` do container em tar; a imagem antiga já não existia no Docker). Build → `docker/verificar-chave-no-bundle.sh` OK (servidor lê a variável; nada no front) → `up -d --no-deps --no-build painel`. Rotas `/ia/*`, `/admin`, `/equipe` → 200; `/gateway/admin/*` → 404.
- Testes: `bun test` (27). E2E com o módulo real: papéis, recusas de admin/membro, simulação em `bench_passo5` com resposta mock em 5 s.

## Fase — Módulo do gateway e vínculo de empresas (2026-10-09)

- Migração `20261009150000_gateway_tenant_id.sql`: coluna `tenants.gateway_tenant_id` (única, formato do gateway). Só o super_admin (ou o servidor com service_role) grava: RLS já impede usuário comum de alterar `tenants` e um gatilho recusa a coluna mesmo se uma política futura liberar a edição.
- **Vínculo inicial koji → bykoji feito pela própria migração** (dados), não pela tela. luxtia fica sem vínculo.
- Todas as chamadas ao gateway passam por `src/lib/gateway/` (`cliente.server.ts` HTTP, `modulo.server.ts` permissões, `painel.server.ts` perfil lido do banco no servidor). Bearer + `X-Actor` = e-mail do usuário logado. Erros nos formatos `{"erro":...}` e `{"detail":...}`; 429 com Retry-After ≤ 5 s repete uma vez, acima disso devolve a espera.
- Tenant efetivo vem do perfil (papel + `tenant_users` → `gateway_tenant_id`, empresa ativa). Tenant pedido pela tela só é aceito se for o da empresa; admin escolhe qualquer um. Bloqueios vão para `audit_logs`.
- Testes: `bun test` (16 de unidade: acesso entre empresas em todas as rotas, sem vínculo, suspensa, admin, erros, 429, chave fora de logs). `tests/integracao` (REST, comando no arquivo): usuário comum não altera a coluna → recusado. Gatilho testado à parte com políticas abertas em transação desfeita.
- `sh docker/verificar-chave-no-bundle.sh` confere o build sem exibir a chave. Nesta etapa nenhuma tela usa o módulo; repetir após as telas.
- O gateway às vezes devolve código fora da tabela do contrato (`TENANT_NOT_FOUND`) com a mensagem igual ao código; o painel troca pelo texto padrão.
- Backup do banco antes da migração: `/home/twadmin/backups/painel/pre-gateway-*/painel-pre-gateway-tenant-id.dump`.

## Fase — Painel conectado à API administrativa do gateway (2026-10-09)

- Serviço `painel` (servidor do TanStack Start) ligado também à rede externa `luxbrain_gateway_proxy`; banco, autenticação e API REST continuam só em `interno`.
- `.env`: `GATEWAY_ADMIN_URL=http://luxbrain-gateway:8000/admin/v1` e `GATEWAY_PANEL_KEY` (mesmo valor da `PANEL_SERVICE_KEY` do gateway, copiado sem exibir). Repassados ao container pelo Compose.
- Backup do Compose, do `.env` e da lista de containers em `/home/twadmin/backups/painel/pre-gateway-*`.
- Recriado só o painel (`up -d --no-deps --no-build painel`). De dentro dele: `GET /tenants` → 200; sem chave → 401. Público: `/`, `/auth/v1/health`, `/gateway/health` → 200; `/gateway/admin/*` → 404.
- Contrato em `/home/twadmin/gateway/docs/API_ADMIN.md`. A chave nunca vai ao navegador.

## Fase — Gateway no domínio existente (2026-10-08)

- Publicado `https://painel.luxbrain.com.br/gateway/health` pelo Caddy; `/gateway/` redireciona para o health.
- HTTPS corrigido com emissão Let's Encrypt após a mudança de DNS para `177.67.71.211`.
- Caddy conectado à rede dedicada `luxbrain_gateway_proxy`, declarada no Compose do serviço `proxy`. Somente webhooks, API de integração e health do gateway são encaminhados; gestão retorna 404.
- Adicionados filtros para ocultar query strings e chaves dos logs do proxy. Configuração validada antes de reload; serviços do painel não foram recriados.
- Verificados `/`, `/auth/v1/health` e `/gateway/health` por HTTPS: 200. Banco e autenticação do painel preservados.
- Gateway ainda simulado (`mock/dry`), sem interface de gestão. Detalhes em `/home/twadmin/gateway/docs/PUBLICACAO.md`; evolução do Skyone em `/home/twadmin/gateway/docs/SKYONE.md`.

## Fase — Painel mais moderno (2026-10-07 23:54)

- Mesmas cores do designer: creme no fundo, roxo na marca, ouro só na faixa e no monograma.
- Clientes e equipe ganharam resumo numérico, busca, cartões e lista com iniciais.
- A ficha do cliente mostra conexões em cartões e o formulário de acesso ao lado.
- O login ficou em um cartão. Conferido no navegador em tela larga e no celular.

## Fase — Menu enxuto (2026-10-07 23:26)

- Saíram do menu Integrações, Diagnóstico (Debug iFood e Debug 99Food) e Governança (Auditoria).
- O super admin fica só com Clientes. O cliente fica só com Equipe.
- Os atalhos dessas telas na ficha do cliente também saíram.
- Quem entra como cliente vai para Equipe.

## Fase — Menu lateral (2026-10-07 23:12)

- O cabeçalho com links em linha foi substituído por um menu lateral fixo.
- Os itens ficam em três grupos: Operação, Diagnóstico e Governança.
- No celular o menu abre por um botão e fecha ao escolher uma página.
- Conferido no navegador em desktop e em tela estreita, nas rotas Clientes, Integrações e Auditoria.

## Fase — Acesso marco.santos@ticway.com.br (2026-10-07 23:06)

- Usuário criado no GoTrue com e-mail confirmado e papel `super_admin`.
- O login foi testado na API de autenticação e retornou sucesso.
- A senha não foi registrada neste arquivo.

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
