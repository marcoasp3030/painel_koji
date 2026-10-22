# Auditoria de isolamento do painel (MULTI1-a)

**Data:** 15/10/2026. **Só leitura do gateway.** Escopo: o servidor do painel (`painel_koji`) antes de enviar `X-Tenant-Scope`.

## Resumo

O painel já impede que admin/membro de uma empresa peçam dados de outra: a empresa efetiva sai do perfil da sessão (`tenant_users` → `gateway_tenant_id`), e o corpo/URL do navegador só é aceito se bater com um vínculo ativo. A chave do gateway, o ator e o papel nunca vêm do navegador. Faltava o cabeçalho `X-Tenant-Scope` exigido pelo MULTI1-a e o filtro de menu/telas por módulo.

## O que já estava certo

| Ponto | Onde | Conclusão |
|---|---|---|
| Empresa da sessão | `resolverTenant` em `modulo.server.ts` | Sem `super_admin`, só vínculos ativos; outra empresa → `AcessoNegado`, sem chamada ao gateway |
| Papel | `X-Role` a partir do perfil | `plataforma` / `admin` / `membro`; valor forjado no corpo é ignorado |
| Ator | `X-Actor` = e-mail ou `userId` da sessão | Sanitizado; não aceita actor do navegador |
| Chave | `GATEWAY_PANEL_KEY` só no servidor | Fora do bundle do front (script de verificação) |
| Tabela `REGRAS` | `modulo.server.ts` | Operações fora da lista são recusadas para empresa antes do HTTP |
| Testes | `modulo.test.ts`, gestao/pedidos/avisos/cardapio | Isolamento entre empresas e actor/role forjados cobertos |

## Brechas e ajustes desta entrega

| # | Achado | Risco | Correção |
|---|---|---|---|
| 1 | Nenhuma chamada enviava `X-Tenant-Scope` | Com `ESCOPO_EMPRESA_OBRIGATORIO=on`, usuários de empresa ficam sem painel; sem a exigência, o gateway não confere a empresa da sessão | Enviar `X-Tenant-Scope` com o id **já resolvido pela sessão** em toda chamada de quem não é plataforma |
| 2 | Menu Cardápio / Pedidos / Avisos aparecia sem módulo | Empresa sem pedidos via telas de delivery | Filtrar pelo `telas` de `GET …/modulos` |
| 3 | Debug iFood e 99Food acessíveis a usuário autenticado comum | Telas de restaurante fora do papel plataforma | Só `super_admin` / plataforma |
| 4 | `carrinho_expira_h` e `acoes_recentes_min` no vocabulário do painel | Confusão se o esquema ainda trouxer; gateway já esconde e recusa | Esconder no painel quando pedidos não está em uso / ausentes do esquema |
| 5 | Campos de entrega/pagamento da unidade | Contrato pede mostrar só com pedidos em uso; o formulário atual ainda não os editava | Exibir e gravar só com `pedidos` em `em_uso` |

## Regras que o código deve manter

1. **Empresa nunca vem só do navegador.** Para não-plataforma, `data.empresa` no server fn é opcional e só escolhe entre vínculos da sessão.
2. **`X-Tenant-Scope` = resultado de `resolverTenant`, nunca o texto cru do body.**
3. **Plataforma** pode omitir o cabeçalho; continua vendo todas as empresas pelo caminho `/tenants/{id}/…`.
4. **Escrita de módulos da empresa** (`PUT …/modulos/{m}`) e de modelos (`POST`/`PATCH /modelos-agente`) só plataforma, também na tabela `REGRAS` / `sessao.plataforma()`.

## Fora desta auditoria

Isolamento das Skills (`X-API-Key`) e dos dados no Postgres do gateway — cobertos em `gateway/docs/AUDITORIA_MULTIAGENTE.md` e nos testes SEG/INV do gateway.
