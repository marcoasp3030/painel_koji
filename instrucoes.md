## PED1-b — avisos de pedido (11/10/2026)

- Publicado `painel:6027ea7`: X-Role da sessão em todas as chamadas administrativas; Configurações → Avisos de pedido por status/modalidade, prévia e padrão; reenvio na linha do tempo com confirmação e tratamento de entrega incerta. Contador existente preservado.
- 87 testes aprovados, 6 integrações REST antigas ignoradas, zero falhas. TypeScript, lint, builds e bundle aprovados. Validação autenticada: 12 avisos, prévia e contagem; zero escritas/envios em produção.
- Imagem de volta `painel:54188e4` conferida antes do build. Backup validado em `/home/twadmin/backups/painel/pre-ped1b-20261011T030002Z`, permissões 700/600. Só painel recriado; zero segredos nos logs, gateway intocado, nenhum prune.
- Relatório completo, volta e conferência visual: `docs/VALIDACAO_PED1B_PAINEL.md`. Alterações locais anteriores preservadas separadamente no commit `54188e4`. Parar para validação do Marco; PED1-c não iniciado.

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
- Imagem de volta atual: `painel:pedidos-20261010` (`sha256:dbb0b27a…`, primeira versão da tela de Pedidos, antes do novo layout). Tags anteriores preservadas: `painel:conversas-20261010`, `painel:operacao-20261010`, `painel:ux-20261010` e `painel:76a6b7a`.

## Pedidos — layout (2026-10-10 22:50)

- Só `Pedidos.tsx` mudou; regras, rotas e permissões iguais. Indicadores clicáveis no topo, barra única (busca, Quadro/Lista, Filtros, som), filtros recolhíveis com fichas, colunas com rolagem própria, lista em tabela e detalhe em painel lateral com ações no rodapé.
- Backup `/home/twadmin/backups/painel/pre-pedidos-layout-20261011T014936Z` (279 entradas, SHA-256 `e283e82bea49e5f1011c92594b7982e2e2ee13c89ab5bea204eed70bf0e0967d`).
- Publicação: imagem `sha256:9ae1c74e37140c5db8fd7799c19768dd0f337ce5cb41468cb5343f59f45b8ca6`, container `fdb7ffde05a9`. Somente o painel recriado; chave fora do bundle; rotas públicas 200; admin do gateway 404; segredos nos logs zero.
- Volta: `docker tag painel:pedidos-20261010 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.

## Pedidos — PED1-a (2026-10-10)

- Contrato usado: `gateway/docs/ESPEC_PED1.md`, seção 12, somente leitura. Nenhuma rota do PED1-b ou PED1-c foi autorizada.
- Tela `/ia/pedidos` para plataforma, admin e atendente. Quadro por status, lista com filtros, detalhe, linha do tempo e atalho para a conversa. Ações somente a partir de `proximos_status`. Cancelamento exige motivo com 3 caracteres antes de qualquer chamada. Previsão de 1 a 600 minutos só ao confirmar ou iniciar o preparo.
- No 409 com `detalhes.campo=status` a mensagem é “Este pedido já foi atualizado” e o detalhe é recarregado. Os motivos `status_final`, `mesmo_status`, `nao_pode_voltar`, `modalidade_incompativel` e `recusa_so_aguardando` não aparecem como texto principal.
- Contagem a cada 15 s com a aba visível. O número no menu é `aguardando_loja.total`. O som é preferência local do usuário e começa desligado.
- O período dos filtros usa o fuso da empresa já lido na gestão. Se não houver fuso, usa Brasília e avisa. O atendente continua sem ler a raiz do tenant, então vê o aviso e o período em Brasília.
- Fora deste bloco: textos dos avisos, reenvio, `X-Role`, nome por prioridade e filtro de encerradas.
- Testes: 81 aprovados, 6 integrações REST antigas ignoradas. TypeScript e ESLint dos arquivos tocados aprovados.
- Imagem de volta conferida antes do build: `painel:conversas-20261010` (`sha256:7798ecc08ebb0cdbac22435ae01d8d9fcf30a12cf5757c0bbfde5dfe3f71134b`). `painel:operacao-20261010`, `painel:ux-20261010` e `painel:76a6b7a` permanecem intactas.
- Backup `/home/twadmin/backups/painel/pre-pedidos-20261011T014002Z`, diretório 700, dump/ambiente/Compose 600; `pg_restore --list` com 279 entradas. SHA-256 `86fa1deb984fa2cd7340a983861d21253fbf5bf0164f22462e96c75b0f530cd7`.
- Volta sem mudança de schema: conferir `docker image inspect painel:conversas-20261010`, executar `docker tag painel:conversas-20261010 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Não restaurar o dump.
- Publicação: imagem `sha256:dbb0b27ad1d6e6eb221710d33f6fba91ee0641a6548f7d11c55b1a0a80b39e7c`, container `79f702bd4226`. Bundle com zero valor de chave e zero referências no front. Somente o painel foi recriado. Nenhum prune. `/`, `/ia/pedidos`, `/ia/conversas`, `/ia/unidades`, `/ia/gestao/alteracoes`, health da autenticação e do gateway → 200; admin público do gateway → 404. Segredos nos logs do painel novo: zero. Uma linha de log, zero erros. A navegação autenticada desta sessão não foi feita.

## Pedidos e Conversas — especificação (2026-10-10)

- Só levantamento e especificação em `docs/ESPEC_TELAS_PEDIDOS.md`. Nenhuma tela, rota ou chamada nova foi implementada.
- Fonte do contrato novo: `gateway/docs/ESPEC_PED1.md`, ainda não implementado no gateway. O que não está no `API_ADMIN.md` ficou marcado como pendência. Pagamento e troco continuam pendência G4.
- Conversas já pode corrigir estado, canal e máscara de telefone com os campos publicados. Nome por prioridade, unidade preferida, filtro `estado` e a tela de Pedidos esperam o PED1.
- Aguardando aprovação antes de implementar.

## Conversas — estado, canal e telefone (2026-10-10)

- Aprovado seguir só a seção 3 de `docs/ESPEC_TELAS_PEDIDOS.md`. Pedidos, avisos e campos do PED1-c não foram criados.
- A lista e o cabeçalho derivam o estado de `encerrada_em`, `aguardando_atendente_desde`, `status` e `bot_pausado_ate`. O canal junta `canal` (tipo) com o nome de `GET /canais`. Telefone de 13 dígitos `55` + DDD + celular vira `+55 11 9xxxx-xxxx`; outro identificador permanece como veio. O nome é o campo `nome`, senão o telefone, senão “Contato”.
- O filtro de atendimento continua `status=ativa|pausada` e `aguardando=true`. Encerrada não é filtro de servidor.
- Testes: 76 aprovados, seis integrações REST antigas ignoradas, 560 expectativas. TypeScript aprovado.
- Imagem de volta conferida antes do build: `painel:operacao-20261010` (`sha256:88ec9e1cbb4e250820465d91c7cf3b05b1a45fa9246018de351922f0679862ce`). `painel:ux-20261010` permanece `sha256:19ff368435de8df23855004ebbb3f2fec23cf2edf82f84206f9d30e89db39883`.
- Backup `/home/twadmin/backups/painel/pre-conversas-20261011T010959Z`, diretório 700, dump/ambiente/Compose 600; `pg_restore --list` com 279 entradas. SHA-256 `857cf362cf53e39ab2ac19757a9f9844c69effe6eae1c057a490d6bf0875b826`.
- Volta sem mudança de schema: conferir `docker image inspect painel:operacao-20261010`, executar `docker tag painel:operacao-20261010 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Não restaurar o dump.
- Publicação: imagem `sha256:7798ecc08ebb0cdbac22435ae01d8d9fcf30a12cf5757c0bbfde5dfe3f71134b`, container `bd30f1c51470`. Bundle com zero valor de chave e zero referências no front. Somente o painel foi recriado. Nenhum prune. `/`, `/ia/conversas`, `/ia/unidades`, `/ia/gestao/alteracoes`, health da autenticação e do gateway → 200; admin público do gateway → 404. Segredos nos logs do painel novo: zero. Uma linha de log, zero erros. A navegação autenticada desta sessão não foi feita.

## Operação do dia — Unidades (2026-10-10)

- Sem rota nova no gateway. A visão Hoje lê `situacao` da lista e `GET /unidades/{id}/agenda?dias=7` de cada unidade. Pausas ativas são `motivo=pausa`. Exceções são dias com `origem=excecao`. Cache de 20 s, atualização de 30 s só com a aba visível. O navegador não calcula abertura.
- Pausa rápida, também para o atendente: “30 min” e “1 h” no `fuso_efetivo`; “Até o fim do turno” só quando `situacao.fecha_as` não é null. Continua o `POST .../pausar` já existente.
- Várias unidades, só plataforma e admin: uma chamada por unidade, resultado individual, e a repetição não reenvia o que já deu certo. O atendente é recusado no servidor. Feriados nacionais (fixos e móveis: Carnaval, Sexta-feira Santa, Corpus Christi) só são criados depois da confirmação; data já existente é substituída.
- “Copiar grade de outra unidade” entra no rascunho e só grava em “Salvar a semana”. Alertas: unidade ativa sem horário e, para quem vê o campo, unidade ativa sem WhatsApp de pedidos.
- Histórico: o período usa o `timezone` do tenant. O navegador recebe só esse fuso e a origem. Se o valor faltar ou não for IANA, fica `America/Sao_Paulo` e a tela avisa. Não há pendência de contrato: o campo já existe no tenant.
- Testes: 75 aprovados, seis integrações REST antigas ignoradas, 542 expectativas. TypeScript aprovado. Lint sem erros; avisos Fast Refresh do hook de gestão. Nenhuma unidade real alterada.
- Imagem de volta conferida antes do build: `painel:ux-20261010` (`sha256:19ff368435de8df23855004ebbb3f2fec23cf2edf82f84206f9d30e89db39883`). `painel:76a6b7a` permanece `sha256:a96487fd9e9154c862f1af6caa0f0090dd8ae764a02c14c275822a8bb20463f0`.
- Backup `/home/twadmin/backups/painel/pre-operacao-g1-20261010T222254Z`, diretório 700, dump/ambiente/Compose 600; `pg_restore --list` com 279 entradas. SHA-256 `7c6265c469013834be08d70c87e321c2ae76f4899f96fc32f6bd0b941a1c7ccb`.
- Volta sem mudança de schema: conferir `docker image inspect painel:ux-20261010`, executar `docker tag painel:ux-20261010 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Não restaurar o dump.
- Publicação: imagem `sha256:88ec9e1cbb4e250820465d91c7cf3b05b1a45fa9246018de351922f0679862ce`, container `611700e17dd7`. Verificação do bundle: zero valor de chave e zero referências no front. Somente o painel foi recriado. Gateway, workers, agendador, bancos, Redis, autenticação, REST e proxy mantiveram os IDs. Nenhum prune. `/`, `/ia/unidades`, `/ia/gestao/alteracoes`, `/ia/conversas`, health da autenticação e do gateway → 200; admin público do gateway → 404. Segredos nos logs do painel novo: zero. Uma linha de log, zero erros. A navegação autenticada desta sessão não foi feita.

## Revisão de uso — Unidades e histórico (2026-10-10)

- Unidades: a lista mostra situação e os botões Agenda, Horários e Exceções. Um clique abre a seção. No computador a lista fica ao lado; no celular a lista some enquanto a unidade está aberta. Pausar, reabrir e editar dados continuam na própria lista. A troca de seção só pede confirmação se houver rascunho. A grade resume os sete dias e abre o editor de um dia; “Dias úteis” copia os turnos. A exceção abre num formulário, não no fim da lista. Salvar a grade grava a semana inteira.
- Histórico: escolha a unidade pelo nome (`unidade_id`, inclui as exceções dela) e o período em horário de Brasília (`desde` inclusivo, `ate` exclusivo no dia seguinte). O identificador exato continua disponível e não é enviado junto com a unidade. Cada linha mostra a ação e os campos; antes/depois abre sob demanda. Telefone segue mascarado e a data da linha preserva o offset recebido.
- Contrato usado: `API_ADMIN.md`, filtros G1.1. Sem período inventado só na página e sem busca por prefixo.
- Imagem de volta conferida: `painel:76a6b7a` (`sha256:a96487fd9e9154c862f1af6caa0f0090dd8ae764a02c14c275822a8bb20463f0`). Backup `/home/twadmin/backups/painel/pre-ux-gestao-20261010T215017Z`, diretório 700, dump/ambiente/Compose 600; `pg_restore --list` com 279 entradas. SHA-256 `5b98ac2f387b4f552ae6e9132948409a97ab723c5e36dd30a1748e4aac452e20`.
- Volta sem mudança de schema: conferir `docker image inspect painel:76a6b7a`, executar `docker tag painel:76a6b7a painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Não restaurar o dump sobre o banco em uso.
- Testes: 73 aprovados, seis integrações REST antigas ignoradas. TypeScript aprovado. Lint sem erros; permanece o aviso Fast Refresh do hook de gestão.
- Publicação: build e verificação do bundle aprovados (zero valor de chave e zero referências internas no front). Somente o painel foi recriado. Gateway, workers, agendador, bancos, Redis, autenticação, REST e proxy mantiveram os IDs. `/`, `/ia/unidades`, `/ia/gestao/alteracoes`, `/ia/conversas`, health da autenticação e do gateway → 200; admin público do gateway → 404. Segredos nos logs do painel novo: zero. Nenhuma unidade alterada. A navegação autenticada no navegador não foi feita: a sessão desta revisão caiu na tela de acesso.

## Gestão G1 — Unidades, horários e histórico (2026-10-10)

- Escopo autorizado: telas 1, 2 e 9. Unidades/agenda para plataforma, admin e membro; membro pausa/reabre apenas pelas rotas específicas, sem PATCH, grade, exceções ou histórico. Resposta de unidade ao membro omite grade e campos de gestão. Papéis e tenant resolvidos no servidor; X-Actor exclusivamente da sessão; entradas estritas recusam actor forjado e campos adicionais.
- `/ia/unidades`: lista em cartões, situação diretamente do gateway, “Horário não informado” para null, pausa com data/hora no fuso da unidade ou indefinida, reabertura sem forçar aberta. Detalhe na mesma página com agenda de sete dias, edição parcial dos dados, grade semanal e exceções. Ações rápidas com alvos mínimos de 44 px; modais adaptados ao celular.
- Grade com até 12 turnos, validação HH:MM/meia-noite/sobreposição inclusive domingo→segunda; copiar dias com confirmação. Exceção cria/substitui por data após conferir a existente. Agenda reflete só configuração salva. Fuso IANA, pausa futura até 60 dias, telefone normalizado 10–15 dígitos com DDI. Erros seguros com campo e rascunho preservado.
- `/ia/gestao/alteracoes`: entidades G1, identificador exato e paginação por cursor, antes/depois dos campos recebidos e telefone já mascarado. Sem filtro de período e sem agregação unidade+exceções. Datas preservam offset recebido; sem offset mostram “horário do servidor”.
- ESPEC atualizada com decisões do Marco: matriz de papéis, importações futuras (20 para consulta; desfazer só mais recente com perda de edições posteriores), códigos G1–G6 e divergência de telefone como pendência para o gateway. G3–G6 não implementados.
- Imagem anterior `painel:e2f8cd9` conferida, ID `sha256:212bef92ce7e1d7b88d852f1e46ae825f1fbe4f49765eb41c662d54a01b06981`. Backup `/home/twadmin/backups/painel/pre-gestao-g1-20261010T204453Z`, diretório 700, dump/ambiente/Compose 600; `pg_restore --list` válido. SHA-256 `b6340e2c0b1d141819eec4e2eba1a4524875fe49a0b934d8fbad6896b02393c8`.
- Volta (sem alteração de schema): conferir `docker image inspect painel:e2f8cd9`, executar `docker tag painel:e2f8cd9 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Preservar banco e ambiente atuais; não restaurar dump sobre o banco em uso.

- Validação final: **72 testes aprovados**, seis integrações REST antigas ignoradas; TypeScript aprovado; lint zero erros (três avisos Fast Refresh). Build aprovado. Testes cobrem isolamento, membro, actor, projeção segura, horários/pausas/exceções, telefone e erros por campo.
- Produção, somente leitura: quatro unidades By Koji com detalhe, quatro agendas de sete dias, exceções e histórico pela função autenticada do painel → OK; zero escritas. Páginas e health → 200; admin público do gateway → 404. Zero segredos no bundle/logs. Somente painel recriado; IDs dos demais serviços permanentes preservados.
- Sem unidade de teste criada, sem alteração em unidade real, sem alteração no repositório gateway, sem prune ou migração. Nenhuma falha pós-publicação ou rollback. Relatório e descrição das telas em `docs/VALIDACAO_G1_PAINEL.md`; revisão visual no navegador com Marco. Parada ao fim de G1.

## Fase — Limites de capacidade no painel (2026-10-10)

- Empresa → Editar → Avançado: `max_lotes_simultaneos` por PUT no config. Agente → Avançado: `max_concorrencia` por PATCH. Formulários exclusivos da plataforma; leitura e escrita conferem o perfil no servidor antes de chamar o gateway. Admin da empresa e membro recusados mesmo com chamadas forjadas.
- Inteiros 1–100; Voltar ao padrão envia null. Padrão da plataforma 5; agente mostra o valor real de `configuracao_efetiva` e respeita herança empresa/modelo após reset. Ajuda com fórmula de capacidade, validação local/servidor e erros `detalhes.campo` junto ao campo. Sem alterar modos do agente ou outros campos.
- Testes: 60 aprovados, seis cenários REST antigos ignorados por falta de ambiente próprio; TypeScript e lint aprovados. Testes cobrem papéis, acesso cruzado recusado, PUT/PATCH exatos, null, limites, herança e erros de campo sem detalhes adicionais.
- Imagem de volta conferida: `painel:4f0eaea` (`sha256:ec29b1c9398b17576181189c2113b944b6f177ae554e0c05a91a3a325c6c3b2f`). Backup `/home/twadmin/backups/painel/pre-capacidade-20261010T014040Z`, diretório 700, dump/ambiente/Compose 600, `pg_restore --list` aprovado. SHA-256: `ea03f1a5d5bdcd4ccaa2374db8b9a1ab15961e5b70c9f67cb273c3c22db30e5c`.
- Volta sem mudança de schema: conferir `docker image inspect painel:4f0eaea`, executar `docker tag painel:4f0eaea painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Não restaurar dump sobre a base em uso.

- Publicação: build e verificação de bundle aprovados (zero chaves e referências internas no front); somente painel recriado, IDs dos serviços permanentes do gateway, bancos, Redis, autenticação, REST e Caddy preservados. Nenhum arquivo do gateway editado.
- HTTP após subida: `/`, `/ia/empresas`, `/ia/agentes`, `/ia/conversas`, health da autenticação e gateway → 200; admin público do gateway → 404. Segredos nos logs do painel: zero ocorrências.
- Funções HTTP autenticadas: GET de capacidade By Koji → 30; agente `bykoji_atendimento` → 30, igual à configuração efetiva do GET do agente. Valor 101 nos dois formulários → erro no respectivo campo, sem gravar. Nenhum limite ou modo alterado; escritas válidas/null verificadas com transporte simulado nos testes. A primeira verificação HTTP foi iniciada enquanto o container ainda era recriado e retornou 500; repetida após conclusão da subida com os identificadores atuais das funções → aprovada. Volta não necessária.
- Conferência visual pelo Marco: Avançado da empresa/agente, valor em vigor, ajuda, erros 0/101/fracionado, salvar e reset em empresa de teste; ausência desses controles para usuários da empresa.

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
