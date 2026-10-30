## Cardápio — layout de gestão (30/10/2026)

- A listagem de Cardápio foi reorganizada para facilitar localizar, editar e gerenciar itens.
- Barra de comando fixa: busca, filtros sob demanda, indicadores compactos e ações principais.
- Navegação por categorias com destaque da seção visível (coluna no desktop, faixa no celular); categorias recolhíveis.
- Linha do item mais densa: selo único de status, preço, Ativo, Esgotar/Repor e editar à vista; arrastar/setas no hover.
- Sem mudança de contrato com o gateway. Nada publicado.

## Atalho da segunda etapa (29/10/2026, 22:22 Brasília)

- O aviso "Ative a segunda etapa até …" ganhou o botão "Ativar agora". Ele abre o cadastro já no QR, no código de 6 dígitos e, depois da confirmação, nos 8 códigos de recuperação. O mesmo cadastro continua no botão "Segurança" da barra de cima, à direita do título da página. Não há item no menu lateral.
- A obrigatoriedade da plataforma não mudou: 7 dias a partir do primeiro login desta versão. A conta de emergência (`admin@luxtia.local`) continua sem esses 7 dias. O gestor continua sem essa obrigação.
- Os códigos de recuperação ficam só como hash. Usar um desliga o aplicativo e pede para entrar de novo com a senha. A migração `20261029220000_codigos_recuperacao.sql` ainda não foi aplicada. Nada foi publicado.

## Telefone inválido embaixo do campo (29/10/2026)

- Quando o gateway responde 400 no telefone do piloto (`contatos_permitidos`) ou do alerta (`alerta_telefone`), a ficha do agente mostra a frase dele embaixo do campo, em vez de só no aviso flutuante. A frase atual é “Use DDD + número, ex.: 11912345678”.
- No rascunho de Comportamento do agente, o mesmo vale para o telefone de alerta da equipe (`transbordo_alerta`): se o item do erro traz `mensagem`, ela aparece embaixo do campo e no resumo. Os outros motivos continuam com o texto já usado na tela.
- Nada foi publicado.

## USUARIOS1 — publicado (28/10/2026, 18:17 Brasília)

- Commit `af380cb9d107fab8d166b552a9f1f5e8296ea7e0`. Imagem `painel:af380cb9d107fab8d166b552a9f1f5e8296ea7e0` = `sha256:c52a7c65d9e15d0e9aa6b7a338b51a754b068f9f61fed52f8e610a4ba63150a6`. Container `03f5c95acff1`, no ar desde 18:13 (Brasília). Só o painel foi recriado.
- Volta: `painel:volta-20261028T211243Z` = `sha256:7ba6a24b2b4184dd7be570a04919c4ae6db69abef7ffe17c6d7c15556acc96b5` (a imagem `painel:conversas-20261026`). Comando: `docker tag painel:volta-20261028T211243Z painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.
- Gateway em produção: `gateway:20e4df4`. A chave de plataforma segue vazia; a sessão de plataforma usa a chave da empresa.
- Conferido com `marco.santos@ticway.com.br` (plataforma), empresa By Koji, só leitura: Usuários, Pedidos, Cardápio, Conversas e Comportamento do agente abriram. O gateway respondeu 77 vezes com 200 e nenhuma com 403. O prazo da segunda etapa dessa conta ficou 04/11/2026 18:14 (Brasília). A conta de emergência não entrou.

## USUARIOS1 — ajustes antes da publicação (28/10/2026, 16:15 Brasília)

- Sem SMTP, o convite mostra o link uma vez para quem convidou. Vale 24 horas, é de uso único e pode ser revogado na lista. Com `SMTP_HOST`, volta a ser por e-mail.
- Enquanto `GATEWAY_PLATFORM_KEY` estiver vazia, a sessão de plataforma usa a chave da empresa. O log avisa uma vez por dia, sem registrar a chave.
- `admin@luxtia.local` foi marcada como conta de emergência. O papel continua `super_admin`. A senha não foi alterada: o Marco troca. A segunda etapa passa a ser obrigatória no primeiro login da versão publicada, sem os 7 dias. Cada login dela gera alerta na auditoria.
- A migração `20261028183000_usuarios1_ajustes.sql` foi aplicada. A imagem do painel não foi recriada. A publicação segue junto com o PAPEL1 do gateway.

## USUARIOS1 — papéis e unidades no painel, sem publicar (28/10/2026, 15:50 Brasília)

- A especificação foi aprovada. O painel passou a ter papéis (`plataforma`, `gestor`, `supervisor`, `funcionario`), unidades por usuário e a tela Usuários no lugar de Equipe. A imagem em produção não foi recriada. O gateway não foi alterado.
- O servidor monta `X-Role` e `X-Unidades` (`*` para plataforma e gestor; códigos para os outros dois). A chave `GATEWAY_PLATFORM_KEY` fica só no servidor e só entra quando o papel é plataforma. Recurso de outra unidade chega como “Não encontrado.”. Para o funcionário, a conversa usa o apelido `cv_<hash>` e o telefone mostra só os 4 últimos dígitos.
- A migração `20261028160000_usuarios1.sql` foi aplicada. O vínculo de quem era administrador da empresa virou gestor. O `tenant_admin` órfão de `cesar.almeida@ticway.com.br` saiu, com auditoria; a conta permanece. `admin@luxtia.local` não foi alterada e não tem prazo de segunda etapa gravado.
- Relatórios não entrou no menu. O convite por e-mail depende de SMTP, que o painel ainda não tem configurado.
- Prints em `docs/prints-usuarios/`. Publicação junto com o gateway, por `sh docker/publicar-painel.sh`.

## USUARIOS1 — especificação de papéis e unidades (28/10/2026, 14:07 Brasília)

- Só especificação, em `docs/ESPEC_USUARIOS1.md`. Nada implementado. Gateway intocado.
- Hoje o `X-Role` sai no servidor: `super_admin` vira `plataforma`; `is_tenant_admin` vira `admin`; o resto vira `membro`. Não existe papel `atendente` no banco. “Atendente” na conversa é estado da sessão.
- Contas em produção: 3 plataforma (`admin@luxtia.local`, `cesar.almeida@luxtia.ia.br`, `marco.santos@ticway.com.br`). Zero admin e zero membro no fio. O César da Ticway tem `tenant_admin` órfão, sem empresa, e não vira gestor.
- Papéis propostos: plataforma, gestor, supervisor, funcionário, como conjunto de permissões. Gestor vê todas as unidades. Supervisor e funcionário ficam na lista usuário × unidades. Ninguém concede papel acima do próprio.
- Cabeçalhos propostos para quando o gateway aceitar: `X-Role` (`plataforma`, `gestor`, `supervisor`, `funcionario`) e `X-Unidades` (`*` ou códigos), junto com as chaves do CHAVES1. Até lá o painel continuaria mandando `admin`/`membro`.

## Comportamento — um caminho por campo (26/10/2026, 17:20 Brasília)

- Os seis campos que existiam na ficha (efeito imediato) e no atendimento (rascunho) eram: espera (`debounce_s`), espera máxima (`max_wait_s`), pausa (`pause_minutes`), aviso de demora em segundos (`slow_notice_s`), mensagem de falha (`fallback`) e texto do aviso de demora (`aviso_demora`). Os cinco primeiros ficam só em Configurações → Comportamento do agente. O texto do aviso de demora some das duas telas, junto com a espera de áudio/imagem (`media_wait_s`) e “aceita agendado fora do horário” (`fora_do_horario_aceita_agendado`).
- Envio, piloto, contatos do piloto, telefone de alerta, limites, URL e credencial do Skyone, provedor e instruções só aparecem para a plataforma. Na ficha a plataforma ainda grava na hora, porque o gateway recusa esses campos dentro do rascunho. Admin e atendente não veem o grupo Operação nem os itens Skyone, Respostas e Envio aos clientes na prontidão.
- Com rascunho não publicado, a faixa diz “Há alterações não publicadas desde dd/mm — o agente ainda usa a versão em uso”. “Ver diferenças” mostra a tabela do rascunho e a prévia publicada (`perfil_atendimento`, o que o agente recebe hoje). “Publicar” abre a aba que já pede nota e confirmação. O atendente vê a faixa e as diferenças, sem o botão de publicar.
- Botões, reações, emojis e o limite do dia ficam desabilitados com “Disponível só em canal WhatsApp” quando o agente escolhido não tem canal uazapi. No escopo da empresa continuam editáveis.
- Conferido numa prévia com dados fictícios e o esquema real (sem segredos). Nada foi publicado. A imagem no ar continua `painel:conversas-20261026`.

## Bootstrap sem senha no código (26/10/2026, 12:52 Brasília)

- A conta que o bootstrap criava é `admin@luxtia.local` (nome Super Admin, papel `super_admin`). Ela já existe no banco de produção: criada em 07/10/2026 18:30 e último acesso em 23/10/2026 09:07 (Brasília). Tem senha. O valor não foi exibido.
- O código não guarda mais senha. `BOOTSTRAP_SUPER_ADMIN_SENHA` só é usada se essa conta não existir; se existir, o bootstrap recusa e não altera a senha. A variável no servidor fica vazia. O Marco troca a senha da conta. O histórico do Git não foi reescrito.
- A imagem em produção `painel:conversas-20261026` é o commit `d91f64317e3f7fbd733c56ed7e94bac0fdabe4b9` (a mesma `sha256:7ba6a24b…`). Publicação seguinte: `sh docker/publicar-painel.sh`, que recusa árvore suja e grava `org.opencontainers.image.revision`.

## Conversas — publicado (26/10/2026, 12:31 Brasília)

- A tela que estava no ar era a imagem anterior. O código novo só passou a valer depois de recriar o painel.
- Imagem `painel:conversas-20261026` = `sha256:7ba6a24b2b4184dd7be570a04919c4ae6db69abef7ffe17c6d7c15556acc96b5`. Container `0ba6b9326aec`. Só o painel foi recriado.
- Volta: `painel:volta-conversas-20261026` = `sha256:64a05bb61aca115a22eaad2350e71d0cd5c1fbb76840e22ef5363b24f75ea434` (a mesma `painel:simular-doc-20261022`). Comando: `docker tag painel:volta-conversas-20261026 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.
- O arquivo novo `Conversas-Dp6Mtten.js` responde 200. Quem já tinha a página aberta precisa atualizar forçado.

## Conversas — layout da lista e da sessão (26/10/2026)

- A página divide a altura da tela entre a lista e a conversa aberta. A lista mostra iniciais, horário curto (Brasília), estado, canal e a última mensagem.
- Ao abrir uma conversa, o histórico já fica nas mensagens recentes. Subir para ler o passado não puxa de volta; o atalho “Mensagens recentes” desce até o fim. Carregar mensagens anteriores mantém o ponto de leitura.
- Bolhas: cliente à esquerda, IA em roxo à direita, atendente em dourado. Separador por dia. Enter envia; Shift+Enter quebra a linha.
- No celular, a conversa ocupa a tela e há voltar para a lista. Atendimento e follow-up ficam recolhidos em “Atendimento e follow-up”.
- Sem publicação.

## Acesso de Marco à Luxbrain Testes (23/10/2026)

- Usuário do painel: `marco.santos@ticway.com.br` (já era `super_admin`, sem vínculo de empresa). O login `admin@luxtia.local` é a conta de sistema, usada por último em 23/10.
- Cliente do painel `Luxbrain Testes` (`luxbrain-testes`), ligado ao gateway `luxbrain_testes`. Marco é administrador dessa empresa (`tenant_users.is_tenant_admin`).
- By Koji não mudou: cliente `koji`, gateway `bykoji`, sem membro novo.
- O papel `super_admin` foi mantido. Sem ele, o seletor some e o By Koji deixa de abrir, porque ele não tem vínculo nessa empresa.
- Conferido com essa conta: Simular conversa → Luxbrain Testes → Teste Documentos. O botão “Anexar documento” aparece habilitado. Print `docs/prints-arq-fup/20-anexar-luxbrain-testes.png`.

## Clipe no Simular depois da troca de empresa (23/10/2026)

- A imagem `painel:simular-doc-20261022` (`sha256:64a05bb61aca115a22eaad2350e71d0cd5c1fbb76840e22ef5363b24f75ea434`) está no git: commit `b0a6b3b249471fef313c1eb506adf243e400887f`. Volta continua `painel:arq-fup-20261022`.
- Regra daqui em diante: não gerar imagem com árvore suja. O commit do build entra como label da imagem.
- Caminho conferido no Chromium (Super Admin de teste): By Koji, troca para bench_passo5, Simular conversa, agente Teste Documentos (`ag_92b3853d724f146f03ecfdb9`).
- O navegador chama a função de capacidades ao escolher o agente (id `36cd5d4b93f1…`, HTTP 200, `ativo: true`). Não chama na troca de empresa enquanto nenhum agente está escolhido; a lista de canais é refeita na troca. Ao escolher o agente, capacidade e detalhe são buscados de novo.
- O clipe depende só de `ativo === true`. Neste momento: capacidade true, canal API `can_ddefc934b2a21dcca872234c` (API documentos, ativo), `send_mode` dry, papel super admin, provedor mock e `agente_mode` mock. O botão não está desabilitado. Console sem erro.
- Print: `docs/prints-arq-fup/19-clipe-bench-passo5.png`. Sem correção e sem imagem nova.

## Simular conversa com documento — conferido, publicação em seguida (22/10/2026)

- Clipe ao lado da mensagem só quando `GET …/agentes/{a}/capacidades` traz `documentos.ativo`. Aceita PDF, XML, JPG, PNG e WEBP até 10 MB. A mensagem junto é opcional.
- Envio: `POST …/agentes/{a}/simular-documento` em multipart (`arquivo`, `identificador`, `canal_id`, `mensagem`).
- O corpo dessa chamada passa por `POST /_serverFn/…`. O proxy (`docker/Caddyfile`, `request_body max_size 15MB`) e o servidor do painel (`src/server.ts`, `LIMITE_CORPO_BYTES` em `src/lib/limite-corpo.ts`) aceitam até 15 MB decimais.
- Na conversa, cartão com nome, tipo e estado e link para `/ia/documentos?documento=anx_…`. Em Processando, o cartão consulta `GET …/anexos/{anexo_id}` a cada 2 s, por até 30 s, e troca sozinho para o estado final. Depois disso: “Ainda lendo, atualize em instantes”.
- XML que não é NF-e/NFC-e: “Este XML não é uma NF-e/NFC-e. Envie o XML da nota ou o PDF.” Os outros formatos fora da lista continuam com “Formato não aceito. Use PDF, XML, JPG, PNG ou WEBP.”
- Prints `docs/prints-arq-fup/17-simular-documento.png` e `18-simular-erros.png`.

## ARQ/FUP publicado (22/10/2026, 15:09 Brasília)

- Imagem `painel:arq-fup-20261022` = `sha256:5f859d0c906bdc708f842a5129ff9da7f918fe0ad706324c1c2594dc8c1719e1`, commit `7a53f7e`, árvore limpa no build. Container `590038b76381`. Só o painel foi recriado.
- Volta: `painel:pedidos-20261020` = `sha256:71e678d2651e06979ddc6f6d55ba4334d830b0f1ccf7ae3814d024d1ae100966`. Comando: `docker tag painel:pedidos-20261020 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.
- Backup `/home/twadmin/backups/painel/pre-arq-fup-20261022T180739Z`, diretório 700, arquivos 600. Dump SHA-256 `d4bf843a6824a0041774f267bc08ad3eaa0233f311c3dd1ef1ad20e9a241dfcc`, `pg_restore --list` 279 entradas. Sem mudança de schema: não restaurar o dump numa volta.
- Conferência só de leitura, By Koji: Pedidos, Cardápio, Conversas, Modelos, Documentos, Chaves de formulário, Webhooks de saída e Comportamento do agente abriram sem alerta. Datas `11/10/2026, 16:56` e `20/10/2026, 12:26`; filtros `dd/mm/aaaa`; janela de follow-up `09:00`–`22:00`. Gateway: 159 respostas 200 e nenhuma 403. Nada foi criado para o cliente.

## Rotas do gateway no painel — ainda não publicado (22/10/2026)

- Reativar envia `motivo` (3 a 300). No contato, depois da reativação, aparecem quem reativou e o motivo.
- Lista de documentos filtra no gateway (`tipo_documento`, `de`, `ate`). “Conta de consumo” e “Cobrança Pix” são os rótulos.
- “Gerar novo segredo” aparece para admin e plataforma. A confirmação avisa que o segredo antigo vale mais 24 h. O novo sai uma vez. A lista mostra “Segredo anterior válido até dd/mm hh:mm”.
- Sem publicação.

## Ajustes depois da revisão 693249e — ainda não publicado (22/10/2026)

- Tipo e período da lista de documentos vão em `GET …/anexos`. O aviso de filtro só na página carregada saiu.
- Reativar follow-up exige motivo (3 a 300 caracteres) e envia no corpo do `DELETE …/opt-out-follow-up`.
- Sem publicação.

## Revisão dos prints ARQ/FUP — ainda não publicado (22/10/2026)

- Datas dos filtros em dd/mm/aaaa e a janela do follow-up em 24h, sem depender do idioma do navegador. `lang="pt-BR"` na página.
- Detalhe do documento com rótulos, R$, Copiar, itens da NF-e em tabela, aviso fixo no comprovante PIX e “Apagado automaticamente em”.
- Webhook novo nasce ativo. O segredo HMAC aparece uma vez.
- Chave de API nova sem escopo marcado; “Resposta assíncrona (em breve)” desabilitada. “Cancelar este” fica na linha do follow-up agendado. O nome do agente aparece no topo de Comportamento.
- Prints em `docs/prints-arq-fup/`. Sem publicação.

## Follow-up (FUP1-a) — telas no painel, não publicadas (21/10/2026)

- Em Comportamento do agente: ligar, 1º e 2º em minutos, máximo por dia e janela. Na conversa: bloco com agendado, cancelado e ensaio, e Cancelar. No contato: selo “não quer follow-up” e Reativar (admin e plataforma).
- Rota ausente (404): a conversa mostra “Follow-up ainda não está disponível.” e continua. A janela da configuração, se falhar, avisa e o resto do formulário permanece.
- Sem publicação.

## Documentos (ARQ1-a1) — telas no painel, não publicadas (21/10/2026)

- Escopo `documentos:enviar` na chave da empresa. `/ia/chaves-formulario` mostra a chave uma vez, com Copiar. `/ia/documentos` lista, detalha, baixa e apaga. `/ia/webhooks-saida` inclui os eventos de documento, resposta e follow-up.
- Prints 01 a 08 em `docs/prints-arq-fup/`. Sem publicação.

## Pedidos — quadro vazio corrigido e publicado (20/10/2026)

- A tela de Pedidos abria só com origem **Reais**. No By Koji não há pedido real: 1 aguardando a loja é piloto, 12 antigos estão como teste (marcação da migração) e 1 piloto cancelado. O quadro e o aviso do menu ficavam vazios.
- Padrão da tela passou a ser todas as origens. O filtro Reais, Piloto, Simulados e Teste continua disponível. O aviso do menu volta a contar todo pedido aguardando a loja.
- Volta desta troca: `painel:volta-pedidos-b98f06b75967` = `sha256:b98f06b7596782c35dc43343869211b5639cb241018c59901252046f766cb95a` (a imagem `painel:cat3a-20261020`). Nova: `painel:pedidos-20261020` = `sha256:71e678d2651e06979ddc6f6d55ba4334d830b0f1ccf7ae3814d024d1ae100966`. Container `6c90da349d93`. Só o painel foi recriado.
- Backup `/home/twadmin/backups/painel/pre-pedidos-20261020T205548Z`, diretório 700, dump/ambiente/Compose 600. `pg_restore --list` 279 entradas. SHA-256 do dump `1e52935d72e3fceaf40198fab7c8b95f52a8c65be20147ea262f8ecfbdd2e200`. Sem mudança de schema: não restaurar o dump numa volta.
- Volta: `docker tag painel:volta-pedidos-b98f06b75967 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.
- Conferência só de leitura: lista sem filtro de origem devolve 14 pedidos (piloto: 1 aguardando e 1 cancelado; teste: 10 concluídos, 1 recusado, 1 cancelado). `origem=real` continua 0. Nenhum pedido foi alterado.

## CAT3-a e ENC1-a — publicados (20/10/2026)

- Volta: `painel:volta-cat3-c1c1c96e2719` = `sha256:c1c1c96e2719c9182442f97dd5a2124d42881f501c7178fc2678a29548be7c1b` (a imagem do CAT2, `painel:cat2-20261013`). Nova: `painel:cat3a-20261020` = `sha256:b98f06b7596782c35dc43343869211b5639cb241018c59901252046f766cb95a`. Container `a0c967e48e50`. Só o painel foi recriado.
- Backup `/home/twadmin/backups/painel/pre-cat3a-20261020T202828Z`, diretório 700, dump/ambiente/Compose 600. `pg_restore --list` 279 entradas. SHA-256 do dump `790526906e651e0d146f915c40b851c5ca733149d7bc07d9d9272ba6f9a35a8e`. Sem mudança de schema: não restaurar o dump numa volta.
- Volta: `docker tag painel:volta-cat3-c1c1c96e2719 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.
- Conferência só de leitura: `/ia/cardapio` abre (título Cardápio | Luxtia). By Koji tem 4 unidades (Einstein, Vila Nova Conceição, Pátio Guedala, Morumbi). Nenhuma categoria tem posição própria, então a ordem na tela é a do cardápio importado que o gateway devolve. Sugestões de pratos iguais: 189 grupos (100 na primeira página). Na primeira página de conversas, as 20 trazem o atendimento atual (12 encerrados, 8 abertos). Nenhum item, categoria ou atendimento foi alterado.

## CAT3-a e ENC1-a — cardápio do dia e atendimentos (20/10/2026, desenvolvimento)

- Contratos (somente leitura): `gateway/docs/ESPEC_CAT3.md` seção 13 (gateway:fbfea15) e `gateway/docs/ESPEC_ENC1A.md` seção 7 (gateway:0268e06). Nada no repositório do gateway foi alterado.
- Cardápio (`/ia/cardapio`): abas de unidade; categorias em blocos na ordem do cliente, arrastáveis (`PUT …/categorias/ordem`); itens arrastáveis dentro da categoria (`PUT …/categorias/{id}/ordem`). Criar, renomear e arquivar categoria — ao arquivar, a tela pergunta se arquiva os itens ou move para outra categoria.
- Na linha do item, sem abrir o formulário: Disponível (`ativo`), “Esgotado hoje” (`POST …/esgotar` com `ate=fim_do_dia`, mostra até quando e “Repor” num toque), preço editável e menu “…” (Duplicar, Mover, Copiar para outra unidade, Arquivar).
- “Novo item” e painel lateral: nome, descrição, categoria, preço, código (gerado, editável), tipo, alcoólico, delivery, disponibilidade e observação interna. Ao salvar uma edição, pergunta “só nesta unidade” ou “em todas as unidades com este prato” (`aplicar_em`).
- Seleção em lote: reajuste (% ou valor, com prévia `simulacao`), mover, pausar, ativar, esgotar, repor e arquivar, com resultado por item.
- Tela “Pratos iguais nas unidades”: grupos por nome, confirmar ou ignorar em lote, restaurar ignorados, aviso de preços diferentes e de mais de um item na mesma unidade.
- Filtros: arquivados, esgotados, categoria e prato. Esgotar e repor também para o membro; o resto só admin e plataforma.
- Conversas: lista e detalhe mostram o atendimento atual (número, aberto / com humano / encerrado, aberto em, encerrado em, motivo). Histórico em `GET …/conversas/{id}/atendimentos`, com resumo, desfecho, pedidos e mensagens filtradas por `atendimento=`. “Encerrar atendimento” e “Reabrir” (só o último), admin e membro; 409 explica o caso.
- 143 testes aprovados, 6 ignorados; tsc e ESLint OK. Oito prints com dados fictícios em `docs/prints-cat3-enc1/`. Publicado em seguida; o código segue sem commit.

## LGPD1 / gateway 1e7c6b6 — origem e canal nos Pedidos (2026-10-16, desenvolvimento)

- Gateway passa a devolver `origem` (real, piloto, simulado, teste) e `canal` (whatsapp, api) em GET `/tenants/{t}/pedidos` e no detalhe; filtro `?origem=` (várias separadas por vírgula).
- Tela Pedidos: filtro de origem (Reais, Piloto, Simulados, Teste). O padrão inicial era só Reais; em 20/10 passou a abrir com todas as origens, porque em piloto o quadro ficava vazio. Etiqueta discreta no cartão/lista/detalhe quando origem ≠ real ou canal ≠ whatsapp. O contador do menu conta todo pedido aguardando a loja (`GET …/pedidos/contagem`). A opção `so_reais` continua no servidor, sem uso na tela.
- Arquivos: `pedidos.ts`, `pedidos.server.ts`, `pedidos.test.ts`, `Pedidos.tsx`, `ContadorPedidos.tsx`, `README.md`.
- Não commitado, não publicado.

## Fase — Acesso cesar.almeida@luxtia.ia.br (2026-10-15 19:44)

- Usuário criado no GoTrue com e-mail confirmado e papel `super_admin`.
- O login foi testado na API de autenticação e retornou sucesso.
- A senha não foi registrada neste arquivo.

## MULTI1-a — Modelos de agente e Módulos do agente (15/10/2026, desenvolvimento)

- Tela `/ia/modelos` (só plataforma): lista com filtro ativo/inativo, detalhe com seções de módulos permitidos/padrão, referência Skyone, motivos de transferência e tipos de solicitação. Criar modelo (versão 1) e editar (cria nova versão, com aviso explícito de que agentes existentes ficam na versão anterior).
- Aba "Módulos" no detalhe do agente (`/ia/agentes/{id}?aba=modulos`) para admin e plataforma: mostra GET …/agentes/{id}/modulos (permitidos, da_empresa, ligados_no_agente/padrão). Admin/plataforma pode mudar os módulos ligados no agente (lista ou null = padrão do modelo). Plataforma pode ligar/desligar módulo na empresa (com aviso de que vale para toda a empresa).
- `ModeloAgenteCompleto` em `tipos.ts` com todos os campos §10.2. Funções de servidor em `gateway-modelos.functions.ts` (listar, obter, criar, editar). Lista de modelos para criação de agente filtra ativo=true.
- Arquivos: `tipos.ts`, `gateway-modelos.functions.ts`, `modelos.tsx`, `ModulosDoAgente.tsx`, `agentes.$agenteId.tsx`, `gateway-agentes.functions.ts`, `gateway-modulos.functions.ts`, `routeTree.gen.ts`.
- tsc e ESLint OK. Não commitado, não publicado.

## CAT2 — edição do item no Cardápio (13/10/2026, publicada)

- Confirmação ao salvar é uma janela da própria tela ("Salvar mesmo assim" / "Voltar"), com os textos dos avisos de preço vazio e de categoria que deixa de existir. Histórico segue só para admin/plataforma; o lote segue só com disponibilidade e `atualizado_em`.
- Publicação: tag de volta `painel:volta-cat2-077a798d9a72` (`sha256:077a798d…`); imagem nova `painel:cat2-20261013` (`sha256:c1c1c96e…`). Só o container do painel foi recriado. Conferência só de leitura: `/ia/cardapio` abre; By Koji com 888 itens, 193 com preço e nenhum sem `disponivel_agora`.

## CAT2 — edição do item no Cardápio (13/10/2026, desenvolvimento)

- Painel lateral do item para admin/plataforma: nome, descrição, preço, ativo e categoria. `PATCH` só com o que mudou e `atualizado_em` como foi lido. Avisos de "sem preço" e de categoria que deixa de existir. Edição rápida do preço na lista (Enter/Esc).
- 409 com valores atuais e "Recarregar" ou "Reaplicar". Situação de agora por `disponivel_agora` e `indisponivel_motivo` (sai o "A confirmar"). Prévia ao vivo por `POST …/disponibilidade/previa`. Histórico por `gestao/alteracoes`. Erros do gateway junto do campo.
- Servidor: ações `obter`, `categorias`, `previa`, `historico` e `editar` em `cardapio.server.ts`, com as regras de acesso de `modulo.server.ts`: leitura e prévia para todos; edição e histórico só admin/plataforma.
- 127 testes aprovados (10 novos em `cardapio-cat2.test.ts`), 6 ignorados; tsc e ESLint OK. Sete prints com dados fictícios em `docs/prints-cardapio/cat2-*.png`. Aguardando revisão antes de publicar.

## Cardápio — revisão UX (13/10/2026, não publicada)

- Nova lista por unidade/categoria, resumos e filtros, URL persistente, painel lateral de disponibilidade, atalhos/cópia e lote com progresso. Consulta do atendente sem controles de edição; PATCH segue exclusivo de admin/plataforma.
- Prévia visual em Chromium pt-BR com dados fictícios: seis prints em `docs/prints-cardapio/`. Relatório e pendências de contrato em `docs/VALIDACAO_CARDAPIO_UX.md`.
- 117 testes aprovados, 6 REST antigos ignorados, zero falhas; tsc, ESLint e build Vite aprovados. Nenhum item real alterado, nenhum serviço permanente recriado. Gateway somente leitura, sem commits. Aguardar revisão dos prints antes de publicar a nova versão.
- O admin DISP1 não devolve disponibilidade avaliada agora/feriados: itens restritos aparecem “A confirmar”, sem classificação inventada. Edição de preço/nome/descrição/ativo/categoria e prévia operacional continuam pendências explícitas do gateway.

## DISP1 — tela Cardápio e disponibilidade por item (12/10/2026, publicada)

- Nova tela `/ia/cardapio` (menu "Cardápio", admin e atendente; plataforma escolhe a empresa): lista dos itens do catálogo do gateway com busca, filtro por unidade e paginação; etiqueta com `disponibilidade.resumo` do gateway quando o item tem restrição.
- Admin/plataforma: botão "Disponibilidade" abre o diálogo com a chave "Sempre disponível" (envia `null`), dias da semana, "Exceto feriados" e faixas de horário. `PATCH /admin/v1/tenants/{t}/catalogo/itens/{id}` só com `{"disponibilidade": …}`.
- Servidor: rotas `catalogo/itens` (GET admin/membro) e `catalogo/itens/*` (PATCH admin, só a chave `disponibilidade`). Descrição e observação do item não saem do servidor.
- Arquivos: `src/lib/gateway/cardapio{,.server,.test}.ts`, `src/lib/gateway-cardapio.functions.ts`, `src/components/luxtia/Cardapio.tsx`, rota, `nav.ts`, `routeTree.gen.ts`, `modulo.server.ts`, `erros.ts`, `gestao-base.tsx`.

## CAL1 — Cidade e UF no cadastro de unidades (12/10/2026)

- Formulário de criar/editar unidade: "Cidade" (texto, até 80) e "UF" (select com as 27 UFs; "—" = sem UF), com a ajuda "Usado para feriados estaduais e municipais no atendimento." Gravados pelos campos `cidade` e `uf` do `POST`/`PATCH /admin/v1/tenants/{t}/unidades[/{id}]` (gateway CAL1, schema 39); vazio vai como `null`.
- Lista e detalhe da unidade: "Cidade/UF" em texto discreto. Unidade ativa sem cidade: etiqueta "Sem cidade: só feriados nacionais serão considerados".
- Servidor: `cidade` e `uf` entram na projeção da unidade (todos os papéis) e no schema de escrita (`uf` só das 27; cidade com espaços aparados). Escrita continua só admin/plataforma.
- Arquivos: `src/lib/gateway/gestao.ts`, `gestao.server.ts`, `gestao.test.ts`, `src/components/luxtia/GestaoUnidades.tsx`.

## CFG1-a — tela "Comportamento do agente" (11/10/2026)

- Contrato: `gateway/docs/ESPEC_CFG1.md` §13 (somente leitura). Rota `/ia/configuracoes/comportamento`, menu Configurações para plataforma, admin e membro.
- Arquivos: `src/lib/gateway/atendimento.ts` (tipos, rótulos, `situacaoCampo`, `corpoRascunho`), `atendimento.server.ts` (chamadas, membro barrado nas escritas antes do gateway, agente oculto vira 404, tradução de 400/403/404/409), `gateway-atendimento.functions.ts`, componentes em `src/components/luxtia/comportamento/`, regras `regrasAtendimento` em `modulo.server.ts` (empresa e `agentes/*`, chaves do corpo fechadas).
- Formulário pelo `esquema`: rótulos conhecidos ficam no painel, os desconhecidos viram o nome da chave legível (`nome_empresa` e `descricao_negocio` do CFG1-a.1 já têm rótulo).
- 409 `sem_rascunho`/`sem_alteracoes`/`versao_desatualizada` recarregam; rascunho desatualizado é rebaseado com PUT só de `baseado_em`. `confirmacao_necessaria` mostra os trechos e reenvia com `confirmar_avisos: true`.
- Publicado sobre a volta `painel:ped1c-20261011` (`sha256:e836c627…`, PED1-c). Nova imagem `sha256:c420d7eb…`. Backup `/home/twadmin/backups/painel/pre-cfg1a-20261011T154706Z`, 700/600, `pg_restore --list` 279 entradas, SHA-256 do dump `14f95dd1…a3a19d`. Só o painel recriado; nenhum prune.
- Volta sem mudança de schema: `docker tag painel:ped1c-20261011 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.

## PED1-c — nome de exibição, estado único e "Editar nome" (11/10/2026)

- Contrato: `gateway/docs/ESPEC_PED1.md` §14 (gateway `6f89149`). Conversas usam `nome_exibicao` com selo de origem, `telefone_formatado`, `canal_info` (selo "teste"), `estado`, `ultima` (autor e tipo), `unidade_preferida_nome` e `pedido_aberto` (atalho `/ia/pedidos?pedido=`). Filtros `estado=` (inclui Encerrada) e `ordem=recentes` (padrão); busca nos três nomes.
- "Editar nome" no cabeçalho da conversa: `PATCH /contatos/{id}` `{"nome"}` para admin e membro (regra em `modulo.server.ts`, corpo só `nome`); vazio vira `null`. O servidor confere que o contato é o da conversa visível. Auditoria pelo `X-Actor` no gateway.
- Pedidos: cartão, lista e detalhe usam o `nome_exibicao` atual da conversa, juntado no servidor (cache de 30 s por empresa, limpo ao editar nome); sem conversa ou com falha, fica `cliente.nome`.
- Publicado sobre a volta `painel:9afa7b3` (`sha256:273ad61a…`, mesmo conteúdo de `painel:6027ea7`). Backup `/home/twadmin/backups/painel/pre-ped1c-20261011T152848Z`, 700/600, `pg_restore --list` 279 entradas, SHA-256 `2d2791dd6e55b636ead3c02d282d4c4998fefdfd0ae989448ed701343308a60f`. Só o painel recriado; nenhum prune.
- Volta sem mudança de schema: `docker tag painel:9afa7b3 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`.

## PED1-b — avisos de pedido (11/10/2026)

- Publicado `painel:6027ea7`: X-Role da sessão em todas as chamadas administrativas; Configurações → Avisos de pedido por status/modalidade, prévia e padrão; reenvio na linha do tempo com confirmação e tratamento de entrega incerta. Contador existente preservado.
- 87 testes aprovados, 6 integrações REST antigas ignoradas, zero falhas. TypeScript, lint, builds e bundle aprovados. Validação autenticada: 12 avisos, prévia e contagem; zero escritas/envios em produção.
- Imagem de volta `painel:54188e4` conferida antes do build. Backup validado em `/home/twadmin/backups/painel/pre-ped1b-20261011T030002Z`, permissões 700/600. Só painel recriado; zero segredos nos logs, gateway intocado, nenhum prune.
- Relatório completo, volta e conferência visual: `docs/VALIDACAO_PED1B_PAINEL.md`. Alterações locais anteriores preservadas separadamente no commit `54188e4`. Parar para validação do Marco; PED1-c não iniciado.

## Comportamento do agente — especificação CFG1 (2026-10-11)

- Só especificação em `docs/ESPEC_TELAS_CFG1.md`, a partir de `gateway/docs/ESPEC_CFG1.md` (somente leitura). Nenhuma tela, rota ou chamada nova foi implementada; o gateway também ainda não tem o CFG1-a.
- Telas: Personalidade, Comportamentos, Base de conhecimento (só depois do CFG1-b), Publicar (rascunho, prévia, "Testar no Simular") e Histórico (comparação e restaurar). Admin e plataforma editam; membro só vê, mas abre a prévia e testa a busca da base.
- Selo por campo "Padrão do segmento"/"Personalizado" com "voltar ao padrão"; `disponivel=false` como "em breve"; `pediu_humano` e `reclamacao` travados; regras da casa com bloqueio do gateway apontando o trecho e confirmação nos casos duvidosos.
- 19 pendências do contrato listadas na seção 10. Aguardando aprovação antes de implementar.

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

## Cardápio UX — publicação autorizada (13/10/2026)

Nova tela publicada; somente painel recriado. Volta `painel:volta-cardapio-756361eb4dd0`; nova `painel:cardapio-ux-20261013` (`sha256:077a798d9a729c08672137909411eefa415cffc1774949c28cbd729ca0fa97d2`). Backup validado, bundle/logs sem segredos, HTTPS e leitura autenticada do By Koji aprovados: 888 itens, quatro unidades, zero escritas. “Agora: a confirmar” mantido. Gateway e demais containers preservados. Evidências e volta em `docs/VALIDACAO_CARDAPIO_UX.md`.
