# workstack-relay

Ponte **em memória** entre a coleta agendada na nuvem e o app Workstack no desktop.

- A tarefa agendada (claude.ai) chama a ferramenta MCP `workstack_push_inbox` de um **conector personalizado** apontando para `https://<servico>/<TOKEN>/mcp`.
- O app busca `GET https://<servico>/inbox` com `Authorization: Bearer <TOKEN>` a cada 30 s.

## Privacidade e segurança
- Guarda **uma única coleta, só em memória**: cada envio substitui o anterior; nada em disco; expira em 24 h; reiniciar o serviço apaga tudo.
- Não registra conteúdo nem o token nos logs. Token errado responde 404.
- `RELAY_TOKEN` (mín. 32 caracteres) é obrigatório; sem ele o serviço não sobe.
- Ainda assim, a coleta contém assuntos de e-mails, trechos de conversas e nomes de contatos: confirme que a política da empresa permite essa infraestrutura.

## Rodar / testar
```bash
npm install
RELAY_TOKEN=$(openssl rand -hex 32) npm start
npm test
```

## Deploy (Railway)
Serviço com **Root Directory** `workstack-relay` e a variável `RELAY_TOKEN`. O `railway.json` já define build, start e healthcheck (`/health`).
