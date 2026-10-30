# Entrada — prints (ANTES / DEPOIS)

Especificação: `docs/ESPEC_ENTRADA1.md`. Dados fictícios.

## Antes (30/10/2026)

Réplica das telas anteriores a ENTRADA1.

| Arquivo | Tela |
|---|---|
| `antes-01-login-*.png` | Login |
| `antes-02-login-erro-*.png` | Erro genérico |
| `antes-03-segundo-fator-*.png` | Um campo só (TOTP ou recuperação) |
| `antes-04-criar-senha-convite-*.png` | Convite, mín. 8 |
| `antes-05-redefinir-ausente-*.png` | Sem “Esqueci a senha” |

## Depois

Prévia em `tests/visual/entrada/` (`PRINTS_PREFIX=depois`).

| Arquivo | Tela |
|---|---|
| `depois-01-login-*.png` | Mostrar/ocultar senha + Esqueci |
| `depois-02-login-erro-*.png` | “E-mail ou senha incorretos.” |
| `depois-03-segundo-fator-*.png` | 6 caixas + link recuperação |
| `depois-04-criar-senha-convite-*.png` | Mín. 12 + medidor |
| `depois-05-esqueci-senha-*.png` | Pedido ao gestor (sem SMTP) |
| `depois-06-nova-senha-*.png` | Redefinição por link |
