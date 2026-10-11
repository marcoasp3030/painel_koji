# Gestão G1 — relatório do painel

A descrição das telas no fim deste arquivo é a da primeira publicação. Em 10/10/2026 a interação foi revisada: ações visíveis na lista, grade resumida e histórico por nome da unidade e período. O contrato e as permissões abaixo não mudaram. Detalhe em `docs/worklog.md`.

10/10/2026. Escopo: somente telas 1 (Unidades), 2 (Horários) e 9 (Histórico). Gateway utilizado em modo somente leitura na validação em produção. Nenhuma unidade real alterada e nenhuma unidade de teste precisou ser criada.

## Entrega

- `/ia/unidades`: cartões com situação recebida da API, dados e edição parcial, fuso herdado ou explícito, telefone normalizado com DDI (10–15 dígitos), pausa com prazo/indefinida e reabertura. O detalhe abre dentro da mesma página, mantendo empresa selecionada.
- Detalhe: agenda dos próximos sete dias, grade semanal de até 12 turnos por dia, turno cruzando meia-noite, validação de sobreposição inclusive domingo→segunda, cópia para dias escolhidos, exceções por data com substituição confirmada, filtro desde/até e exclusão.
- `/ia/gestao/alteracoes`: entidade e identificador exato, paginação por cursor, antes/depois somente dos campos devolvidos; telefone permanece mascarado. Sem filtro de período nem agregação unidade+exceções. Data mantém offset recebido; sem offset aparece “horário do servidor”.
- Membro lê unidades/situação/agenda e pausa/reabre. Não faz PATCH nem acessa grade, exceções, taxas, pagamentos, histórico ou demais funções de gestão. Servidor recusa operação/campo não permitido; resposta ao membro não expõe grade/configurações administrativas da unidade. Admin da empresa fica no tenant vinculado. X-Actor vem da sessão em GET e escrita.
- Estados de carregamento, vazios, falhas com nova tentativa, erros junto ao campo e resumo, aviso de alterações não salvas. Grade/agenda e situação são separadas: o painel valida o formulário, mas não calcula aberta/fechada.
- ESPEC atualizada com os ajustes aprovados. G3–G6 não implementados; permissões futuras de em falta e pedidos não foram liberadas antecipadamente.

## Evidências

| Verificação | Resultado |
|---|---|
| `bun test` | **72 passed, 6 skipped, 0 failed**; 478 verificações. Os seis ignorados são integrações REST antigas sem ambiente dedicado |
| TypeScript | `tsc --noEmit` aprovado |
| Lint dos arquivos envolvidos | Zero erros; três avisos Fast Refresh por exportações compartilhadas (dois em Gateway já existentes e um no hook de gestão) |
| Build Vite e Docker | Aprovados |
| Bundle | Zero valores de chave; zero referências internas ao gateway no frontend; leitura da chave apenas no servidor |
| HTTP autenticado do painel, somente leitura | Quatro unidades By Koji, quatro detalhes e agendas de sete dias, listas de exceções e histórico aprovados; **zero escritas** |
| Saúde/páginas públicas | `/`, `/ia/unidades`, `/ia/gestao/alteracoes`, `/ia/conversas`, `/auth/v1/health`, `/gateway/health` → 200 |
| Administração pública do gateway | `/gateway/admin/v1/tenants` → 404 |
| Segredos nos logs do painel novo | Zero ocorrências, comparação em memória; conteúdo não exibido |
| Containers permanentes | Somente painel recriado; gateway, workers, agendador, bancos, Redis, autenticação, REST e Caddy mantiveram IDs |

Os testes de escrita usam cliente HTTP simulado, sem acesso a unidades reais. Cobrem todas as ações com tenant alheio, membro tentando editar/criar/grade/exceções/histórico, actor forjado e X-Actor real, projeção de dados do membro, horário nulo, meia-noite/sobreposição, pausa expirada/indefinida e prazo máximo, substituição da exceção pela mesma data, erro 400 junto ao campo, telefone e PATCH parcial, paginação/máscara e horários ambíguos/inexistentes de mudança de fuso. O teste de pausa expirada confere que a tela obedece à situação recebida, sem recalcular o estado no navegador.

## Publicação e volta

- Imagem de volta `painel:e2f8cd9`, conferida antes do build: `sha256:212bef92ce7e1d7b88d852f1e46ae825f1fbe4f49765eb41c662d54a01b06981`.
- Backup `/home/twadmin/backups/painel/pre-gestao-g1-20261010T204453Z`: diretório 700, dump/ambiente/Compose 600, fora do Git; `pg_restore --list` aprovado. SHA-256 do dump: `b6340e2c0b1d141819eec4e2eba1a4524875fe49a0b934d8fbad6896b02393c8`.
- Sem migração, prune, edição no repositório gateway, alteração de unidade, modo de agente ou chamada ao Skyone. Nenhuma validação pós-publicação falhou; rollback não necessário.
- Se necessário: conferir `docker image inspect painel:e2f8cd9`, executar `docker tag painel:e2f8cd9 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Manter banco/ambiente; não restaurar o dump sobre a base em uso.

## Descrição das telas e conferência no navegador

Não foram capturados prints nem realizada navegação automatizada em browser. As descrições abaixo refletem a implementação; a conferência visual/interativa permanece com Marco.

1. **Menu → Unidades e horários:** cartões (duas colunas em tela larga, uma no celular), nome/código/endereço, selo textual da situação, fuso, próxima abertura/fechamento quando informados. “Horário não informado” aparece para null. Botões Ver unidade e agenda, Pausar/Reabrir e Editar dados (admin).
2. **Detalhe da unidade:** situação no topo e ações rápidas; atendente vê apenas Agenda. Admin também vê Grade semanal e Exceções por data. Não há controle de entrega/pagamento nesta entrega.
3. **Grade:** blocos por dia, inputs de hora, Adicionar/Remover turno e Copiar para outros dias. Um turno 19:00–02:00 indica “Termina no dia seguinte”. Sobreposição apresenta erro e impede salvar. A agenda usa apenas o que já foi salvo.
4. **Pausa no celular:** modal com nome da unidade, fuso, data/hora e motivo, checkbox Até eu reabrir, botão amplo de confirmação. Reabrir avisa que grade/exceções continuam valendo. Não testar escrita em unidade real sem intenção operacional: usar apenas unidade de teste.
5. **Exceções:** lista com período, editar/substituir e excluir; formulário de data com Fechado o dia inteiro ou turnos especiais. Substituir data existente pede confirmação mostrando a configuração atual.
6. **Histórico:** filtros de entidade/ID, linhas expansíveis com autor/data/ação, diferenças em duas colunas (empilhadas no celular) e Carregar mais. Sem filtro de período nesta entrega.
7. **Papéis:** entrar como membro deve ocultar edição/grade/exceções/histórico e manter somente leitura/agenda/pausa/reabertura. URLs ou chamadas forjadas continuam recusadas no servidor.

Parada: G1 entregue; aguardar validação do Marco. Não iniciar outros blocos.
