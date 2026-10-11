# Proposta — telas de gestão por empresa

Data: 10/10/2026. **Aprovada pelo Marco com os ajustes abaixo. Implementação autorizada somente das telas 1, 2 e 9 (G1).**

Fontes consultadas em modo somente leitura: `../gateway/docs/ESPEC_GESTAO.md` (inclusive decisões aprovadas da seção 9) e `../gateway/docs/API_ADMIN.md`, especialmente “Gestão G1 — horários da unidade”. G1 fechado/publicado: `gateway:bb33dd5`, migração 024, conforme informado pelo Marco. O levantamento histórico de migrações da ESPEC não substitui esse contrato publicado.

Legenda: ✅ contrato disponível; ⏳ depende de contrato futuro; **PENDÊNCIA GATEWAY** = capacidade necessária sem contrato suficiente. As rotas de página abaixo são propostas para o painel, não novas rotas de API. Todas as rotas de API desta proposta são relativas a `/admin/v1/tenants/{t}`, salvo indicação explícita.

## 1. Levantamento do painel antes da implementação G1

### Stack, acesso e autenticação

- TanStack Start e Router, React 19, TypeScript, Tailwind 4, TanStack Query, Zod; Vite/Nitro, build com Bun e servidor Node em container. Componentes Radix/UI, Lucide, Sonner, React Hook Form e calendário disponíveis.
- Rotas protegidas em `src/routes/_authenticated/`; login validado no servidor pelo middleware `requireSupabaseAuth`. Perfil e vínculos são lidos no banco **do painel**, em `user_roles` e `tenant_users → tenants.gateway_tenant_id`. Isso não dá acesso ao banco do gateway.
- `src/lib/gateway/painel.server.ts` abre a sessão; `modulo.server.ts` resolve o tenant permitido e autoriza cada método/caminho/corpo. `plataforma` corresponde a `super_admin`; `admin` é administrador da empresa; `membro` é atendente. Tenant arbitrário enviado pelo navegador não amplia o acesso. Falha ao obter perfil recusa a operação.
- Funções `src/lib/gateway-*.functions.ts` recebem entradas tipadas, executam no servidor e chamam o cliente em `gateway/cliente.server.ts`. Base interna existente: `http://luxbrain-gateway:8000/admin/v1`, pela rede Docker `luxbrain_gateway_proxy`.
- O servidor usa `GATEWAY_PANEL_KEY` (credencial correspondente à `PANEL_SERVICE_KEY` do gateway). Nunca devolver chave, cabeçalho de autenticação ou URL interna ao navegador. Nenhuma conexão ao Postgres do gateway, nem para prévia, exportação ou histórico.
- **X-Actor já é enviado em todas as chamadas, inclusive GET:** `modulo.server.ts` obtém `perfil.email ?? perfil.userId` da sessão; o cliente sanitiza e põe o cabeçalho. Novas funções não aceitarão `actor`, papel ou cabeçalhos livres do navegador. Usar esse mesmo caminho para todas as rotas G1.
- No levantamento inicial, permissões permitiam CRUD básico de unidades ao admin da empresa; membro era recusado. A implementação G1 acrescenta regras explícitas para pausar/reabrir, horários, exceções e histórico, conforme seção 12. Não basta esconder botões.

### Rotas e telas existentes

| Área atual | Arquivos / páginas | Destino nesta fase |
|---|---|---|
| Empresas | `/ia/empresas`, `/ia/empresas/nova`; vínculo, cadastro e capacidade avançada | Preservar; acrescentar acessos à gestão da empresa selecionada |
| Agentes | `/ia/agentes`, `/ia/agentes/{id}`; visão, comportamento, conexão, canais e capacidade | Preservar; atendimento da empresa fica separado do comportamento individual |
| Canais, chaves, simulação, conversas | `/ia/canais`, `/ia/chaves`, `/ia/simular`, `/ia/conversas` | Preservar e reutilizar contexto de tenant/permissão |
| Unidades do gateway | Não há tela nem função de formulário dedicada; há regras de CRUD no módulo de permissões | Criar lista/detalhe G1; não há tela antiga a substituir |
| Catálogo/cardápio do gateway | Não há tela de gestão | Criar após G5 |
| Importação de catálogo do gateway | Não há tela | Criar após G6; não usar a importação antiga que desativa ausentes como se fosse mesclar |
| Pedidos do gateway | Não há tela | Criar após contrato G4; a API básica de pedidos já existe |
| Pedidos iFood/99Food | Abas de `/ifood-debug` e `/99food-debug` | São diagnósticos das integrações, não pedidos do gateway. Preservar |
| Auditoria do painel | `/auditoria` e administração/equipe/integrações | Preservar; histórico de gestão do gateway é outra tela e outra fonte |

### Reuso

`AppShell`, `PaginaGateway` (empresa efetiva e papéis), `CabecalhoPagina`, `Cartao`, `EstadoVazio`, `Etiqueta`, seletores de empresa, `RotuloCampo`/`Ajuda`, tabelas, abas, Dialog/AlertDialog, Sheet/Drawer, Input/Select/Switch, Calendar e Skeleton. Reutilizar convenções de Query, invalidação após escrita e erro seguro junto ao campo usadas no fallback/capacidade. Criar posteriormente editor semanal compartilhado e tabela de diferenças; nenhum deles existe como regra pronta de horário. Arrastar categorias precisa de implementação acessível, com botões subir/descer equivalentes; não pressupor biblioteca de drag-and-drop instalada.

## 2. Navegação e dependências

Empresa selecionada sempre visível. Proposta de páginas: `/ia/unidades`, `/ia/unidades/{id}` (Dados, Horários, Entrega e pagamento, Histórico), `/ia/atendimento`, `/ia/cardapio` (Itens, Categorias, Importação), `/ia/pedidos`, `/ia/gestao/alteracoes`. Cada acesso resolve novamente tenant e papel no servidor. Query keys incluem tenant e recurso; troca de empresa limpa seleção, páginas e rascunhos após aviso de alterações não salvas.

A numeração informal do pedido corresponde aos **assuntos**; a seção 8 da ESPEC usa os códigos abaixo, que serão usados para não confundir entregas:

| Tela | Bloco do contrato do gateway | Situação |
|---|---|---|
| 1 Unidades; 2 Horários; 9 Histórico | G1 — Horários da unidade | ✅ entregue; filtros G1.1 (`unidade_id`, `desde`, `ate`) em uso desde 10/10/2026 |
| 3 Entrega/pagamento; 8 Pedidos ampliados (referidos como bloco 3 no pedido) | G4 — Entrega e pagamento | ⏳ |
| 5 Cardápio; 6 Categorias (bloco 4 no pedido) | G5 — Cardápio | ⏳ |
| 7 Importação (bloco 5 no pedido) | G6 — CSV | ⏳ |
| 4 Atendimento (bloco 6 no pedido) | G3 — Fora do horário | ⏳ última entrega |

G2 é a Skill `info_unidades`, não uma dependência para o painel: nenhuma tela chama `/api/v1` ou usa a chave de Skills.

## 3. Tela 1 — Unidades ✅ G1

**Rotas:** `GET/POST /unidades`, `GET/PATCH /unidades/{id}`; `POST /unidades/{id}/pausar`, `POST /unidades/{id}/reabrir`. Desativação pelo campo `ativo`; não apresentar exclusão física.

Lista com nome/código, endereço resumido, fuso efetivo e situação. Edição de nome, código, endereço, telefone, ativa, WhatsApp de pedidos (`whatsapp_pedidos`) e fuso IANA (`fuso`; vazio envia null e herda a empresa; mostrar `fuso_efetivo`). Preservar campos não editados: enviar PATCH parcial, nunca limpar configurações de entrega existentes. Número de pedidos vazio: explicar que o pedido permanece disponível no painel e não terá esse destinatário de WhatsApp.

**O painel não calcula aberta/fechada.** Exibir a resposta `situacao`:

| Valor / motivo | Apresentação |
|---|---|
| `aberta_agora=true` | “Aberta”; “Fecha às …” se `fecha_as` vier preenchido |
| `aberta_agora=null`, `sem_horario` | “Horário não informado”, nunca “Fechada” |
| `false`, `inativa` | “Unidade inativa” |
| `false`, `pausa` | “Pedidos pausados até …” usando `pausada_ate`, ou “Pedidos pausados até reabrir” na pausa indefinida |
| `false`, `excecao` | “Fechada por horário especial/exceção” |
| `false`, `horario` | “Fechada neste horário” |
| Motivo desconhecido | Situação booleana recebida + “Motivo não informado”; não inferir regra |

`proxima_abertura` preenchida: mostrar data/hora. Nulo: não inventar próxima abertura nem promessa de retorno. Se a unidade está aberta, uma exceção não deve produzir selo de fechada. Motivos cadastrados pelo usuário são texto simples, sem HTML.

**Pausar pedidos:** modal com data e hora no fuso da unidade, opção “Hoje às HH:MM” (horário passado exige escolher outra data) ou “Até eu reabrir”, e motivo opcional de até 200 caracteres. Atalhos “30 min” e “1 h” calculam o instante no `fuso_efetivo` da unidade. “Até o fim do turno” só aparece quando `situacao.fecha_as` não é null e reenvia esse instante se ainda for futuro e couber em 60 dias. Enviar exatamente `{ate: ISO com fuso, motivo?}` OU `{indefinida: true, motivo?}`. Futuro e máximo 60 dias; erro 400 permanece junto ao campo/resumo se não houver campo. Informar que pausa com prazo termina sozinha, sujeita à grade/exceções. O atendente usa os mesmos atalhos; o servidor continua autorizando só a rota de pausa/reabertura.

**Hoje:** no topo da lista, a situação de cada unidade vem de `situacao` já recebida. Pausas ativas são as unidades com `motivo=pausa`. Exceções dos próximos sete dias vêm de `GET /agenda?dias=7` de cada unidade, só dias com `origem=excecao`. Cache curto compartilhado com o detalhe (20 s) e atualização a cada 30 s enquanto a aba está visível. Falha de uma agenda fica naquela unidade. O navegador não calcula abertura.

**Várias unidades (só plataforma e admin):** a seleção dispara uma chamada existente por unidade (`POST .../pausar` ou `POST .../excecoes`). O resultado é individual. Uma nova tentativa não reenvia o que já deu certo na mesma operação. O atendente é recusado no servidor, não só na tela. “Sugerir feriados nacionais do ano” lista datas fixas e móveis (Carnaval, Sexta-feira Santa, Corpus Christi); o usuário marca dias, unidades e se é fechado ou horário especial. Nada é criado antes da confirmação. Uma exceção já existente na data é substituída, e o texto de confirmação diz isso.

**Alertas na lista:** unidade ativa com `aberta_agora` null ou `motivo=sem_horario` (“Sem horário cadastrado”); unidade ativa sem `whatsapp_pedidos` (“Sem WhatsApp de pedidos”), só para quem recebe esse campo.

**Reabrir:** confirmação “Remover a pausa? O horário cadastrado continuará valendo”; POST sem inventar corpo. Não forçar aberta na interface: reler unidade/agenda e mostrar `situacao`, que pode continuar fechada. Desativar unidade é ação distinta de pausar.

Atualizar situação com refetch ao focar, após ações e atualização periódica enquanto visível (proposta: 30 s), sem relógio local decidir abertura. Falha de atualização mantém última informação identificada como desatualizada.

## 4. Tela 2 — Horários da unidade ✅ G1

**Rotas:** `GET /unidades/{id}`, `PUT /unidades/{id}/horarios`, `GET/POST /unidades/{id}/excecoes`, `DELETE /unidades/{id}/excecoes/{eid}`, `GET /unidades/{id}/agenda?dias=7`.

### Grade semanal

Sete dias (`seg`…`dom`), opção fechado e até 12 pares início/fim por dia. Formato HH:MM (00:00–23:59), início diferente do fim. Turno cujo fim é menor que início mostra “termina no dia seguinte”. “Copiar para outros dias” pede destinos e confirma substituição de turnos existentes. “Copiar grade de outra unidade” carrega a grade salva da origem no rascunho, depois de confirmar; só “Salvar a semana” grava. Editar localmente e salvar **a grade inteira**, não `{horarios: …}`. Dia ausente é fechado; grade vazia é “Horário não informado”, não uma instrução presumida de fechar todos os dias.

Validar formato, quantidade e sobreposição antes de enviar: considerar transbordo para o dia seguinte e domingo→segunda; intervalos adjacentes são distintos de sobrepostos. Isso só valida o formulário, não calcula situação operacional. Sempre mostrar também a recusa 400 do gateway; não tentar contornar uma validação com normalização silenciosa. Para fechar temporariamente uma unidade sem grade, usar pausa/exceção.

### Exceções

Lista por data, motivo e faixas/fechado; filtros documentados `desde` e `ate`. Sem filtros, a API começa em ontem; a tela deve indicar esse recorte e permitir consultar datas anteriores. Modal com data civil no fuso da unidade, “Fechado o dia inteiro” OU horários especiais. Enviar `{data, fechado:true, motivo?}` OU `{data, faixas, motivo?}`; omitir a alternativa não usada. Mesmas validações locais de faixas; limites finais seguem o gateway.

Criar na data existente **substitui** a exceção: mostrar a anterior e confirmar substituição. Excluir usa `eid` recebido, confirma e recarrega. Não dizer que uma exceção de dia fechado corta um turno iniciado na véspera: o contrato mantém esse turno até o fim. Mudança concorrente pode ser sobrescrita pela regra de substituição; não presumir ETag/controle de versão não documentado.

### Prévia dos próximos sete dias

Mostrar `agenda.dias` com `data`, `dia`, `origem` grade/exceção, `fechado`, `faixas`, `motivo`, e a `situacao` atual do retorno. `agenda.fuso` é a referência. Não recompor intervalos nem deduzir abertura a partir da grade no navegador. A prévia reflete o que está **salvo**: rascunho não salvo ganha aviso, sem simular uma API inexistente. Após salvar, recarregar agenda, lista e detalhe.

## 5. Tela 3 — Entrega e pagamento ⏳ G4

**Rotas previstas na ESPEC, ainda dependentes do contrato fechado:** `GET/PATCH /unidades/{id}`; `GET/POST/PUT /unidades/{id}/taxas`, `PATCH/DELETE /unidades/{id}/taxas/{tid}`; `GET/PUT /unidades/{id}/pagamentos`.

- Delivery (`delivery_ativo`) e retirada (`aceita_retirada`): sim/não/**não informado**. Não converter nulo em não.
- Taxa: não informada, fixa, bairro ou CEP. Tabela de bairros, apelidos, taxa, ativo e “Não atendido”; tabela de faixas inclusivas de CEP e taxa. Seleção do modo preserva dados salvos em outros modos, até contrato definir remoção explícita.
- Mínimo, frete grátis a partir de X, tempo de entrega/retirada, área/regras informativas. Vazio = não informado; R$ 0 é permitido para taxa, não para preço de item.
- Pagamentos ordenados: Pix, cartão na entrega, dinheiro com troco; rótulo, ativo e instruções. `formas_pagamento` legado permanece observação, não substitui tabela. Sem cobrança de pagamento pelo painel.
- Bairro desconhecido não é “não atendido”: pedir CEP; só CEP comprovadamente fora das faixas/bairro marcado gera fora da área. Sem faixas e bairro desconhecido, taxa a confirmar conforme decisão 9.9.
- Taxa de 13% do Einstein continua texto em regras, fora de qualquer cálculo.

**PENDÊNCIA GATEWAY:** fechar envelopes, IDs, limites, ordenação, conflitos entre apelidos/faixas e corpos de atualização. Não inventar tratamento de faixas sobrepostas nem simulação de frete via nova rota.

## 6. Tela 4 — Atendimento da empresa ⏳ G3

**Rotas previstas:** `GET/PUT /config`, `GET /atendimento/situacao`, `POST /atendimento/previa-mensagem`. A ESPEC permite herança no agente por PATCH; esta tela é da empresa e não sobrescreve ajustes dos agentes.

Horário do bot: sempre/unidades/próprio (`atendimento_horario_modo`); próprio abre editor semanal (`atendimento_horarios`). Fora do horário: mensagem automática/agente sem pedidos/pedido agendado (`fora_horario_modo`: `mensagem|sem_pedido|agendado`). Intervalo 1–72 h, padrão 6 (`fora_horario_intervalo_h`).

Editor `fora_horario_texto`, inserção assistida das variáveis `{nome_empresa}` e `{proxima_abertura}`; prévia pelo gateway, sem calcular abertura no painel. Texto aprovado:

> Oi! 😊 No momento a {nome_empresa} está fechada. Voltamos {proxima_abertura}. Quando abrirmos, é só mandar uma mensagem por aqui que a gente te atende!

Padrão para empresa nova: sempre. Decisão By Koji: unidades; unidade fechada recusa; agendamento desligado. São decisões de configuração, **não executar alterações automaticamente ao abrir ou implantar a tela**.

**PENDÊNCIA GATEWAY:** campo/contrato do seletor independente “Pedidos com unidade fechada: recusar/agendar” não está definido; a ESPEC relaciona isso ao modo fora do horário. Não inventar `pedido_modo` nem outro campo. Fechar também corpo da prévia, limites do texto/variáveis desconhecidas, efeito dos overrides e representação da situação quando unidades não têm horários. Esse ponto não bloqueia G1.

## 7. Tela 5 — Cardápio ⏳ G5

**Rotas existentes:** `GET /catalogo/itens` (`q, unidade, tipo, ativo, limite, cursor`) e `GET /catalogo/resumo`. **Previstas G5:** `POST /catalogo/itens`, `GET/PATCH/DELETE /catalogo/itens/{id}`, `POST .../{id}/em-falta`, `POST .../{id}/disponivel`, `POST /catalogo/itens/lote`, `POST .../{id}/copiar`.

Lista: nome, unidade, categoria, preço/não informado, disponibilidade. Busca e filtros por unidade/categoria/ativo/em falta/sem preço/delivery/alcoólico. **PENDÊNCIA GATEWAY:** nomes e semântica dos filtros ainda não documentados (especialmente sem preço, delivery, alcoólico); não filtrar só a página e apresentar como pesquisa completa.

Editor de item da unidade: código, categoria, nome/descrição, preço, tipo, álcool, delivery (`sim|nao|a_confirmar`), ativo, observação e ordem. Vazio no preço = null; zero recusado. Um item continua pertencendo a uma unidade, não criar tabela de preços por unidade dentro de um único item.

“Copiar para outras unidades”: escolher destinos e códigos novos, mostrar resumo; aguardar corpo fechado da cópia. A ESPEC prevê copiar para **uma** outra unidade por chamada; para vários destinos não prometer atomicidade global. Exibir resultado por destino e não repetir cópias já confirmadas.

Ações em lote (até 500 na proposta): ativar/desativar, em falta/disponível, categoria, com contagem e confirmação; endpoint transacional, erro não marca sucesso parcial. Seleção identifica IDs da mesma empresa e deixa explícito “itens selecionados”, não “todo o filtro” sem suporte.

“Em falta hoje” usa `{hoje:true}` no gateway; também até data/hora (`ate`) ou indefinido. Volta automática do gateway; mostrar `volta_em` quando contratado, sem job do painel. `disponivel` remove a falta; desativar é outra ação e preserva pedidos antigos.

## 8. Tela 6 — Categorias ⏳ G5

**Rotas previstas:** `GET/POST /catalogo/categorias`, `PATCH/DELETE /catalogo/categorias/{id}`, `PUT /catalogo/categorias/ordem`.

Categorias da **empresa**, compartilhadas entre unidades; filtro de unidade serve para contagem, não muda propriedade. Arrastar para ordenar, com subir/descer por teclado/celular e salvar ordem explícita. Renomear informa que todos os itens da empresa serão afetados; desativar confirma impacto na busca. Aguardar formato exato da lista de IDs e resposta; não inferir corpo `{ids: …}`. Falha ao salvar restaura ordem recebida, preservando rascunho para tentar novamente.

## 9. Tela 7 — Importação ⏳ G6

**Rotas previstas:** `GET /catalogo/modelo.csv`, `GET /catalogo/exportar.csv?unidade=`, `POST /catalogo/importar?simulacao=true&modo=mesclar|substituir&unidade=`, `GET /catalogo/importacoes`, `GET /catalogo/importacoes/{id}`, `POST /catalogo/importacoes/{id}/desfazer`.

Fluxo: baixar modelo → arquivo e escopo empresa/unidade → mesclar (padrão) ou substituir → simular → revisar novos, alterados com diferenças, desativados, inalterados e erros por linha → aplicar → resultado/histórico. Arquivo CSV UTF-8 com/sem BOM, 11 colunas atuais, limite atual 2 MB (reconfirmar em G6). Não enviar diretamente do navegador ao gateway; corpo passa pelo servidor autenticado, sem logs do arquivo.

Substituir: aviso de alcance, contagem de desativações e confirmação explícita; enviar `confirmar_desativacao=<quantidade>` apenas conforme localização definida no contrato final. Erro em qualquer linha impede aplicação. Mudou arquivo/modo/escopo? Invalidar prévia e confirmação. Mudança concorrente/contagem divergente exige nova simulação, nunca confirmar automaticamente o número novo. Exportação via servidor com download e escopo autorizado.

Histórico das 20 últimas importações por empresa **somente para consulta**. Desfazer apenas a mais recente, com confirmação explícita: “Edições manuais feitas depois desta importação serão perdidas”. Decisão aprovada; deixa de ser pendência de produto. G6 ainda precisa fechar paginação, elegibilidade, corpo/resposta e vínculo prévia→aplicação. Não criar token de prévia inexistente.

## 10. Tela 8 — Pedidos ⏳ PED1 (quadro, status e avisos) e G4 (pagamento)

O quadro, a lista, o detalhe operacional, os avisos editáveis e a correção de Conversas estão em `docs/ESPEC_TELAS_PEDIDOS.md`. Esta seção guarda só o que continua pendente de G4.

**Rotas já disponíveis:** `GET /pedidos?status=&unidade=&limite=&cursor=`, `GET /pedidos/{numero}`, `POST .../{numero}/confirmar`, `POST .../{numero}/recusar` (motivo). **Campos ampliados dependem G4:** bairro, CEP, pagamento, troco, agendado_para, frete_gratis e tempo_estimado_min; taxa/total vêm do gateway.

Lista com número, unidade, cliente, modalidade, status e total. Detalhe do pedido fechado, itens copiados, endereço/bairro/CEP, taxa/frete grátis, mínimo quando retornado, pagamento/troco, agendamento e prazo estimado. Não recalcular total nem aplicar preços novos ao pedido antigo. Datas no fuso da unidade.

Só permitir decisão de aguardando_loja. Conflito 409 `detalhes.status`: recarregar e avisar “Este pedido já foi decidido”; não sobrescrever decisão do WhatsApp/outro atendente. Erros de negócio do gateway: unidade fechada (com próxima abertura), fora da área, bairro não reconhecido (pedir CEP), abaixo do mínimo (`abaixo_minimo` substitui `abaixo_do_minimo` em G4), pagamento inválido, item em falta e delivery indisponível. Esses são motivos de validação, não inventar enum obrigatório para o motivo livre de recusa da unidade.

**PENDÊNCIA GATEWAY:** publicar os novos campos/envelopes/motivos no contrato administrativo G4 e fuso para representação do agendamento; não usar os endpoints de carrinho/Skills para completar a tela.

## 11. Tela 9 — Histórico de alterações ✅ G1 e filtros G1.1

**Atualização 10/10/2026:** `API_ADMIN.md` publica `unidade_id`, `desde` e `ate`. O painel envia esses parâmetros. `unidade_id` traz a unidade e as exceções dela e não é combinado com `entidade`/`entidade_id` (a tela limpa um quando o outro é usado; o servidor também recusa). O período usa o `timezone` do tenant (`GET` da raiz do tenant, já existente). O navegador recebe só `{timezone, origem}`. Se o valor não vier ou não for um fuso IANA, o filtro usa `America/Sao_Paulo` e a tela avisa. `desde` é o início do dia nesse fuso; `ate` é o início do dia seguinte, exclusivo. Data sem fuso continua recusada. O identificador exato permanece para uma alteração específica.

**Rota:** `GET /gestao/alteracoes?entidade=&entidade_id=&unidade_id=&desde=&ate=&limite=&cursor=`. Resposta `itens`, `proximo_cursor`; mais recentes primeiro, cursor ID. Paginar com “Carregar mais”, preservando filtros; sem presumir total de registros.

Linha: quando, quem (`actor`), entidade, ação e resumo; expansão lado a lado Antes/Depois somente dos campos alterados que vieram no JSON. Ausente é diferente de null, false e zero. Telefone já vem mascarado: exibir assim, nunca buscar o número completo para enriquecer histórico. Não chamar a auditoria do painel como substituta.

Entidades G1: `unidade` (id da unidade; criado/alterado/pausado/reaberto/horarios) e `excecao` (entidade_id = `<unidade>:<data>`; criado/alterado/removido). Não esperar linha para alteração sem efeito. Outros tipos entram apenas com os respectivos blocos.

- Filtro por entidade: disponível.
- Histórico de uma unidade para entidade `unidade`: usar id exato, disponível.
- Histórico de uma exceção específica: usar id composto exato, disponível.
- Filtro da unidade com as exceções: `unidade_id` do contrato G1.1. Não usar busca por prefixo em `entidade_id`.
- Filtro de período: `desde` e `ate` com fuso, como no contrato. Não filtrar só a página carregada.
- `criado_em`: exibir no fuso/offset que vier. Se não tiver offset, mostrar “horário do servidor”. Não converter o registro para o fuso do navegador. O filtro de período usa o fuso da empresa; Brasília só entra quando esse fuso não está disponível.

## 12. Permissões aprovadas

Autorização no servidor, por rota e campos, empresa da sessão. Plataforma escolhe tenant; admin/membro apenas a própria empresa. Não há escopo de filial por usuário.

| Ação | Plataforma | Admin da empresa | Membro/atendente |
|---|---|---|---|
| Ler unidades, situação e agenda | Sim | Sim | Sim |
| Pausar/reabrir pedidos da unidade | Sim | Sim | Sim, apenas rotas específicas |
| Criar/editar/desativar unidade, WhatsApp/fuso | Sim | Sim | Não; PATCH recusado |
| Grade e exceções | Sim | Sim | Não |
| Pausa ou exceção em várias unidades, inclusive feriados | Sim | Sim | Não; recusado no servidor |
| Taxas/pagamentos | Sim | Sim | Não |
| Preço, item, categoria, cópia e lote | Sim | Sim | Não |
| Importar/exportar/desfazer | Sim | Sim | Não |
| Marcar em falta/disponível (G5) | Sim | Sim | Sim, apenas ações específicas |
| Textos/horário do bot | Sim | Sim | Não |
| Histórico | Sim | Sim | Não |
| Consultar/confirmar/recusar pedidos (quando houver tela) | Sim | Sim | Sim |

G1 não habilita ações de G5 ou Pedidos antecipadamente. Member recebe projeção de unidade sem grade ou configurações de gestão. X-Actor vem exclusivamente da sessão. Capacidade, chaves e conexão IA seguem exclusivas da plataforma.

## 13. Validações, datas e respostas de erro

- R$: máscara pt-BR; enviar valor numérico no formato contratual, sem `R$`/separadores de milhar. Não usar floats locais para recalcular total. Taxas/mínimo/frete/troco não negativos; preço estritamente positivo ou null. Tempo em minutos inteiro e limites segundo contrato fechado. Troco ≥ total e forma válida é regra final do gateway.
- CEP: máscara `00000-000`, enviar 8 dígitos, preservar zeros iniciais; faixas inclusivas início ≤ fim. Detectar sobreposição visualmente; regra de resolução/recusa aguarda G4.
- Telefone: normalizar para dígitos com DDI, **10 a 15 dígitos** (limite E.164). Vazio = null quando permitido. Divergência com a regra 8–16 atual fica como pendência de alinhamento para o gateway; o painel já aplica o limite aprovado.
- Horas/datas: grade HH:MM e data de exceção YYYY-MM-DD sem converter dia civil para UTC. Instantes de pausa com offset; input datetime-local interpretado explicitamente em `fuso_efetivo`, nunca no fuso do computador. Horas ambíguas/inexistentes em mudança de horário de verão exigem escolha/erro claro; não deslocar silenciosamente. O servidor final valida o instante.
- Situação e agenda exclusivamente do gateway; datas exibidas no fuso da unidade, com indicação de fuso na edição e onde houver comparação. Mudança de fuso pede confirmação e recarga da prévia; não converter silenciosamente HH:MM cadastrado.
- `{"erro":{codigo,mensagem,detalhes}}`: manter mensagem legível do gateway, mapear `detalhes.campo` para o campo/linha; se não houver correspondência, resumo do formulário com foco acessível. Não repassar detalhes arbitrários, credenciais ou logs. Adaptar padrão de erro seguro de fallback/capacidade, pois `comGateway` genérico reduz erro a texto e perde campo.
- 400/422 mantém rascunho; 401 pede login quando for sessão do painel (falha de credencial de serviço vira indisponibilidade, sem revelar chave); 403 acesso recusado; 404 recurso removido/indisponível; 409 conflito e recarga; 429 respeita Retry-After; 5xx permite tentar novamente sem perder edição. Não repetir automaticamente POST de escrita após resposta incerta.

## 14. Estados e celular

- Carregamento: skeleton e ações desativadas, sem mostrar “Fechada”/zero por ausência de resposta. Separar falha na lista, detalhe, prévia e salvamento.
- Vazios: “Nenhuma unidade cadastrada” + criar se permitido; grade “Horário não informado”; “Nenhuma exceção neste período”; catálogo vazio/importar quando disponível; nenhum resultado de filtro + limpar; pedidos vazios; nenhuma alteração registrada.
- Erro: mensagem, tentar novamente para leitura, preservar rascunho em escrita, foco no campo/alerta e resultado perceptível por leitor de tela. Sucesso só após resposta confirmada; refetch de recursos dependentes. Rascunho não salvo tem aviso ao sair/trocar empresa.
- Celular: unidades em cartões com situação e botão Pausar/Reabrir visível, modal/drawer com empresa/unidade e fuso; confirmação, indicador de envio, alvo de toque ≥44 px. Sem menu profundo para ação rápida.
- Cardápio móvel: cartão com unidade, preço e disponibilidade; “Em falta hoje” e “Disponível” para papéis autorizados, confirmação curta e atualização pela resposta do gateway. Ação em lote mostra quantidade persistente no rodapé; tabela de horários vira blocos por dia; diferenças do histórico empilhadas Antes/Depois.
- Paginação explícita; não carregar todo histórico/catálogo no navegador para fazer filtros ausentes no servidor.

## 15. Pendências para o gateway e ordem de execução

| Pendência | Impacto |
|---|---|
| Histórico: filtros por período e unidade agregando exceções | Atendido no painel com o contrato G1.1 (`unidade_id`, `desde`, `ate`) |
| Histórico: documentar limite permitido | Evitar limites/fuso presumidos |
| G4: fechar taxa/pagamento, validação de faixas/apelidos, payload dos pedidos novos | Telas 3 e 8 aguardam |
| G3: relação entre modo fora do horário e modo independente recusa/agendamento; prévia | Tela 4 aguarda |
| G5: todos os filtros, corpos de cópia/lote/ordem e falta | Telas 5 e 6 aguardam |
| G6: contrato final para desfazer só a mais recente; localização da confirmação/concorrência | Tela 7 aguarda |
| Telefone E.164 versus regra atual de 8–16 dígitos | Alinhar validação final; G1 usa formato documentado |

1. Especificação e matriz aprovadas; implementar somente G1.
2. Implementar **1, 2 e 9 primeiro**, só contratos G1 fechados: funções de servidor, regras de acesso/X-Actor, lista/detalhe, grade, pausa/exceções/agenda e histórico paginado. Filtros de histórico ausentes permanecem indicados como pendentes.
3. Testar isolamento/roles/Actor forjado, mensagens de erro, horário nulo, transbordo de meia-noite, sobreposição, pausa expirada/indefinida, substituição de exceção e diferenças mascaradas, além de celular/teclado. Situação expirada é comprovada por resposta do gateway, não algoritmo do painel.
4. Após G4 fechado: telas 3 e 8. Após G5: 5 e 6. Após G6: 7. Após G3: 4. Não publicar campos supostos como se estivessem disponíveis nem chamar endpoints de Skills.
5. Cada futura implementação segue testes/commit e publicação autorizada com tag da imagem em uso `painel:<commit>`, backup e validações; só painel recriado, segredo ausente do bundle, gateway preservado. Publicação G1 autorizada pelo Marco; unidades reais apenas em leitura nos testes.

**Ponto de parada: concluir G1, publicar com validações e aguardar revisão do Marco. Demais blocos não autorizados nesta entrega.**
