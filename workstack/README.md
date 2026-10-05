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

Próximo passo: um *conector* (tarefa agendada no Claude, ou serviço usando Microsoft Graph) que varre Outlook/Teams e chama esse endpoint.
