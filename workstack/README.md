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

### Coleta automática (OneDrive)
Uma tarefa agendada no Claude (prompt em `collector/PROMPT.md`) lê Outlook, Teams e calendário, roda `bin/build-inbox.js` e grava `workstack-inbox.json` no OneDrive. O app lê esse arquivo a cada 30 s:
```bash
WORKSTACK_INBOX="$HOME/OneDrive - Gantech/workstack-inbox.json" npm start   # ajuste o caminho
```
Itens que somem da origem (e-mail lido, reunião passada) são marcados como concluídos; a cor que você escolheu é preservada; tipos cuja coleta falhou não são alterados. Tarefas (To Do) ainda não são coletadas: não há ferramenta disponível.

Próximo passo (histórico): um *conector* (tarefa agendada no Claude, ou serviço usando Microsoft Graph) que varre Outlook/Teams e chama esse endpoint.
