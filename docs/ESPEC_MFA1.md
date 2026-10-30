# MFA1 — verificação em duas etapas robusta

**Situação: especificação para implementação. Nada publicado nesta entrega. A obrigatoriedade ampla só liga depois de confirmar fator + códigos no Marco e na conta de emergência.**

Consulta ao banco do painel em 30/10/2026, ~14:05 (Brasília). Horários abaixo em Brasília. Segredos TOTP e hashes de recuperação não são citados.

## 0. Estado atual (antes do MFA1)

### 0.1 Marco (`marco.santos@ticway.com.br`)

| Campo | Valor |
|---|---|
| Papel | `super_admin` → plataforma |
| Fator GoTrue | **1× TOTP** `verified`, `friendly_name = Luxtia`, id `b25803dd-…` |
| Criado / verificado | 30/10 13:47 (desafio verificado no mesmo minuto, IP `179.179.22.125`) |
| Sessão vigente | id `80d3f5bb-…`, **`aal = aal2`**, `factor_id` = o TOTP acima (atualizada 13:47) |
| Códigos de recuperação | **0** hashes em `conta_seguranca.codigos_recuperacao` |
| Prazo legado | `prazo_ate` 04/11 18:14 ainda gravado (a UI some com fator ativo) |

Conclusão: o Microsoft Authenticator ficou como fator **TOTP verificado** no GoTrue, e a sessão dele **chega a aal2**. Falta gerar e guardar os códigos de recuperação antes de qualquer obrigatoriedade dura.

### 0.2 Conta de emergência (`admin@luxtia.local`)

| Campo | Valor |
|---|---|
| Fatores | **nenhum** |
| Sessões recentes | todas **`aal1`**, sem `factor_id` |
| Códigos | **0** |
| `emergencia` | verdadeiro |

### 0.3 Outras contas de plataforma

| E-mail | Fatores | Códigos | Prazo |
|---|---|---|---|
| `cesar.almeida@luxtia.ia.br` | 0 | 0 | 05/11 13:48 |
| Base inteira | 1 TOTP verificado (só o Marco) | — | — |

### 0.4 O que o código faz hoje

- Obrigatoriedade: só **plataforma** (7 dias a partir do primeiro login da versão) e **emergência** (bloqueio imediato sem fator). Gestor opcional. Supervisor/funcionário sem regra.
- UI: faixa âmbar/vermelha com **“Ativar agora”**; cadastro QR → 6 dígitos → **8** códigos (hash SHA-256). Botão Segurança na barra.
- Login: se `nextLevel === aal2`, pede TOTP ou código de recuperação. Usar recuperação **apaga todos os fatores** e deixa a conta em aal1 de novo.
- Servidor: `requireSupabaseAuth` valida JWT; **não lê `aal`**. Funções usam `service_role` em várias tabelas sensíveis — RLS do usuário autenticado não cobre essas escritas.
- RLS: `conta_seguranca` só `SELECT` da própria linha; **sem exigência de aal2**.
- Sem step-up, sem limite de tentativas próprio, sem 2º aparelho TOTP, sem reset por outra conta, sem alerta Telegram.
- Funções úteis já existem: `fatores_verificados(uid)`, `derrubar_sessoes(uid)`.

### 0.5 Lacunas vs. pedido MFA1

| Pedido | Hoje |
|---|---|
| Gestor obrigatório; supervisor/funcionário opcionais com flag da empresa | Não |
| Toda função de servidor confere aal | Não |
| RLS sensível exige aal2 | Não |
| 10 códigos; regenerar; 2 TOTP; reset auditado | 8 códigos; usar = desligar fator; 1 TOTP; sem reset |
| Step-up 15 min | Não |
| Bloqueio de tentativas; derrubar outras sessões; sem “lembrar” em plataforma/gestor | Parcial / não |
| Auditoria tipada + alerta Telegram | Só login emergência e uso de recuperação (texto livre) |
| Confirmar Marco + emergência com fator e códigos antes da obrigação | Marco tem fator, **sem códigos**; emergência **sem fator** |

---

## 1. Objetivo

Tornar a segunda etapa (TOTP via GoTrue) obrigatória onde importa, imposível de contornar no servidor, recuperável sem trancar a operação, com step-up nas ações críticas e auditoria/alerta. Testes só em **conta de teste**. Contas reais de plataforma não são trancadas nesta entrega. Publicação só depois de prints e da confirmação do item 8.

## 2. Papéis e obrigatoriedade

| Papel | Segunda etapa |
|---|---|
| plataforma | sempre obrigatória |
| gestor | sempre obrigatória |
| supervisor | opcional; vira obrigatória se a empresa marcar `mfa_obrigatorio` |
| funcionario | idem supervisor |
| conta de emergência | sempre obrigatória, sem prazo de graça |

- Quem é obrigado e **não tem** fator `verified`: a sessão autentica a senha (aal1) e **só** acessa cadastro/verificação do fator. Qualquer outra função de servidor responde 403 com código `mfa_obrigatorio`. A UI abre direto o fluxo QR + código (e depois os códigos de recuperação).
- Prazo de 7 dias: **remove-se** para plataforma e gestor no MFA1 (bloqueio assim que a obrigação estiver ligada). Até lá, o código novo pode ficar atrás de flag `MFA1_OBRIGATORIO=0` (padrão desligado na imagem até a confirmação do §8).
- Flag por empresa: coluna `tenants.mfa_obrigatorio boolean not null default false`. Só plataforma e gestor alteram. Vale para supervisor e funcionário daquela empresa.

## 3. Imposição no servidor e RLS

### 3.1 Nível da sessão

O JWT do GoTrue carrega `aal` (`aal1` | `aal2`). O middleware autentica e expõe `claims.aal` (e `amr` se existir).

Regras por função:

1. **Públicas de MFA** (estado, enroll assistido, guardar códigos, challenge/verify proxy se houver, usar/regenerar recuperação, step-up verify): exigem sessão autenticada; aal1 basta.
2. **Demais funções de servidor**:
   - Se o usuário **é obrigado** ou **já tem ≥1 fator verified**: exige **`aal === aal2`**. Caso contrário → 403 `mfa_aal`.
   - Se não é obrigado e não tem fator: aal1 segue (comportamento atual).
3. Conta obrigada sem fator: só as funções do grupo (1) e leitura mínima de `estadoSeguranca` / perfil para montar a tela.

Implementação: middleware `requireAal` encadeado após `requireSupabaseAuth`, consultando papel + `fatores_verificados` + `tenants.mfa_obrigatorio` (cache curto por request). Funções sensíveis listadas no §5 usam ainda `requireStepUp`.

### 3.2 RLS

Políticas novas (authenticated) nas tabelas sensíveis exigem `auth.jwt() ->> 'aal' = 'aal2'` além das regras de papel já existentes (ou a criar):

- `user_roles`, `tenant_users`, `usuario_unidades`, `convites`, `conta_seguranca` (escrita), `integrations`, `webhook_events` (se exposto), `audit_logs` (insert via função/definer; select aal2), chaves de formulário / tabelas de chave se existirem no schema público.

Escritas que hoje passam por `service_role` **continuam** passando pelo admin, mas o **handler** já bloqueou aal1. RLS cobre qualquer acesso direto com a chave publishable + JWT.

Sessão aal1 de quem precisa aal2: não lê nem grava essas tabelas; só o fluxo MFA (enroll/verify/códigos) via funções dedicadas com `service_role` mínimo.

## 4. Fatores e recuperação

### 4.1 TOTP

- Até **2** fatores TOTP `verified` por conta (`friendly_name` distintos, ex. “Luxtia celular”, “Luxtia tablet”).
- Tolerância de relógio: padrão do GoTrue (não customizar janela no painel).
- Ao **ativar** ou **remover** um fator: chamar `derrubar_sessoes` mantendo só a sessão atual (ou derrubar todas e forçar login de novo — preferência: derrubar as **outras**).
- Remover o próprio fator: exige código TOTP válido de um fator restante **ou** um código de recuperação (consome o código). Se era o último fator e a conta é obrigada, a remoção é recusada até existir outro fator ou reset por outra conta.

### 4.2 Códigos de recuperação

- **10** códigos de uso único na ativação (formato atual `XXXX-XXXX`, alfabeto sem ambíguos).
- Guardados **só hash SHA-256**; texto mostrado **uma vez**.
- Regenerar: exige TOTP válido (ou um código de recuperação ainda não usado); invalida os hashes anteriores; mostra 10 novos uma vez; audita `mfa.recuperacao_regenerada`.
- Usar no login (quando `nextLevel === aal2`): consome 1 hash, eleva a sessão a aal2 **sem** apagar os TOTP. (Mudança em relação ao comportamento atual.)
- Se restarem ≤2 códigos, a UI avisa para regenerar.

### 4.3 Reset por outra conta

- Plataforma pode resetar o fator de qualquer conta.
- Gestor pode resetar supervisor/funcionário (e outro gestor?) **da própria empresa** — decisão: gestor reseta supervisor e funcionário da empresa; não reseta outro gestor nem plataforma.
- Exige: motivo (≥3 caracteres), step-up do ator, auditoria `mfa.reset`, alerta Telegram.
- Efeito: apaga fatores GoTrue da vítima, zera códigos, derruba sessões da vítima. A vítima, no próximo login, cai no cadastro obrigatório.

## 5. Step-up (15 minutos)

Antes de ações críticas, a sessão precisa de verificação MFA recente (`step_up_ate` em `conta_seguranca` ou claim/custom table `mfa_step_up(user_id, valido_ate)`):

- criar/alterar usuário ou papel
- chaves de formulário / API
- webhooks
- integrações
- exportar (quando existir)
- publicar comportamento do agente

Fluxo: UI pede TOTP (ou recuperação); servidor grava `step_up_ate = now()+15min` (Brasília via `now()` timestamptz); funções checam `step_up_ate > now()`. Expirou → 403 `mfa_step_up` e a UI reabre o desafio.

Plataforma e gestor: **sem** “lembrar este aparelho”. Não há cookie de confiança de dispositivo.

## 6. Proteções

| Proteção | Regra |
|---|---|
| Tentativas | Contador por usuário (e IP opcional) em `mfa_tentativas`. Após **5 falhas** em 15 min: bloqueio **15 min**; audita `mfa.falhou`; na 5ª dispara alerta. |
| Sucesso | Zera o contador da janela. |
| Ativar/remover fator | Encerra outras sessões. |
| Lembrar aparelho | Inexistente para plataforma e gestor; para os demais também **não** nesta entrega (simples). |
| Relógio TOTP | Padrão GoTrue. |

## 7. Auditoria e alertas

Eventos em `audit_logs` com `action` estável (prefixo `mfa.`):

| action | Quando |
|---|---|
| `mfa.ativado` | fator verified |
| `mfa.removido` | unenroll próprio |
| `mfa.reset` | reset por outra conta |
| `mfa.falhou` | challenge/verify ou código inválido |
| `mfa.recuperacao_usada` | código de recuperação consumido no login |
| `mfa.recuperacao_regenerada` | novos 10 códigos |
| `mfa.step_up` | step-up concedido |
| `mfa.bloqueado` | limite de tentativas atingido |

Alertas (fila/chamada ao gateway Telegram **quando o endpoint existir**; até lá só `status = alerta` na auditoria):

- uso de código de recuperação
- login da conta de emergência (já existe)
- reset de fator
- 5+ falhas seguidas

## 8. UI

- Aviso âmbar → botão **“Ativar agora”** (já existe); **some** quando há ≥1 fator verified (e, se obrigatório, quando aal2).
- Obrigado sem fator: modal/tela cheia de cadastro, sem menu.
- Segurança: listar até 2 aparelhos, adicionar, remover (com código), regenerar códigos, ver quantos restam (não o texto).
- Gestor/plataforma: interruptor “Exigir segunda etapa para supervisor e funcionário” na empresa.
- Step-up: diálogo reutilizável “Confirme com o aplicativo”.

## 9. Ativação segura (ordem obrigatória)

1. Implementar + testes automatizados + conta de **teste** (nunca Marco/emergência como alvo de reset).
2. Prints da especificação (cadastro, login aal2, recuperação, step-up, bloqueio, reset).
3. **Antes de `MFA1_OBRIGATORIO=1`:**
   - Confirmar Marco: fator verified **e** `array_length(codigos_recuperacao) = 10`.
   - Confirmar emergência: fator verified **e** 10 códigos (Marco ativa na conta de emergência em sessão controlada, ou procedimento documentado).
4. Só então ligar a flag e publicar.
5. Esta entrega **não publica** e **não liga** a flag.

## 10. Migrações previstas

- `tenants.mfa_obrigatorio boolean not null default false`
- `conta_seguranca.step_up_ate timestamptz null`
- `conta_seguranca.mfa_bloqueado_ate timestamptz null`
- `conta_seguranca.mfa_falhas int not null default 0` (ou tabela `mfa_tentativas`)
- Ajuste: quantidade de códigos 8 → 10 no gerador e no schema de validação
- Políticas RLS com `aal = aal2`
- Função `sessao_aal()` helper se útil

## 11. Critérios de aceite

- [ ] Marco: TOTP verified + sessão aal2 (já) + 10 códigos (pendente)
- [ ] Emergência: TOTP + 10 códigos (pendente) antes da obrigação
- [ ] Conta de teste: enroll, login aal2, recuperação sem apagar TOTP, 2º aparelho, step-up 15 min, 5 falhas → bloqueio, reset por plataforma com motivo
- [ ] Função de servidor com aal1 + obrigação → 403
- [ ] Aviso some com fator ativo
- [ ] Prints em `docs/prints-mfa1/`
- [ ] Sem publicação até o §9

## 12. Fora de escopo

- WebAuthn / passkeys
- SMS/phone factor
- Alterar o GoTrue além da config já existente
- Endpoint Telegram no gateway (só gancho + auditoria até existir)
- “Lembrar aparelho” para qualquer papel
