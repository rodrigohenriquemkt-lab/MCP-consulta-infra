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

### Itens que você abre (observador de janela, Windows)
Com o app aberto, ele observa a janela em primeiro plano e, quando você fica 2 s num **e-mail/reunião aberto em janela própria (Outlook)** ou numa **conversa/canal/reunião do Teams (desktop)**, cria a nota. Reabrir não muda a posição; se estava concluída, volta para em andamento. Botão 👁 no topo pausa/retoma; `WORKSTACK_WATCH=0` desliga.
- Só lê o título de Outlook e Teams; qualquer outro app é descartado sem armazenar.
- **Novo Outlook:** o título da janela traz o assunto (formato `Assunto – Conta – Outlook`), inclusive no painel de leitura. Pastas personalizadas aparecem como se fossem assuntos: silencie-as com `WORKSTACK_IGNORE="Clientes,Projetos"`.
- **Outlook clássico:** só e-mails abertos em janela própria (duplo clique).
- **WhatsApp** não é observado: a janela do WhatsApp Desktop mostra só "WhatsApp" no título, sem dizer qual conversa. Para empilhar um assunto do WhatsApp, digite no campo "+ nova atividade" do widget.
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
E-mail e reunião com o mesmo assunto (ignorando `RE:`, `RES:`, `ENC:`, `FW:`, `Convite:`, `Atualizado:`, `Aceito:`… e um sufixo ` @ data`) viram **uma nota só**: a mais antiga mantém posição e cor, vira "reunião" se vier do calendário, e as duas origens ficam vinculadas. Chats nunca se misturam com e-mails e reuniões.

### Coleta agendada (removida)
O Workstack mostra **só o que você abre**. A coleta agendada do que está pendente (tarefa na nuvem + ponte no Railway + prompts do coletor) foi removida do projeto, porque Outlook, Teams e calendário já controlam seus próprios pendentes. O código que lia a ponte e o arquivo de troca (`pollRelay`/`pollInbox`, `config.js relay|inbox`, `connectors/`, `bin/push.js`, `bin/build-inbox.js`) continua no app, **inativo sem configuração**. A ponte e os prompts continuam no histórico do Git, até o commit `22138492`.
