# Cardápio — revisão de experiência e publicação

13/10/2026. **Nova versão aprovada pelo Marco e publicada.** A versão anterior foi substituída; somente o container do painel foi recriado. Gateway preservado, sem edição ou commit no seu repositório. Alterações locais preexistentes do painel preservadas.

Os testes e prints abaixo foram realizados antes da publicação; as verificações do serviço publicado constam ao final.

## O que mudou

- Unidades em abas com contagem e “Sem cardápio” quando nenhum item tem preço. Resumos clicáveis, busca em nome/descrição/código/categoria e chips. Unidade, busca e filtro na URL.
- Catálogo completo carregado pelo servidor em páginas de 200, exclusivamente via `/admin/v1`, antes de apresentar contagens e filtros. Teto explícito de 10.000 itens: excedê-lo retorna erro em vez de mostrar contagem parcial. Cursor parado é recusado. Não usa `/api/v1` nem banco do gateway.
- Categorias na ordem do primeiro ID importado, mantida ao filtrar; contagens correspondem ao resultado visível. Navegação lateral no desktop e faixa horizontal no celular; cabeçalhos fixos e linha inteira abre o item.
- Descrição pública agora projetada pela resposta do servidor. Observação interna permanece fora do navegador. Nome, preço, descrição, ativo e categoria são apenas leitura, com “edição em breve”.
- Painel à direita (tela inteira no celular), atalhos de dias, botões redondos, exceção de feriados, faixas em HH:MM com teclado numérico e inserção do separador. Nunca usa `input type=time`, evitando AM/PM do navegador. Prévia textual instantânea, copiar regras de outro item da unidade, rodapé fixo, erros e toasts, confirmação de rascunho não salvo.
- Seleção por item/categoria e barra de lote. “Definir disponibilidade” usa o mesmo editor; “Tornar sempre disponível” confirma remoção das regras, enviando null. PATCH individual, sequencial, progresso e resultado por item; sucesso parcial não reaplica automaticamente itens nem falhas incertas.
- Membro/atendente consulta lista e detalhes, sem seleção, formulário editável ou lote. Escrita continua restrita a admin/plataforma no servidor. `X-Actor` e `X-Role` da sessão e chave exclusivamente no backend mantidos.
- Skeleton, erros com nova tentativa, vazios orientados ao filtro, controles nomeados, foco visível, abertura pelo teclado, foco contido no painel e restaurado ao fechar.

## Limitação real do contrato: “agora”

A seção **8.5** de `gateway/docs/ESPEC_DISP1.md` e a rota admin atual devolvem apenas a regra cadastrada com resumo. O campo `disponivel` da seção 8.1 pertence à **Skill**, não à API administrativa. O painel não chama Skills nem tenta reconstruir feriados nacionais/estaduais/municipais/da empresa.

- Item inativo: indisponível; item ativo sem restrição: disponível quanto a dias/horários. Isso não garante estoque, preço ou aceitação de pedidos pela unidade.
- Item com regra de dia, faixa ou feriado: **“Agora: a confirmar”**. Ele não é contado como disponível nem indisponível; o resumo explicita quantos aguardam confirmação.
- A prévia textual reage ao rascunho, mas “Agora” identifica a regra salva. Não há endpoint contratado de avaliação de rascunho.
- Portanto, **avaliação completa do “agora” e prévia operacional ao vivo continuam pendências do gateway**, expostas na tela e neste relatório, sem simular suporte em produção.

## Prints e teste no navegador

Capturados no Chromium com **locale `pt-BR`**, fuso `America/Sao_Paulo`, em servidor local isolado. São os componentes reais da nova tela, dentro de uma moldura de demonstração com cores/componentes Luxtia; não representam acesso autenticado ou dados de produção. Todas as imagens estão marcadas como dados fictícios.

1. [Lista no computador](prints-cardapio/01-lista-computador.png)
2. [Lista no celular](prints-cardapio/02-lista-celular.png)
3. [Item e disponibilidade](prints-cardapio/03-item-disponibilidade.png)
4. [Lote em andamento](prints-cardapio/04-lote-em-andamento.png)
5. [Filtro Sem preço](prints-cardapio/05-sem-preco.png)
6. [Visão do atendente](prints-cardapio/06-visao-atendente.png)

Roteiro reproduzível em `tests/visual/cardapio/`: navegação com Enter/Tab/Escape; filtros e URL após reload; rascunho preservado ao cancelar descarte; horário sem AM/PM; lote de sete itens com seis sucessos e uma falha simulada; largura móvel sem transbordamento; atendente sem checkbox de seleção, switch ou botão de salvar; zero erros JavaScript. Escritas do roteiro são somente em memória, sem rede para o gateway.

Validação final:

- `bun test`: **117 aprovados, 6 ignorados, 0 falhas**, 871 verificações. Os seis ignorados são integrações REST antigas sem ambiente dedicado.
- `tsc --noEmit`: aprovado.
- ESLint de todos os arquivos da entrega: zero erros/avisos.
- Build Vite local: aprovado; nenhum build Docker nem troca da imagem publicada.
- Build local: zero valores da chave de serviço e zero referências ao endereço interno/variáveis de gateway no frontend.
- Chromium: seis capturas e todas as verificações do roteiro aprovadas, zero erros JavaScript. Capturas inspecionadas visualmente.
- Testes adicionais: projeção de descrição sem observação interna; leitura de todas as páginas; cursor repetido; filtros/URL; ordenação persistente de categorias após busca; disponibilidade desconhecida; resumo/madrugada; horário de teclado numérico; lote deduplicado com falha parcial e sem repetição automática.

## Pedido de contrato ao gateway — não implementado no painel

| Necessidade | Contrato a fechar | Permissões propostas |
|---|---|---|
| Editar nome, descrição, preço, ativo e categoria | Ampliar o `PATCH /admin/v1/tenants/{t}/catalogo/itens/{id}` existente, hoje limitado a `disponibilidade`. Campos opcionais independentes: `nome`, `descricao`, `preco`, `ativo`, e representação formal de categoria (`categoria` atual ou `categoria_id` futuro). Omitido preserva o valor; definir onde null apaga. Retornar o item completo atualizado | admin/plataforma; membro somente GET. Conferir papel e tenant no gateway, além do painel |
| Validações | Nome obrigatório, limites de nome/descrição; preço positivo ou null, precisão monetária e arredondamento; ativo booleano; categoria pertencente à empresa. Rejeitar campos extras. Erros em `erro` com `detalhes.campo` | Sem ampliação de acesso por corpo/cabeçalho do navegador |
| Detalhe atual e concorrência | Publicar GET individual ou garantir equivalente; controle de versão/`atualizado_em` com 409 para edição concorrente. Unidade e ID imutáveis ou regra explícita | Consulta na própria empresa |
| Seletor de categorias | Publicar leitura administrativa de categorias da empresa com ID estável, nome e ordem; definir renomeação/movimentação e impacto. Nenhuma rota nova presumida como existente | membro lê; alterações só admin/plataforma |
| Auditoria | Registrar campos alterados, antes/depois e X-Actor em `/gestao/alteracoes`; preservar pedidos já fechados. Definir efeito sobre carrinhos abertos ao trocar preço/ativo | Histórico conforme papel já contratado |
| Disponibilidade atual | Incluir avaliação por item no GET admin: booleano, motivo, instante/fuso de referência e calendário usado. Definir semântica para inativo/sem preço/estoque/unidade fechada. Endpoint admin de prévia de disponibilidade não persistida, com corpo e resposta publicados | membro pode consultar; prévia não grava |
| Escala do catálogo | Contagens/facetas e filtros de disponibilidade/preço/categoria no servidor, com paginação consistente, para substituir o carregamento completo ao crescer | Mesmo isolamento por tenant |

Os caminhos/campos desta tabela que ainda não existem são **propostas para negociação**, não chamadas implementadas. Nenhuma edição de preço, nome, descrição, ativo ou categoria foi liberada.

## Publicação autorizada — 13/10/2026

- Imagem de volta: `painel:volta-cardapio-756361eb4dd0`, ID `sha256:756361eb4dd086c3d36a5c5994a05fd719812d03fa2dbc385ffdd4b020593c4e`; tag conferida antes do build. A tag identifica o conteúdo da imagem anterior, pois ela incluía entregas locais sem commit correspondente; não foi atribuída uma revisão Git incorreta.
- Backup: `/home/twadmin/backups/painel/pre-cardapio-ux-20261013T015126Z`; diretório 700, dump/ambiente/Compose 600, fora do Git. `pg_dump -Fc` e `pg_restore --list` aprovados. SHA-256 do dump: `5eea0ed9f311aa6321eeca19a46188dba8faa95db3c2f73f37f51f1dae755353`.
- Build Docker aprovado. Nova imagem: `painel:cardapio-ux-20261013`, ID `sha256:077a798d9a729c08672137909411eefa415cffc1774949c28cbd729ca0fa97d2`, conferida contra o container em execução.
- Bundle da imagem: zero valores da chave e zero referências internas do gateway no frontend; leitura da chave somente no servidor. Logs do novo painel: zero ocorrências dos segredos comparados em memória.
- Publicação: `docker compose up -d --no-deps --no-build painel`. Comparação dos IDs confirma somente painel recriado; gateway, workers, agendador, bancos, Redis, autenticação, REST e Caddy preservados.
- Verificação autenticada pelo servidor do painel, exclusivamente de leitura: **888 itens e quatro unidades do By Koji**, zero escritas. A primeira tentativa imediatamente após o startup ainda não completou a leitura; repetição com serviço pronto aprovada, sem alteração de código ou dados.
- HTTPS: `/`, `/ia/cardapio`, `/ia/pedidos`, `/auth/v1/health` e `/gateway/health` → 200; `/gateway/admin/v1/tenants` → 404.
- A verificação pós-publicação foi HTTP e chamada autenticada da função de servidor usada pela tela. Não houve nova navegação visual em produção; as seis capturas e testes Chromium acima continuam sendo do ambiente isolado.
- Mantido **“Agora: a confirmar”** para itens com restrição, até contrato de avaliação do gateway. Nenhum item/unidade alterado, chamada ao Skyone, migração ou prune.

Volta, se necessária: conferir `docker image inspect painel:volta-cardapio-756361eb4dd0`, executar `docker tag painel:volta-cardapio-756361eb4dd0 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Nenhuma migração foi feita; manter banco e ambiente, sem restaurar dump sobre a base em uso.

**Parada: publicação concluída; aguardar uso e retorno do Marco.**
