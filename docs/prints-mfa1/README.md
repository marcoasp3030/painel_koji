# Prints MFA1

Capturas da especificação `docs/ESPEC_MFA1.md`. **Não publicados.**

## Estado atual (consulta 30/10/2026)

Ver seção 0 da especificação. Resumo:

| Conta | Fator TOTP | Sessão | Códigos |
|---|---|---|---|
| marco.santos@ticway.com.br | verified (`Luxtia`) | **aal2** | **0** — gerar antes do cutover |
| admin@luxtia.local | nenhum | aal1 | 0 |
| Conta de teste MFA1 | a criar | — | — |

## Roteiro de prints (conta de teste)

1. `01-aviso-ativar-agora.png` — faixa âmbar com botão Ativar agora
2. `02-cadastro-qr.png` — QR + chave manual + 6 dígitos
3. `03-codigos-recuperacao.png` — 10 códigos após confirmar
4. `04-login-aal2.png` — pedido de código TOTP após senha
5. `05-recuperacao-login.png` — entrada com código de recuperação (fator permanece)
6. `06-step-up.png` — diálogo antes de ação crítica
7. `07-bloqueio-falhas.png` — após 5 códigos errados
8. `08-reset-plataforma.png` — reset por outra conta com motivo

Flag `MFA1_OBRIGATORIO=0` até o §9 da ESPEC.
