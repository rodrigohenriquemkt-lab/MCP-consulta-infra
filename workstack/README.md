# Workstack

Pilha de sticky notes **sempre no topo** das outras janelas, para acompanhar fluxos de trabalho em andamento.

- Cada atividade vira uma nota; as mais novas ficam no topo da pilha (ordem de início).
- Prioridade por cor: vermelho, laranja, amarelo, verde, azul. Clique nas bolinhas do topo para filtrar.
- Passe o mouse numa nota para ver detalhes, trocar a cor, concluir, remover ou abrir o link de origem.
- `Ctrl/Cmd+Shift+Space` mostra/oculta a janela. Dados em `userData/workstack.json`.

## Rodar
```bash
cd workstack && npm install && npm start
npm test   # lógica da pilha
```

## Integrações (e-mail, Teams, etc.)
O app expõe `POST http://127.0.0.1:47800/ingest` (somente loopback). Qualquer fonte pode empurrar itens:
```bash
curl -X POST localhost:47800/ingest -H 'content-type: application/json' \
  -d '{"title":"Responder proposta ACME","source":"outlook","externalId":"AAMk...","url":"https://outlook.office.com/...","priority":"red"}'
```
`source + externalId` evita duplicatas (reenviar atualiza a nota). Aceita também um array.

### Critério de entrada na pilha
| Tipo | Entra quando | Prioridade |
|---|---|---|
| `email` | não lido ou sinalizado (e não enviado por você) | vermelho se importância alta/sinalizado |
| `chat` (Teams) | menção a você ou mensagem direta sem resposta | vermelho se menção urgente |
| `meeting` | começa nas próximas 24h e não foi recusada | vermelho se <2h ou <24h; laranja <72h |
| `task` | não concluída | por vencimento: <24h vermelho, <72h laranja, senão amarelo |

Regras em `connectors/normalize.js`. Entrada crua (formato Microsoft Graph) → nota:
```bash
echo '[{"id":"e1","subject":"Reunião ACME","start":{"dateTime":"2026-10-05T15:00:00Z"}}]' | node bin/push.js meeting
```

### Itens que você abre (observador de janela, Windows)
Com o app aberto, ele observa a janela em primeiro plano e, quando você fica 2 s num **e-mail/reunião aberto em janela própria (Outlook)** ou numa **conversa/canal/reunião do Teams (desktop)**, cria a nota. Reabrir não muda a posição; se estava concluída, volta para em andamento. Botão 👁 no topo pausa/retoma; `WORKSTACK_WATCH=0` desliga.
- Só lê o título de Outlook e Teams; qualquer outro app é descartado sem armazenar.
- **Novo Outlook:** o título da janela traz o assunto (formato `Assunto – Conta – Outlook`), inclusive no painel de leitura. Pastas personalizadas aparecem como se fossem assuntos: silencie-as com `WORKSTACK_IGNORE="Clientes,Projetos"`.
- **Outlook clássico:** só e-mails abertos em janela própria (duplo clique).
- WhatsApp Desktop só mostra "WhatsApp" no título, então vem pela coleta agendada (pergunta recebida e sem resposta sua).
- Para ajustar os padrões aos seus títulos reais: `$env:WORKSTACK_DEBUG_TITLES="1"; npm start` imprime `processo | título -> nota` no terminal.

### Abrir sem prompt: início com o Windows e tecla de atalho
- **Início automático (ligado por padrão):** o app cria o atalho `Workstack.lnk` na pasta de Inicialização do Windows (`Win+R` → `shell:startup`). O botão 🚀 liga/desliga (remove ou recria o atalho). Abra o app uma vez para o atalho ser criado.
- **Tecla de atalho para abrir:** `npm run instalar-windows` cria um atalho no Menu Iniciar com a tecla **Ctrl+Alt+W** (troque com `npm run instalar-windows -- -Hotkey "CTRL+ALT+K"`; remova com `-- -Remove`). Se o app já estiver aberto, a tecla só traz a janela para a frente.
- **Mostrar/ocultar com o app aberto:** `Ctrl+Shift+Espaço`.
- Requisito: a pasta do projeto deve ficar onde está (os atalhos apontam para ela) e o `npm install` já deve ter sido feito.

### Início automático e configurações
Botão 🚀 no topo liga/desliga a abertura junto com o Windows (esmaecido = desligado). As opções ficam salvas em `%APPDATA%\workstack\settings.json`, então não dependem de variáveis de ambiente da sessão:
```powershell
cd workstack
node bin/config.js inbox "C:\Users\VOCE\OneDrive - Gantech\workstack-inbox.json"
node bin/config.js ignore "Clientes,Projetos"
node bin/config.js autostart on
node bin/config.js            # mostra tudo
```
Variáveis de ambiente (`WORKSTACK_INBOX`, `WORKSTACK_IGNORE`, `WORKSTACK_WATCH=0`), quando definidas, têm precedência. No modo `npm start` o início automático aponta para a pasta atual do app: se você mover a pasta, desligue e ligue o 🚀 de novo.

### Duplicatas
E-mail e reunião com o mesmo assunto (ignorando `RE:`, `RES:`, `ENC:`, `FW:`, `Convite:`, `Atualizado:`, `Aceito:`… e um sufixo ` @ data`) viram **uma nota só**: a mais antiga mantém posição e cor, vira "reunião" se vier do calendário, e as duas origens ficam vinculadas (reenvios da coleta não recriam a nota). Chats e WhatsApp nunca se misturam. Notas abertas por você não são concluídas automaticamente pela coleta.

### Ponte na nuvem (quando a coleta roda na nuvem)
A tarefa agendada na nuvem não grava no seu computador. Ela envia a coleta a um pequeno serviço (`../workstack-relay`, em memória) por um conector MCP, e o app busca nele:
```powershell
node bin/config.js relay https://SEU-SERVICO.up.railway.app SEU_TOKEN
```
O app só aceita HTTPS e não imprime o token inteiro. Para desligar: `node bin/config.js relay off`. O token fica em `settings.json` (pasta do seu usuário).

### Coleta automática (OneDrive)
Uma tarefa agendada lê Outlook, Teams, calendário e WhatsApp, roda `bin/build-inbox.js` e grava `workstack-inbox.json`. Há duas versões do prompt:
- `collector/PROMPT.md` — **tarefa na nuvem** (claude.ai → Routines), que envia a coleta crua à ponte `../workstack-relay` pelo conector "Workstack Relay" (ver "Ponte na nuvem" acima). Não precisa de Node, de clone do repositório nem de permissão de escrita no OneDrive.
- `collector/PROMPT_COWORK.md` — alternativa **local**: rotina local do Claude Code Desktop (aba Code → Routines → New routine → Local) que grava a coleta crua na pasta do OneDrive. Só dispara com o app aberto e o computador ligado. (Tarefas do *Cowork* rodam na nuvem e não enxergam pastas locais.) Para a nuvem gravar no OneDrive seria preciso a permissão `Files.ReadWrite` no conector Microsoft 365; com a atual (leitura) o upload falha com 403.

O app lê o arquivo a cada 30 s e aceita tanto o arquivo já normalizado (`{items, okKinds}`) quanto a coleta crua (`{email, chat, meeting, whatsapp, failed}`): O app lê esse arquivo a cada 30 s:
```bash
WORKSTACK_INBOX="$HOME/OneDrive - Gantech/workstack-inbox.json" npm start   # ajuste o caminho
```
Itens que somem da origem (e-mail lido, reunião passada) são marcados como concluídos; a cor que você escolheu é preservada; tipos cuja coleta falhou não são alterados. Tarefas (To Do) ainda não são coletadas: não há ferramenta disponível.

Próximo passo (histórico): um *conector* (tarefa agendada no Claude, ou serviço usando Microsoft Graph) que varre Outlook/Teams e chama esse endpoint.
