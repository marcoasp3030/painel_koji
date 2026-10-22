# Telas — Comportamento do agente (CFG1)

**Situação:** especificação para aprovação. **Nada implementado no painel.** O gateway também não tem nada do CFG1 ainda: a `ESPEC_CFG1.md` está aprovada (seção 12), mas o CFG1-a não foi liberado.
**Data:** 11/10/2026.
**Fonte do contrato:** `gateway/docs/ESPEC_CFG1.md`, somente leitura. A seção 12 (decisões do Marco) vale sobre o texto das seções anteriores onde houver diferença.
**Regra deste documento:** nenhum campo, rota ou valor foi inventado. O que a tela precisa e o contrato não descreve está marcado como **Pendência Pn** e listado na seção 10.

O painel só fala com `/admin/v1` pelo servidor, com `X-Actor` e `X-Role` da sessão (`plataforma`, `admin` ou `membro`, que é o atendente). A chave do gateway não entra no navegador.

## 0. Ordem dos blocos

| Tela | Bloco do gateway | Quando pode ser implementada |
|---|---|---|
| 1. Personalidade | CFG1-a | Depois do CFG1-a publicado |
| 2. Comportamentos | CFG1-a (configuração). A execução vem em R1, G3 e no transbordo | Depois do CFG1-a. Os itens com `disponivel: false` aparecem como "em breve" |
| 4. Rascunho e publicar | CFG1-a | Junto com as telas 1 e 2 |
| 5. Histórico de versões | CFG1-a | Junto com as telas 1 e 2 |
| 3. Base de conhecimento | CFG1-b | Só depois do CFG1-b, que na fila do Marco vem bem depois (PED1-c → CFG1-a → G4 → G5/G6 → G3 → B4 → R1 → C1 → **CFG1-b** → carrossel) |

Proposta: implementar as telas 1, 2, 4 e 5 como um bloco só, porque dividem o mesmo rascunho e a mesma publicação. A tela 3 fica para o CFG1-b.

## 1. O que o painel tem hoje

- **Agente → aba Comportamento** (`src/components/luxtia/agente/Comportamento.tsx`). Edita, por `PATCH /tenants/{t}/agentes/{a}` e com efeito imediato:
  - `aviso_demora`, `slow_notice_s`, `fallback`;
  - `debounce_s`, `max_wait_s`, `pause_minutes`;
  - `modo_piloto`, `contatos_permitidos`, `alerta_telefone`;
  - `nome` (só a plataforma).
  
  Cada campo já mostra o valor efetivo e de onde ele vem (`origem_config`), e oferece "usar o padrão".
- **Simular** (`/ia/simular?agente=…`): só plataforma e admin. O gateway recusa a simulação se o agente estiver com `send_mode=live` (400, campo `send_mode`).
- **Configurações → Avisos de pedido** (PED1-b) é o modelo de tela com padrão, prévia e papel. Não entra no versionamento (CFG1, seção 5).
- Não existe tela de perfil, versões nem base de conhecimento.

## 2. Onde fica e como se navega

- **Menu IA → "Comportamento do agente"**, uma página com cinco abas: Personalidade, Comportamentos, Base de conhecimento, Publicar e Histórico.
- **Escopo**, num seletor no topo da página:
  - **Empresa (todos os agentes)**: `{escopo} = tenants/{t}`. É o padrão ao abrir.
  - **Um agente**: `{escopo} = tenants/{t}/agentes/{a}`. Guarda só o que difere da empresa (CFG1, seção 5).
  
  Ao trocar de escopo com alterações não salvas, a tela pede confirmação.
- A Base de conhecimento é sempre da empresa (CFG1, 7.1). Com um agente selecionado, a aba avisa: "A base vale para todos os agentes da empresa".
- **Cabeçalho fixo da página:**
  - segmento (nome de `GET /segmentos/{id}`);
  - versão publicada, com data e autor;
  - situação do rascunho ("Sem rascunho" ou "Rascunho de Ana, há 5 min, baseado na v7");
  - selo "Somente leitura" para quem não pode editar.
- **Agente → aba Comportamento**:
  - os campos que passam a ser versionados saem dela e dão lugar ao atalho "Editar em Comportamento do agente" (com o agente já selecionado);
  - piloto e `contatos_permitidos` ficam nela, com efeito imediato, porque ficam fora da versão (decisão 2);
  - `alerta_telefone` é antigo (CFG1, 1.2). O alerta passa a ser `transbordo_alerta`, que substitui `whatsapp_alerta_transbordo` (CFG1, seção 4). Sai da aba quando o CFG1-a estiver no ar.

### 2.1 Permissões

| Papel | Vê | Edita, salva rascunho, publica, restaura | Prévia | "Testar no Simular" | Base: testar busca | Base: alterar |
|---|---|---|---|---|---|---|
| plataforma | tudo | sim, inclusive os campos de operação | sim | sim | sim | sim |
| admin | tudo | sim, exceto operação (`editavel: false`) | sim | sim | sim | sim |
| membro (atendente) | tudo, só leitura | não: campos desabilitados, sem barra de publicação | sim (CFG1, 8.1: "qualquer papel") | não (Simular é só plataforma e admin) | sim | não |

- A tela decide o que habilitar pelo `pode_editar` do `GET` e pelo `editavel` de cada campo no `esquema`. O papel da sessão serve só para esconder botões. O gateway responde 403 a qualquer escrita de membro ou sem `X-Role`, e o painel trata o 403 como "Sem permissão para alterar".
- `instrucoes_agente` não aparece para a empresa em nenhuma tela (decisão 1). Continua na aba Avançado do agente, só para a plataforma.

## 3. Elementos comuns a todos os campos

### 3.1 Origem do valor e "voltar ao padrão"

Cada campo mostra, ao lado do rótulo, um selo com a origem tirada de `efetivo.origem`:

| Escopo aberto | Origem no contrato | Selo |
|---|---|---|
| Empresa | `segmento` ou `plataforma` | **Padrão do segmento** (cinza) |
| Empresa | `empresa` | **Personalizado** (dourado) |
| Agente | `segmento` ou `plataforma` | **Padrão do segmento** |
| Agente | `empresa` | **Da empresa** |
| Agente | `agente` | **Personalizado neste agente** |

- **"Voltar ao padrão"** aparece só quando o campo é personalizado no escopo aberto. Ele grava o campo com `null` no rascunho (decisão 4). Na empresa, o campo volta ao valor do segmento; no agente, volta ao valor da empresa. Antes de salvar, a tela mostra o valor que vai passar a valer (o do nível de cima, lido no `efetivo` do outro escopo ou no `esquema.padrao`).
- Um campo alterado no rascunho e ainda não publicado ganha um ponto azul e o texto "no rascunho".
- **Pendência P1:** a decisão 4 diz que o contrato informa `"segmento"` ou `"personalizado"`; a seção 8.1 mostra `plataforma`, `segmento`, `empresa` e `agente`. A tabela acima segue a 8.1. Falta confirmar também se `plataforma` pode aparecer no escopo da empresa e se deve ser mostrado como "Padrão do segmento" ou como "Padrão da plataforma".

### 3.2 Itens "em breve" (`disponivel: false`)

- Campo ou grupo com `disponivel: false` aparece **desabilitado**, com o selo **"em breve"** e a frase "Este recurso ainda não está ativo. A configuração fica guardada e passa a valer quando ele for liberado."
- Pela decisão 7, isso vale para reações (R1), fora do horário (G3) e transbordo.
- **Pendência P2:** a decisão 7 cita `"disponivel": false`, mas o exemplo do `esquema` (8.1) não traz o campo. Falta definir:
  - se ele vem em cada campo do `esquema` ou por grupo;
  - se dá para salvar um valor enquanto o recurso está indisponível. A proposta da tela é deixar só ver;
  - se `transbordo_alerta`, que já funciona hoje como `whatsapp_alerta_transbordo`, também vem como indisponível.

### 3.3 Erros e avisos

- Erro de validação do `PUT …/rascunho`: 400 com `detalhes: [{campo, motivo}]` para todos os campos de uma vez. Cada erro aparece embaixo do seu campo, e um resumo no topo da aba lista "N campos com erro", com link para cada um.
- Avisos (`avisos: [{campo, aviso}]`) não impedem salvar. Aparecem em amarelo embaixo do campo.
- **Pendência P3:** não há lista de valores de `motivo` para traduzir. Enquanto ela não vier, a tela mostra o texto que o gateway enviar.

## 4. Tela 1 — Personalidade

Campos da `ESPEC_CFG1`, seção 3.1. Tipos, limites e opções vêm do `esquema`. Os rótulos abaixo são só o texto da tela.

**Apresentação**

| Campo | Controle | Regra mostrada |
|---|---|---|
| `nome_atendente` | Texto curto | 2–30 caracteres, só letras, espaço, hífen e apóstrofo. Vazio = "o agente não diz nome" |
| `apresentacao_inicial` | Interruptor "Se apresenta na primeira mensagem" | — |

**Jeito de falar** (botões segmentados, um por linha, cada um com um exemplo curto de frase)

| Campo | Opções na tela |
|---|---|
| `tom` | Formal · Equilibrado · Descontraído |
| `emojis` | Nenhum · Moderado · Bastante |
| `tamanho_respostas` | Curtas · Médias |
| `tratamento` | Você · Senhor/Senhora |
| `sugestoes` | Desligado · Leve, com a ajuda "oferece um acompanhamento quando faz sentido" |
| `pedir_nome` | Interruptor, com a ajuda "Pergunta o nome uma vez e passa a usá-lo. O nome aparece em Conversas como 'informado' (PED1-c)" |

**Boas-vindas e despedida**

- `mensagem_boas_vindas` e `mensagem_despedida`: texto de até 300 caracteres, com contador.
- Ajuda fixa: "O agente usa este texto como base e adapta ao que o cliente escreveu. O sistema não envia a mensagem sozinho" (decisão 3).
- Validação mostrada: sem link, e-mail ou telefone.

**Regras da casa**

- Área de texto com dois contadores ao vivo: **caracteres (até 1500)** e **quebras de linha (até 20)**. O contador fica dourado a partir de 90% e vermelho acima do limite. Acima do limite não dá para salvar.
- Ajuda fixa, de CFG1 3.1: "Escreva preferências de atendimento da sua casa. Elas não mudam preços, prazos, regras de pedido nem as regras de segurança do sistema."
- **Bloqueio do gateway (decisão 6).** Quando o texto tiver um padrão claro de instrução de sistema ("ignore as instruções", "responda em JSON", "você agora é", "esqueça", pedido de dados de cartão ou senha):
  - a publicação fica bloqueada;
  - a tela marca o trecho em vermelho dentro da própria área de texto e mostra a mensagem do gateway embaixo ("Trecho não permitido: …");
  - o botão Publicar fica desabilitado até o texto mudar.
- **Casos duvidosos (decisão 6).** O trecho é marcado em amarelo, com a mensagem do gateway. Salvar o rascunho continua possível. Ao publicar, um diálogo lista cada trecho duvidoso e exige que a pessoa marque "Revisei e quero publicar assim" antes de confirmar.
- **Pendência P4:** o contrato não descreve:
  - como o gateway devolve o bloqueio: código de erro, campo e posição do trecho (início e fim, ou o texto do trecho) e a mensagem;
  - como separa "bloqueio" de "duvidoso" na lista `avisos`;
  - qual campo o `POST …/publicar` recebe para registrar a confirmação explícita.
  
  Sem posição, a tela consegue mostrar a mensagem, mas não destacar o trecho.

**Assuntos proibidos**

- Lista editável de até 15 itens. Cada item tem `assunto` (3–80 caracteres) e `acao` (Recusar · Transferir), um botão de remover e alças para reordenar. O contador "N de 15" desabilita "Adicionar" no 15º item.
- Ajuda: "Recusar: o agente diz que não fala sobre isso. Transferir: passa para a equipe."
- **Pendência P5:** item com `acao: transferir` enquanto o motivo `assunto_proibido` está desligado. O contrato não diz se isso é erro, aviso ou se o gateway liga o motivo sozinho.

**Quando transferir para a equipe** (`motivos_transferencia`)

- Lista de interruptores com o catálogo da CFG1, seção 3.2, com estes rótulos:
  - Cliente pediu uma pessoa (`pediu_humano`)
  - Reclamação (`reclamacao`)
  - Pedido que precisa de confirmação (`pedido_para_confirmar`)
  - Pagamento (`pagamento`)
  - Restrição alimentar ou alergia (`restricao_alimentar`)
  - Evento ou encomenda (`evento_ou_encomenda`)
  - Fora do escopo (`fora_do_escopo`)
  - Assunto proibido (`assunto_proibido`)
- **`pediu_humano` e `reclamacao` aparecem ligados e travados** (decisão 5), com cadeado e esta explicação ao passar o mouse ou tocar: "Sempre ativo: o cliente que pede uma pessoa ou faz uma reclamação é sempre encaminhado à equipe. Não pode ser desligado."
- Ajuda geral: "Motivo desligado: o agente diz que não consegue ajudar com aquilo e oferece o que pode."
- **Pendência P6:** o `esquema` não diz quais motivos são fixos. Até ele dizer, a tela trava os dois da decisão 5. Falta também o `esquema` trazer a lista de opções do catálogo, para a tela não fixá-la no código.

## 5. Tela 2 — Comportamentos

São os comportamentos que o admin pode mudar (CFG1, seção 4). Cada grupo é um cartão recolhível, com um resumo de uma linha quando está fechado (por exemplo: "Espera: 4 s · curta 2,5 s · teto 12 s").

| Grupo | Campos (nome no contrato) | Observação na tela |
|---|---|---|
| **Reações** | `reacoes` (interruptor), `reacoes_emojis` (até 8, do conjunto permitido pela plataforma), `reacoes_max_dia` (0–10 por conversa por dia) | "em breve" até o R1. **P7:** o conjunto permitido de emojis tem de vir no `esquema` |
| **Botões e listas** | `botoes_interativos` (interruptor) | Ajuda: "Até 3 opções viram botões; de 4 a 10, lista. Desligado: opções numeradas em texto" |
| **Espera de mensagens** | `debounce_s` (1–15 s), `debounce_curto_s` (0,5–15 s), `debounce_incompleta_s` (1–15 s; vazio = usa `debounce_s`), `debounce_palavras` (1–50), `max_wait_s` (1–30 s), `media_wait_s` (0–60 s), `refazer_turno` (interruptor) | Uma linha do tempo ilustrativa mostra as três esperas e o teto. Se `max_wait_s` for menor que `debounce_s`, a tela avisa antes de salvar (limite já documentado em API_ADMIN) |
| **Aviso de demora** | `slow_notice_s` (≥ 0 s), `aviso_demora` (texto; vazio = sem aviso), `aviso_demora_janela_s` (0–3600 s) | Prévia do balão com o texto |
| **Fora do horário** | `fora_do_horario` (Só avisar · Atender), `fora_do_horario_mensagem` (até 500, com `{abre}` e `{unidade}`), `fora_do_horario_aceita_pedido` (sim/não) | "em breve" até o G3. A mensagem tem botões para inserir as variáveis e uma prévia com valores de exemplo. "Aceita pedido agendado" só aparece em "Atender" (decisão 8) |
| **Transbordo** | `transbordo_alerta` (telefone 10–15 dígitos), `transbordo_horario_equipe` (grade de horários), `transbordo_fora_do_horario` (até 500, com `{horario}`), `pause_minutes` (≥ 0 min) | Reaproveita o editor de grade de Unidades, porque o contrato fala em "mesma estrutura de horários das unidades". "em breve" conforme P2 |
| **Carrinho** | `carrinho_expira_h` (1–720 h) | — |
| **Mensagem de falha e outros** (recolhido, "Avançado") | `fallback`, `encerrar_vazia_min`, `history_turns`, `acoes_recentes_min` | **P8:** a CFG1 põe "ritmo" e "mensagens do gateway" como editáveis pelo admin, mas não lista estes quatro nominalmente. A tela segue o `editavel` do `esquema` |

- **Operação e proteção** (`send_mode`, `agente_mode`, piloto, simultaneidade, limite por contato, domínios do Skyone):
  - ficam fora do rascunho e da versão (decisão 2);
  - não são editados nesta tela;
  - um cartão "Operação" só de leitura mostra os valores efetivos, com link para onde a plataforma os altera.
  
  Isso evita a impressão de que entram na publicação.
- **Pendência P9:** a CFG1 diz que `transbordo_horario_equipe` usa "a mesma estrutura de horários das unidades", sem dizer o formato no JSON. A tela também precisa saber como mostrar `{horario}` na prévia.

## 6. Tela 3 — Base de conhecimento (CFG1-b)

Só depois do CFG1-b. Não tem rascunho: o que está ativo vale na hora (CFG1, 8.2).

**Resumo no topo** (`GET /tenants/{t}/conhecimento`): quantidade e limite de FAQ e de documentos e o espaço usado, em barras de uso. A 90% do limite, a barra fica dourada. Passar do limite devolve 409 com o limite e o uso, e a tela mostra "Limite do plano atingido (300 de 300)".
**Pendência P10:** o formato desse resumo não está descrito. A decisão 9 limita "Tamanho" em MB; a seção 7.4 fala em caracteres.

**FAQ**

- Barra com busca (`busca`), filtro por tag (`tag`) e filtro Ativas · Inativas · Todas (`ativo`).
- A lista mostra pergunta, começo da resposta, tags, interruptor ativo/inativo e quem alterou por último e quando. O interruptor usa `PATCH`, com efeito imediato e confirmação curta ("A resposta deixa de ser usada pelo agente agora").
- Novo e editar abrem um painel lateral com:
  - `pergunta` (5–300) e `resposta` (5–1500), com contadores;
  - `tags`: até 5, de 2–30 caracteres, em fichas.
- Apagar pede confirmação.
- **Pendência P11:** o formato da paginação da FAQ não está descrito.

**Documentos**

- Lista com título, origem (Texto · PDF), tamanho em caracteres, número de trechos, situação (Pronto · Processando · Erro, com a mensagem de erro) e interruptor ativo.
- Novo documento tem duas abas:
  - **Colar texto** (`{"titulo", "texto"}`);
  - **Enviar PDF**: arrastar e soltar, com o limite do plano exibido. Um PDF sem texto (escaneado) é recusado com a mensagem do gateway ("só PDF com texto; sem OCR", decisão 9).
- Enquanto a situação é "processando", a tela consulta de novo a cada poucos segundos, só com a aba visível.
- **Prévia dos trechos:** ao abrir um documento (`GET …/documentos/{id}`), os trechos aparecem numerados, como o agente os recebe (cerca de 800 caracteres, com 100 de sobreposição), com a sobreposição destacada em cinza.
- **Pendência P12:** o contrato não descreve:
  - o envio do PDF: tipo do corpo e nome do campo do arquivo;
  - o formato de cada trecho no `GET` do documento;
  - se a resposta já traz o texto do trecho ou só a quantidade.

**Testar a busca** (`POST …/conhecimento/buscar`, qualquer papel)

- Campo "Pergunte como um cliente perguntaria". O resultado mostra até 3 trechos, com fonte (FAQ ou documento e número do trecho) e relevância em barra.
- Sem resultado, a tela mostra "O agente responderia que não tem essa informação e ofereceria transferir" (CFG1, 7.3).

**Perguntas sem resposta** (`GET …/perguntas-sem-resposta`): lista com a pergunta e a data. Para quem pode editar, cada pergunta tem o atalho "Criar FAQ com esta pergunta". **Pendência P13:** o formato da lista não está descrito.

## 7. Tela 4 — Rascunho, publicar e prévia

### 7.1 Barra de rascunho

Fixa no rodapé das abas Personalidade e Comportamentos, só para quem pode editar.

- **Estado:**
  - "Sem alterações";
  - "N alterações não salvas" (só no navegador);
  - "Rascunho salvo · baseado na v7 · por Ana às 10:42".
- **Ações:**
  - **Salvar rascunho**: `PUT …/rascunho`, com `baseado_em` e só os campos alterados. Salvar não muda nada em produção. Fica disponível também por Ctrl+S. Ao sair da página com alterações não salvas, a tela pede confirmação. Não há salvamento automático: quem edita decide quando salvar.
  - **Descartar rascunho**: `DELETE …/rascunho`, com confirmação.
  - **Ver prévia**: abre a aba Publicar.
  - **Publicar**: leva à aba Publicar, porque publicar sempre passa pela prévia.

### 7.2 Aba Publicar

1. **O que muda:** a lista dos campos do rascunho, cada um com o valor publicado e o novo lado a lado e o selo de origem que vai passar a valer. A lista é montada com `publicado`, `rascunho` e `efetivo` do `GET`.
2. **O que vai ao agente:** `POST …/previa` com `{"fonte": "rascunho"}`. A tela mostra o bloco `perfil_atendimento` em dois modos:
   - **Legível** (padrão): uma linha por campo, em frases ("Tom: descontraído", "Emojis: nenhum", "Regras da casa: …");
   - **Como o agente recebe**: o JSON exato, em fonte monoespaçada, com botão Copiar.
   
   Também mostra `perfil_versao`. Um seletor "Rascunho · Publicado" alterna a `fonte`. A prévia fica disponível a qualquer papel, inclusive ao membro, que não vê o resto da aba.
3. **Verificações:** antes de liberar o botão, a tela mostra os erros, os bloqueios das regras da casa e os avisos. Bloqueio impede publicar; duvidoso pede a confirmação descrita na seção 4.
4. **Nota da versão:** texto opcional, por exemplo "tom mais informal".
5. **Publicar**: `POST …/publicar` com `{"baseado_em", "nota"}`. Em caso de sucesso, aparece "Publicado como v8. Vale em até 30 segundos" e o cabeçalho é atualizado.
   - 409 `versao_desatualizada`: "Outra pessoa publicou a v8 enquanto você editava." A tela oferece **Ver o que mudou**, que abre o histórico na v8, e **Atualizar meu rascunho**. **Pendência P14:** o contrato não diz como refazer o rascunho sobre a nova versão (reenviar o `PUT` com o novo `baseado_em`?) nem o que acontece com os campos que os dois mexeram.
   - 409 `sem_rascunho`: "Não há rascunho para publicar"; a tela recarrega.
   - 400: o rascunho não valida mais; a tela volta às abas com os erros marcados.

### 7.3 "Testar no Simular"

- O botão fica na aba Publicar e no cabeçalho. Abre `/ia/simular?agente={a}` numa aba nova. No escopo da empresa, pergunta antes qual agente usar.
- O texto ao lado do botão é honesto quanto ao que é testado: "O Simular usa a **versão publicada**." O pacote sempre leva a versão publicada (CFG1, seção 5), e o contrato não tem simulação com o rascunho.
- **Pendência P15:** para testar o rascunho antes de publicar, o gateway precisaria de uma forma de simular com o rascunho. Isso não está na CFG1. Sem isso, o fluxo seguro é: publicar, testar no Simular e, se não gostar, restaurar a versão anterior.
- **Pendência P16:** o Simular é recusado quando o agente está com `send_mode=live` (caso do `bykoji_atendimento` hoje). Nesse caso, o botão fica desabilitado com a explicação "Este agente está com envio real; o Simular só funciona em envio de teste". Falta decidir se a plataforma quer um caminho para testar agentes em produção.
- Membro não vê o botão.

## 8. Tela 5 — Histórico de versões

- **Lista** (`GET …/versoes`, paginada por `proximo_cursor`). Cada linha mostra:
  - "v8";
  - data e autor;
  - a nota;
  - o selo "restaurada da v3" quando `restaurada_de` vier preenchido;
  - os campos alterados em fichas legíveis ("Tom", "Reações"), a partir de `campos_alterados`.
  
  A versão publicada tem o selo "Em uso".
- **Detalhe** (`GET …/versoes/{n}`), num painel lateral: a tabela `alteracoes` com campo, antes e depois. Textos longos (regras da casa) aparecem em comparação por linha, com o que saiu em vermelho e o que entrou em verde.
- **Comparar duas versões:** o usuário marca duas versões na lista e escolhe "Comparar". A tela busca as duas versões inteiras e mostra lado a lado só os campos diferentes. Essa comparação é feita no navegador, a partir das versões completas.
- **Pendência P17:** falta saber se a "versão inteira" traz só o que aquele escopo definiu ou o resultado da herança. Comparar só o que o escopo definiu pode esconder mudanças que vieram do segmento.
- **Restaurar** (`POST …/versoes/{n}/restaurar`, com nota opcional), só para quem pode editar:
  - um diálogo mostra a comparação "versão atual × v3";
  - explica: "Cria uma nova versão (v9) com o conteúdo da v3. Nada do histórico é apagado";
  - depois de restaurar, aparece "Restaurada como v9".
- **Pendência P18:** o contrato não diz o que acontece com um rascunho aberto quando alguém restaura, nem se a restauração verifica `baseado_em` (concorrência). Até isso vir, a tela avisa antes de restaurar: "Existe um rascunho de Ana baseado na v7; ele continuará baseado em uma versão antiga."
- Membro vê a lista e as comparações, mas não o botão Restaurar.

## 9. Testes do painel (quando for implementar)

- **Papéis:**
  - membro vê tudo desabilitado, sem barra de rascunho, sem Restaurar e sem "Testar no Simular", mas abre a prévia e testa a busca da base;
  - admin não edita campo com `editavel: false`;
  - um 403 do gateway mostra "Sem permissão".
- **Selos de origem:** os cinco casos da seção 3.1 nos dois escopos. "Voltar ao padrão" envia o campo com `null` e mostra o valor que vai valer.
- **"em breve":** um campo com `disponivel: false` fica desabilitado, com o selo, e não entra no `PUT`.
- **Motivos fixos:** `pediu_humano` e `reclamacao` ficam travados e ligados e não saem no `PUT` como desligados.
- **Regras da casa:**
  - os contadores de caracteres e de quebras de linha funcionam e bloqueiam acima do limite;
  - um bloqueio desabilita Publicar e destaca o trecho;
  - um caso duvidoso exige a confirmação antes de chamar `publicar`.
- **Erros:** um 400 com vários `detalhes` marca todos os campos de uma vez.
- **Publicar:**
  - 409 `versao_desatualizada` mostra o diálogo com as duas saídas;
  - 409 `sem_rascunho` recarrega;
  - sucesso atualiza a versão no cabeçalho.
- **Prévia:** mostra exatamente o JSON devolvido; o seletor de fonte alterna rascunho e publicado.
- **Histórico:** paginação, selo "restaurada da", comparação entre duas versões e confirmação antes de restaurar.
- **Isolamento:** escopo de outra empresa ou de agente de outra empresa vira 404 e a tela mostra "não encontrado".
- **Base (CFG1-b):**
  - limites do plano com 409;
  - situação "processando" com nova consulta;
  - PDF recusado com a mensagem do gateway;
  - busca sem resultado;
  - interruptor ativo/inativo.

## 10. Pendências do contrato (para o gateway resolver antes de implementar)

| # | Pendência | Onde afeta |
|---|---|---|
| P1 | Valores de origem: `segmento`/`personalizado` (decisão 4) × `plataforma`/`segmento`/`empresa`/`agente` (8.1); como mostrar `plataforma` | Selo de cada campo |
| P2 | Onde vem `disponivel` (por campo ou por grupo); se dá para salvar valor indisponível; se `transbordo_alerta` está disponível | "em breve" |
| P3 | Lista de valores de `motivo` dos erros de validação | Mensagens de erro |
| P4 | Formato do bloqueio e do caso duvidoso nas regras da casa (posição do trecho, mensagem, severidade) e campo de confirmação no `publicar` | Regras da casa e publicação |
| P5 | Assunto proibido com "transferir" e motivo `assunto_proibido` desligado | Assuntos proibidos |
| P6 | `esquema` indicar os motivos fixos e trazer o catálogo de motivos | Motivos de transferência |
| P7 | Conjunto de emojis de reação permitidos no `esquema` | Reações |
| P8 | Se `fallback`, `encerrar_vazia_min`, `history_turns` e `acoes_recentes_min` entram na versão e são editáveis pelo admin | Comportamentos → Avançado |
| P9 | Formato de `transbordo_horario_equipe` e de `{horario}` | Transbordo |
| P10 | Formato do resumo da base; limite em MB × caracteres | Base: resumo |
| P11 | Paginação da FAQ | Base: FAQ |
| P12 | Envio do PDF e formato dos trechos no `GET` do documento | Base: documentos |
| P13 | Formato de "perguntas sem resposta" | Base |
| P14 | Como refazer o rascunho depois do 409 `versao_desatualizada` | Publicar |
| P15 | Simular com o rascunho (não existe) | "Testar no Simular" |
| P16 | Simular recusado com `send_mode=live` | "Testar no Simular" |
| P17 | Se `GET …/versoes/{n}` traz o que o escopo definiu ou o efetivo | Comparação |
| P18 | Restaurar com rascunho aberto e concorrência na restauração | Restaurar |
| P19 | `recursos` (botões, lista, reações) vai no pacote (9.1), mas não está na resposta da prévia (8.1). A prévia mostra só `perfil_atendimento` | Prévia |

Fora deste bloco:
- avisos de pedido (já têm tela própria, PED1-b);
- piloto, `send_mode` e chaves de emergência, que continuam com efeito imediato;
- `instrucoes_agente`, só para a plataforma.
