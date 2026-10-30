# ENTRADA1 — Login, MFA, senha e redefinição

Estado: implementação local. **Não publicar** até prints antes/depois e OK do Marco.

## Objetivo

Melhorar a entrada na plataforma sem mudar o contrato do GoTrue: login, segundo fator (6 dígitos + recuperação), senha forte no convite/redefinição, “Esqueci a senha” e link de reset pelo gestor (sem SMTP).

## Regras

| Tema | Regra |
|---|---|
| Tentativas | 5 falhas (senha ou MFA) na janela de 15 min → bloqueio 15 min por e-mail(+IP) |
| Mensagens | Login falho: “E-mail ou senha incorretos.” (não revelar se o e-mail existe) |
| Senha nova | Mín. 12, máx. 72; rejeitar comuns; medidor no cliente; validação no servidor |
| MFA na entrada | 6 caixas numéricas + colar; link “Usar código de recuperação” |
| Esqueci | Sem SMTP: “Peça ao gestor…”. Com SMTP: mensagem genérica + `generateLink` recovery |
| Gestor | Link `#redefinir=<token>` uso único, 24 h (igual ao convite) |
| Sessão | Após redefinir: `derrubar_sessoes`; após login ok: zera contador |
| Origem | Query `voltar=/rota` relativa — volta após login |

## Tabelas

- `entrada_tentativas` (chave, falhas, falha_em, bloqueado_ate) — só service_role
- `redefinicoes_senha` (token_hash, expira_em, usado_em, revogado_em) — só service_role

## Fora de escopo

- Cutover MFA1 (`MFA1_OBRIGATORIO`)
- SMTP obrigatório
- Alterar senha da conta de emergência pelo convite/reset de gestor
