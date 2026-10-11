# PED1-b — avisos de pedido no painel

11/10/2026. Contrato: seção 13 de `gateway/docs/ESPEC_PED1.md`, consultada somente para leitura.

## Entrega

- `X-Role` em todas as requisições do cliente administrativo, junto de `X-Actor`. Tenant e papel resolvidos pelo perfil da sessão no servidor; campos de papel/autor enviados pelo navegador não são aceitos. Chamadas globais usam plataforma; chamadas de tenant usam o papel daquele vínculo.
- Configurações → Avisos de pedido (`/ia/configuracoes/avisos`), só admin/plataforma. Entrega e Retirada separadas, status recebidos do gateway, editor com variáveis, ajuda para trechos `[[ ]]`, liga/desliga por linha e restauração do padrão com confirmação. Prévia pelo gateway com e sem os dados opcionais, sem gravar nem enviar. Erros de texto junto ao editor. Proteção do rascunho ao trocar status, modalidade, empresa ou página.
- Pedidos: “Reenviar aviso” no evento em falha somente se `pode_reenviar=true`. Confirmação normal ou aviso explícito de possível entrega anterior quando `incerto=true`; somente neste caso envia `mesmo_incerto:true`. Sucesso significa enfileirado, nunca entregue. Detalhe e contador são atualizados após a chamada; conflitos não geram repetição automática.
- O contador `avisos_com_falha` já existia na tela; preservado, vindo de `/pedidos/contagem` e incluído na validação autenticada.
- Menu e layout adaptáveis: status em coluna no desktop e faixa horizontal no celular; botões e editor visíveis sem abrir modais sucessivos.

## Validação

- Testes: 87 aprovados, 6 integrações REST antigas ignoradas por ausência de ambiente dedicado, zero falhas; 655 verificações.
- Novos testes: três papéis em GET e escrita, chamadas globais, autor forjado, papel forjado, isolamento entre tenants, membro bloqueado com status 403 e mensagem legível, 403 do gateway, 400 no campo texto, prévia com sintaxe preservada, restauração com null, reenvio pelo membro e conflito incerto sem repetição automática.
- Testes de escrita utilizam HTTP simulado. Nenhuma configuração real de avisos ou pedido é alterada para testar a entrega.
- TypeScript (`tsc --noEmit`), ESLint dos arquivos alterados, build Vite e build Docker aprovados.
- Bundle: zero valores da chave; zero referências ao gateway interno no frontend; credencial lida somente pelo servidor.
- Validação autenticada pela sessão do painel: 12 avisos, prévia com/sem opcionais e contador aprovados. Zero escritas e zero envios.
- HTTP: `/`, `/ia/configuracoes/avisos`, `/ia/pedidos`, `/ia/conversas`, `/auth/v1/health` e `/gateway/health` → 200; `/gateway/admin/v1/tenants` → 404.
- Somente o container do painel mudou de ID. Gateway, workers, agendador, bancos, Redis, autenticação, REST e Caddy preservados. Zero segredos nos logs do painel novo.
- Imagem publicada e conferida: `painel:6027ea7`. Nenhuma validação pós-publicação falhou; rollback não necessário. Sem prune ou alterações no repositório gateway.

## Publicação e volta

- Estado local anterior de UX/operação/PED1-a preservado em commit separado `54188e4`, antes das alterações PED1-b.
- Imagem efetivamente em uso preservada antes do build como `painel:54188e4`: `sha256:9ae1c74e37140c5db8fd7799c19768dd0f337ce5cb41468cb5343f59f45b8ca6`.
- Backup `/home/twadmin/backups/painel/pre-ped1b-20261011T030002Z`: diretório 700, dump/ambiente/Compose 600, fora do Git; `pg_restore --list` aprovado. SHA-256 do dump: `3b62f91913316388ceadc018e3307cde53ddc88e6f2b262eb1b34896810038dd`.
- Volta sem migração: conferir `docker image inspect painel:54188e4`, executar `docker tag painel:54188e4 painel_koji-painel` e `docker compose up -d --no-deps --no-build painel`. Não restaurar o dump sobre o banco em uso.

## Conferência no navegador

1. Como admin/plataforma, abrir Configurações → Avisos de pedido, escolher empresa e modalidade. Cada status mostra se está ligado.
2. Editar texto com variável e trecho opcional, clicar Ver prévia e comparar as duas versões. A prévia não envia mensagens. Salvar somente quando desejar mudar a configuração operacional.
3. Restaurar padrão pede confirmação e afeta apenas o status/modalidade selecionados.
4. Como membro, o menu de configuração não aparece; chamadas forjadas para alterar texto são recusadas no servidor.
5. Em Pedidos, conferir o contador de falhas e a linha do tempo. O botão de reenvio aparece apenas quando permitido; confirmar reenvio tem efeito real e não deve ser usado apenas para inspeção visual.

Sem captura de telas ou navegação visual automatizada nesta entrega. Os pontos acima descrevem a implementação; inspeção visual final com Marco.
