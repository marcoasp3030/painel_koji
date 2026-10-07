# Roadmap Luxtia

- [x] Banco: tenants, tenant_users, user_roles, integrations + RBAC/RLS
- [x] Login multi-tenant e bootstrap do Super Admin
- [x] Painel Super Admin (criar/gerenciar tenants e acessos)
- [x] Página de integrações (iFood, 99Food, WhatsApp Oficial, Uazapi)
- [x] Equipe do tenant
- [x] Botão "testar conexão" em cada integração (com tempo limite e feedback)
- [x] Auditoria: tabela audit_logs + página de histórico
- [x] Guarda de rota /admin apenas para Super Admin
- [ ] Proteção contra manipulação de tenant_id (bloqueio server-side + log de segurança)
- [ ] Filtros na auditoria (cliente, usuário, ação, período) com persistência na URL
- [ ] Mensagens amigáveis para timeout, resposta lenta e credenciais parciais nos testes
- [ ] Relatório final de validação
