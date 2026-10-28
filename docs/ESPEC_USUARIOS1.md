# USUARIOS1 — papéis por empresa e escopo por unidade

**Situação: proposta para revisão. Nada implementado. O gateway não foi alterado.**

Consulta ao banco do painel em 28/10/2026, 14:07 (Brasília). Horários abaixo estão em Brasília.

## 1. O que existe hoje

Há dois cadastros, e o papel que vai ao gateway nasce da combinação dos dois. O navegador não escolhe o papel.

| Onde | O que guarda | Valores |
|---|---|---|
| `public.user_roles` | papel global da conta (`app_role`) | `super_admin`, `tenant_admin`, `tenant_user` |
| `public.tenant_users` | vínculo com uma empresa do painel | `is_tenant_admin` verdadeiro ou falso |
| `public.tenants` | a empresa e o id dela no gateway | `gateway_tenant_id` |

O servidor lê isso em `carregarPerfil` (`src/lib/gateway/painel.server.ts`) e `resolverTenant` (`src/lib/gateway/modulo.server.ts`) decide o `X-Role`:

1. Se a conta tem `super_admin`, o papel é `plataforma`. A empresa vem da escolha na tela. Não vai `X-Tenant-Scope`.
2. Senão, o vínculo ativo da empresa escolhida decide: `is_tenant_admin` verdadeiro vira `admin`; falso vira `membro`.
3. `cliente.server.ts` manda `Authorization: Bearer` (a chave única de hoje), `X-Actor` (e-mail da sessão) e `X-Role` com um destes três: `plataforma`, `admin`, `membro`. Qualquer outro texto seria trocado por `membro` antes de sair.

O comentário do código chama `membro` de atendente. Esse nome não existe no banco, nem no enum, nem na tela. A tela Equipe (`/equipe`) mostra “Administrador” ou “Usuário”.

A palavra “atendente” que a pessoa vê em Conversas é o estado da conversa (o robô está pausado e um humano assumiu). Continua sendo estado da conversa. Não é um login.

### Empresas

| Empresa | Slug | Gateway | Situação |
|---|---|---|---|
| Luxbrain Testes | luxbrain-testes | `luxbrain_testes` | ativa, 1 vínculo |
| Luxtia | luxtia | sem vínculo | ativa, 0 vínculos |
| koji | koji | `bykoji` | ativa, 0 vínculos |

### Contas

| E-mail | `user_roles` | Vínculo | `X-Role` hoje | Criada | Última entrada |
|---|---|---|---|---|---|
| admin@luxtia.local | super_admin | nenhum | plataforma | 07/10 18:30 | 23/10 09:07 |
| cesar.almeida@luxtia.ia.br | super_admin | nenhum | plataforma | 15/10 16:44 | 15/10 16:59 |
| marco.santos@ticway.com.br | super_admin | Luxbrain Testes, administrador | plataforma (o super_admin vence o vínculo) | 07/10 23:05 | 23/10 09:24 |
| cesar.almeida@ticway.com.br | tenant_admin | nenhum | não entra em empresa | 19/10 20:13 | nunca |

Contagem que o gateway enxerga: 3 plataforma, 0 admin, 0 membro. Não há linha `tenant_user`. Não há fator de verificação em duas etapas. Não há sessão vigente agora.

O César da Ticway ficou com `tenant_admin` órfão. Em 19/10 ele foi criado como administrador do cliente “Assistente de Estoque”; o cliente foi apagado no mesmo dia e o vínculo saiu junto (`ON DELETE CASCADE`). O papel em `user_roles` não sai quando a empresa some. Ele não vira gestor de empresa nenhuma.

A tela Equipe hoje cria a pessoa já com senha, um interruptor “Administrador” e o botão Remover (apaga o vínculo, o papel e a conta). Não convida, não reenvia, não desativa e não mostra a última entrada. Quem pode criar é o super admin ou o administrador da própria empresa. O administrador pode criar outro administrador.

## 2. Papéis novos

Quatro papéis de sistema, mais a possibilidade de criar outro (exemplo: Cozinha) só com dados, sem código novo.

| Papel | Nível | Escopo de unidade | Quem concede |
|---|---|---|---|
| plataforma | 40 | todas as empresas e todas as unidades | só quem já é plataforma |
| gestor | 30 | todas as unidades da empresa, inclusive as que forem criadas depois | plataforma e gestor |
| supervisor | 20 | só as unidades marcadas | plataforma e gestor |
| funcionário | 10 | só as unidades marcadas | plataforma, gestor e supervisor (este, só nas unidades dele) |

Ninguém concede papel de nível maior que o próprio. Gestor cria gestor. Supervisor não cria supervisor: a matriz só lhe dá funcionário. Funcionário não abre Usuários. Ninguém muda o próprio papel nem se desativa.

Papel personalizado (Cozinha) nasce com um nível escolhido na hora, nunca acima de quem cria, e com um conjunto de permissões já existentes. Supervisor só pode marcar esse papel numa pessoa se o nível dele for no máximo o de funcionário e se cada permissão também couber no funcionário. Fora isso, só gestor e plataforma atribuem papel personalizado.

### Tabelas (painel, PostgreSQL)

Nomes em português. Horários em `timestamptz`, sessão do banco em `America/Sao_Paulo`.

- `permissoes` — catálogo fixo do código: `codigo`, `grupo`, `descricao`. Uma permissão nova (uma tela nova) ainda pede publicação. Um papel novo não pede.
- `papeis` — `id`, `empresa_id` (nulo só no papel plataforma, que é da conta, não da empresa), `codigo`, `nome`, `nivel`, `sistema` (os quatro não se apagam), `escopo_unidades` (`todas` ou `lista`).
- `papel_permissoes` — `papel_id`, `permissao_codigo`. A matriz abaixo é a carga inicial dos quatro papéis de sistema. Plataforma pode ajustar essa carga; gestor não edita papel de sistema.
- `usuario_unidades` — `usuario_id`, `empresa_id`, `unidade_codigo` (o `codigo` da unidade no gateway, não o nome). Só é preenchida quando o papel tem `escopo_unidades = lista`. Gestor e plataforma não têm linhas: a ausência significa todas. Unidade nova entra sozinha para quem tem `todas`.
- `tenant_users` ganha `papel_id`, `ativo` (padrão verdadeiro), `convidado_em`. A última entrada continua em `auth.users.last_sign_in_at`. `is_tenant_admin` deixa de decidir o `X-Role` depois da migração; fica só até a troca, para poder voltar atrás.

`user_roles.super_admin` continua sendo o único jeito de ser plataforma. Não vira linha de `papeis` por empresa.

## 3. Matriz

Cada linha é uma permissão. O servidor consulta `papel_permissoes`. A tela só esconde o que o servidor já recusa.

| Grupo | Permissão | Funcionário | Supervisor | Gestor | Plataforma |
|---|---|---|---|---|---|
| Pedidos | ver, mudar status, aceitar, recusar | sim | sim | sim | sim |
| Pedidos | cancelar pedido já confirmado, com motivo | | sim | sim | sim |
| Cardápio | esgotado hoje e repor | sim | sim | sim | sim |
| Cardápio | disponibilidade e horários do item | | sim | sim | sim |
| Cardápio | criar, preço, apagar | | | sim | sim |
| Conversas | ver e assumir | sim | sim | sim | sim |
| Conversas | pausar robô, transferir, encerrar | | sim | sim | sim |
| Unidade | pausar loja e horário especial | | sim | sim | sim |
| Relatórios | ver (só as unidades do escopo) | | sim | sim | sim |
| Relatórios | exportar | | | sim | sim |
| Usuários | convidar funcionário nas próprias unidades | | sim | sim | sim |
| Usuários | convidar gestor, supervisor e funcionário; qualquer unidade | | | sim | sim |
| Usuários | conceder plataforma | | | | sim |
| Agente | ver comportamento | | sim | sim | sim |
| Agente | editar rascunho e publicar | | | sim | sim |
| Integrações | iFood, 99Food, chaves, webhooks | | | sim | sim |
| Técnico | envio, piloto, fluxo Skyone, limites | | | | sim |
| Cliente | telefone completo | | sim | sim | sim |
| Cliente | telefone só com os 4 últimos dígitos | sim | | | |

Fora desta tabela, a proposta é manter a regra de hoje com o nome novo, e o supervisor fica com o conjunto do funcionário:

- Simular conversa, avisos de pedido, histórico de gestão, apagar documento, chave de formulário, reativar follow-up: gestor e plataforma.
- Ler documentos, canais e agentes: os quatro. Criar canal, modelo, empresa e chave de API da plataforma: só plataforma.
- Pausar ou reabrir a unidade por 30 min, 1 h ou fim do turno, que hoje o membro faz: passa a ser supervisor e gestor. O funcionário deixa de pausar a loja.

Isso está em aberto na seção 8, porque a matriz não citou essas telas.

## 4. Telas (rascunho)

A rota `/equipe` vira Usuários. O menu mostra o item para quem tem alguma permissão de usuários.

### Lista

```
Usuários                                    [ Convidar ]

Pessoas 3    Convites pendentes 1    Gestores 1

Nome              E-mail                 Papel        Unidades        Última entrada   Estado
Ana Lima          ana@loja.com           Gestora      Todas           28/10 09:12      Ativa
Bruno Costa       bruno@loja.com         Supervisor   Centro, Jardim  27/10 18:40      Ativo
Caio Dias         caio@loja.com          Funcionário  Centro          —                Convite enviado
Diana Rocha       diana@loja.com         Funcionária  Jardim          20/10 11:02      Desativada

[ Reenviar convite ]  [ Editar ]  [ Desativar ]
```

- Última entrada em Brasília, a partir de `auth.users.last_sign_in_at`. Convite ainda não aceito mostra “—”.
- Estado: Ativa, Convite enviado, Desativada.
- Desativar pede confirmação com o nome. Não apaga a conta. Reativar devolve o mesmo papel e as mesmas unidades.
- A pessoa não vê Desativar na própria linha. Não vê Editar de quem tem nível maior. Supervisor só vê e edita funcionários das unidades dele; um funcionário de uma unidade que o supervisor não tem fica fora da lista dele.
- Gestor vê a equipe da empresa, inclusive outros gestores. Não vê contas de plataforma.

### Convite

```
Convidar pessoa

Nome
E-mail
Papel            [ Funcionário v ]
Unidades         [x] Centro    [ ] Jardim    [x] Shopping

[ Enviar convite ]
```

- O e-mail leva o convite do GoTrue. Quem convida não escolhe senha. A pessoa define a senha ao abrir o link.
- O seletor de papel só lista o que quem está logado pode conceder. Supervisor vê só Funcionário. Gestor vê Funcionário, Supervisor e Gestor.
- Com papel de escopo `todas` (gestor), as caixas de unidade somem e o texto diz “Todas as unidades, inclusive as próximas”.
- Supervisor só marca unidades que ele mesmo tem. Pelo menos uma unidade é obrigatória para supervisor, funcionário e papel de lista.
- E-mail já usado na mesma empresa: a tela avisa e oferece reenviar, se o convite ainda estiver pendente.
- Reenviar gera outro convite e registra de novo na auditoria.

### Menu

O item aparece se a pessoa tem ao menos a permissão de ver daquele grupo. O botão de dentro da tela segue a permissão fina.

| Menu | Funcionário | Supervisor | Gestor | Plataforma |
|---|---|---|---|---|
| Pedidos, Conversas, Cardápio | sim | sim | sim | sim |
| Unidades e horários | | sim | sim | sim |
| Relatórios | | sim | sim | sim |
| Usuários | | sim | sim | sim |
| Comportamento do agente | | sim (leitura) | sim | sim |
| Integrações, chaves, webhooks, iFood, 99Food | | | sim | sim |
| Empresas, modelos, canais (criar), campos técnicos | | | | sim |

### Botões que mudam em relação a hoje

- Pedidos: Cancelar some para o funcionário quando o pedido já está confirmado. Aceitar, recusar e os outros status continuam. O motivo do cancelamento continua obrigatório (mínimo de 3 caracteres), agora também para o supervisor.
- Cardápio: funcionário vê Esgotado hoje e Repor. Disponibilidade e horários aparecem para supervisor e gestor. Novo item, preço e Apagar ficam no gestor.
- Conversas: funcionário vê e assume. Pausar robô, Transferir e Encerrar ficam no supervisor e no gestor.
- Unidades: Pausar loja e horário especial ficam no supervisor e no gestor.
- Comportamento: supervisor vê a faixa de rascunho e as diferenças, sem Publicar e sem gravar. Gestor publica. Envio, piloto, Skyone e limites continuam só na plataforma.
- Relatórios: a tela ainda não existe. O rascunho é uma lista vazia com o período e as unidades do escopo, e o botão Exportar só no gestor. O conteúdo de cada relatório fica para outra especificação.

### Telefone

O funcionário vê `····1513` na lista, no cabeçalho, no pedido e no nome quando o nome de exibição é o próprio telefone. O servidor do painel corta o número antes de responder ao navegador. O JSON do funcionário não leva o número inteiro. Busca por telefone, para ele, aceita no máximo os 4 últimos dígitos; um número maior é recusado na função de servidor. Supervisor, gestor e plataforma continuam vendo `+55 11 91234-1513`. Exportar, que só o gestor faz, leva o número completo.

## 5. Segurança

- Cada função de servidor relê papel, permissões, unidades e `ativo` no Postgres, com a conta da sessão. Corpo e cabeçalho vindos do navegador não definem papel nem unidade. O id de empresa só vale se for o da sessão, como já é hoje.
- Desativar grava `ativo = falso` e, na mesma operação, apaga `auth.sessions` e `auth.refresh_tokens` daquela conta quando ela não tem outro vínculo ativo e não é plataforma. A próxima chamada já recebe “acesso desativado”, mesmo que a sessão ainda não tenha caído. Desativar o vínculo do Marco na Luxbrain Testes não derruba a sessão dele: ele continua plataforma. Desativar alguém que só tem aquela empresa derruba na hora.
- Verificação em duas etapas é o TOTP do GoTrue, opcional, só para gestor. A própria pessoa liga e desliga na conta dela. Outro gestor não liga por ela. Enquanto ela não ligar, o login segue com senha. Não há fator cadastrado hoje.
- Auditoria em `audit_logs`, com autor, empresa, ação, alvo, antes e depois, horário de Brasília. Entram: convite, reenvio, troca de papel, troca de unidades, desativar, reativar, duas etapas ligada ou desligada, cancelar pedido confirmado, pausar loja, horário especial, publicar comportamento, exportar, gravar integração, criar ou revogar chave, webhook. Segredo, senha e token não entram. O telefone completo entra na auditoria do servidor; a tela de auditoria do funcionário não existe. Gestor vê a auditoria da empresa. Plataforma vê todas.

## 6. Migração

Feita numa transação, com o mapa antigo guardado (`is_tenant_admin` e `user_roles`) até a revisão de volta.

| E-mail | Hoje | Depois |
|---|---|---|
| admin@luxtia.local | super_admin, sem empresa | plataforma, sem empresa |
| cesar.almeida@luxtia.ia.br | super_admin, sem empresa | plataforma, sem empresa |
| marco.santos@ticway.com.br | super_admin e administrador da Luxbrain Testes | plataforma. O vínculo da Luxbrain Testes continua, e o `X-Role` segue plataforma |
| cesar.almeida@ticway.com.br | tenant_admin sem empresa | não migra. Papel órfão, sem gestor |

Ninguém passa de admin para gestor, porque não há conta cujo `X-Role` seja admin. Ninguém passa de membro para funcionário, porque não há `tenant_user` nem `membro`.

O atendente não muda de lugar: não é papel de login. O estado “Atendente” da conversa permanece. O que o código hoje chama de atendente (o `membro`) passa a se chamar funcionário no dia em que existir a primeira conta desse tipo.

## 7. Cabeçalhos para o gateway

Proposta de contrato. Não enviar estes valores enquanto o gateway só aceita `plataforma`, `admin` e `membro`. Hoje um papel desconhecido vira `membro` (`nucleo/autenticacao.py`). No CHAVES1, ainda não implantado, papel desconhecido passa a 403. Mandar `gestor` agora derrubaria o gestor para membro, ou para 403 depois do CHAVES1.

Quando o gateway aceitar, junto com as chaves do CHAVES1:

| Cabeçalho | Valor |
|---|---|
| `Authorization` | `Bearer` da chave de plataforma se `X-Role` é `plataforma` (`GATEWAY_PLATFORM_KEY`). `Bearer` da chave de empresa nos outros três (`GATEWAY_PANEL_KEY`). |
| `X-Actor` | e-mail da sessão, como hoje |
| `X-Role` | um destes, minúsculo, sem espaço: `plataforma`, `gestor`, `supervisor`, `funcionario` |
| `X-Tenant-Scope` | id da empresa no gateway, nas chamadas de gestor, supervisor e funcionário. Plataforma continua sem este cabeçalho. |
| `X-Unidades` | `*` para plataforma e gestor. Para supervisor e funcionário, os códigos separados por vírgula, sem espaço, em ordem: `centro,jardim`. Lista vazia recusa rota que depende de unidade. |

`X-Unidades` usa o `codigo` da unidade no gateway. O painel monta a lista a partir de `usuario_unidades`, nunca do que o navegador mandar.

Até o gateway ler esses nomes, o painel aplica a matriz antes de chamar e continua mandando o papel que o gateway já entende:

| Papel novo | `X-Role` enviado enquanto o gateway não muda |
|---|---|
| plataforma | `plataforma` |
| gestor | `admin` |
| supervisor | `admin` só na chamada que a matriz permite e que hoje exige admin; o painel não faz a chamada que a matriz nega |
| funcionário | `membro` |

O ponto fraco desse meio-tempo: se a chave de empresa vazar, o gateway ainda aceita `X-Role: admin` sem olhar unidade. A matriz fica garantida no painel. A garantia no gateway é o pedido seguinte, fora deste texto.

`X-Unidades` pode ir junto desde já (cabeçalho desconhecido é ignorado). Não conta como controle até o gateway passar a lê-lo.

## 8. Decisões aprovadas (28/10/2026)

| # | Decisão |
|---|---|
| 1 | Simular conversa e avisos: supervisor e gestor. Documentos: só gestor. Canais: gestor edita. Agentes: gestor edita, supervisor vê. Histórico: todos, nas suas unidades, com telefone mascarado para o funcionário. Follow-up: cancelar é supervisor e gestor; reativar opt-out é só gestor |
| 2 | Papel personalizado: só o gestor concede. O supervisor concede apenas funcionário |
| 3 | César (`cesar.almeida@ticway.com.br`): remover o `tenant_admin` órfão, com auditoria. A conta continua |
| 4 | Duas etapas: obrigatória para plataforma, com 7 dias para ativar no próximo login desta versão. Opcional para o gestor. Ajustado em 28/10 à tarde: `admin@luxtia.local` é conta de emergência e não tem esses 7 dias |
| 5 | Relatórios: o menu fica escondido até existir o AN1 |
| 6 | Sem meio-tempo. O painel só manda `gestor`, `supervisor` e `funcionario` quando o gateway aceitar (CHAVES1 e papéis). A publicação sai junto com o gateway |

A seção 7 descrevia um meio-tempo com `admin` e `membro`. A decisão 6 substitui isso: o código novo já manda os quatro nomes e só vai ao ar com o gateway.

## 9. Fora deste texto

O gateway não muda. A implantação no painel ficou sem publicar a imagem.

## 10. Ajustes antes da publicação (28/10/2026, 16:15 Brasília)

1. Sem `SMTP_HOST`, quem convidou vê o link uma única vez, com o aviso "Envie este link só para a pessoa convidada". O link vale 24 horas, serve uma vez e pode ser revogado na lista. O painel guarda só o hash. Com `SMTP_HOST` preenchido, o convite volta a sair por e-mail.
2. Com `GATEWAY_PLATFORM_KEY` vazia, a sessão de plataforma usa a chave da empresa. O log avisa uma vez por dia e não grava a chave. Com a chave de plataforma preenchida, só ela entra no Bearer.
3. `admin@luxtia.local` ficou marcada como conta de emergência no cadastro. O papel continua `super_admin`. A senha não foi alterada. No primeiro login da versão publicada, a segunda etapa é obrigatória na hora. Cada login gera um alerta na auditoria. As outras contas de plataforma continuam com os 7 dias.

A publicação continua junto com o PAPEL1 do gateway.
