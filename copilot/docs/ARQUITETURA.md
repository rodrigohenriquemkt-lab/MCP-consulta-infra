# Copiloto de reuniões Gantech — arquitetura e roadmap

## Fluxo

```
Teams / Zoom / Meet
   │  (bot participante — Recall.ai)
   ▼  transcrição em tempo real (webhook)
POST /webhooks/recall ──► MeetingSession ──► gatilho (palavras/pergunta/debounce/cooldown)
                                                │
   Briefing pré-reunião (CRM + infra + extras) ─┤  (cacheado no prompt)
   Catálogo do portfólio (data/portfolio.json) ─┤
                                                ▼
                                   Claude (brain.js) ── ferramentas sob demanda:
                                        • analisar_infra_cliente → MCP de infra (este repo)
                                        • buscar_crm             → MCP do CRM Gantech
                                                │ JSON estruturado
                                                ▼
                     servidor anexa links REAIS do catálogo ──► SSE ──► /console/:id
                                                                       (painel privado)
```

## Como cada requisito é atendido

| Requisito | Implementação | Estado |
|---|---|---|
| Transcrição em tempo real (Teams/Zoom/Meet) | Recall.ai (`src/recall.js`) | Escrito, **não testado** contra a API real |
| Início automático | Integração de calendário do Recall (auto-join) ou `POST /meetings` disparado por rotina que lê a agenda do Outlook | Fase 2 |
| Contexto CRM / e-mail / Teams | `src/context.js`: CRM e infra prontos; e-mail/Teams entram via `extra` (fase 2: busca no M365 por domínio do cliente) | CRM + infra: pronto |
| Ofertas aderentes | Catálogo `data/portfolio.json` (nível fabricante); modelo escolhe por `id` | **Catálogo v1: 11 fabricantes informados por Rodrigo; revisar temas e trocar links por páginas de produto** |
| Links para compartilhar | Só do catálogo; ids/URLs inventados são descartados (testado) | Pronto |
| Fala consultiva | `fala_sugerida` (1ª pessoa, risco/NIST/valor) no schema | Pronto |
| Perguntas ao cliente | `tipo: "pergunta"` + `perguntas_discovery` do catálogo | Pronto |
| Ignorar pessoal/irrelevante | `relevante=false` + regra no prompt (testado com mock) | Pronto; ajustar com reuniões reais |
| Integra consulta de infra | Ferramenta `analisar_infra_cliente` → `analyze_company` | Pronto |
| Objetivo e preciso | Schema curto, 0–2 sugestões/rodada, dedupe (`JA_SUGERIDO`) | Pronto |

## Decisões que dependem de você

1. **Captura**: bot visível (Recall.ai, serviço pago por hora de reunião; todos veem um participante) vs. app desktop capturando áudio do sistema (invisível, mas bem mais trabalho e um app por SO). Este código assume o bot.
2. **Consentimento/LGPD**: transcrever reunião exige avisar os participantes e alinhar com Jurídico/DPO; defina retenção (hoje nada é persistido).
3. **Modelo**: padrão `claude-opus-5-5`, esforço `low`. Se a latência incomodar, `COPILOT_MODEL=claude-sonnet-5-5`.
4. **Acesso ao CRM/M365 de fora do Claude.ai**: os conectores do Claude.ai não são reutilizáveis aqui; é preciso a URL e um token do MCP do CRM (`CRM_MCP_URL`, `CRM_MCP_TOKEN`) e, na fase 2, credenciais Microsoft Graph.

## Rodar

```bash
cd copilot && npm install
BRAIN_MOCK=1 npm start      # sem chave; valida o fluxo
npm run sim                 # em outro terminal, reproduz sim/reuniao-exemplo.jsonl
export ANTHROPIC_API_KEY=... # modo real
```

Variáveis: ver `src/config.js` (`CONSOLE_TOKEN`, `WEBHOOK_SECRET`, `RECALL_API_KEY`, `PUBLIC_URL`, `USER_NAMES`, ...).
**Segurança**: defina `CONSOLE_TOKEN` e `WEBHOOK_SECRET` antes de expor publicamente.

## Roadmap

1. Preencher catálogo real (dá para gerar a partir do `search_products` do CRM).
2. Teste real com Recall em reunião interna; validar formato do webhook e identificação do falante.
3. Auto-join via agenda + briefing automático (e-mails/Teams recentes do cliente).
4. Pós-reunião: ata, próximos passos e nota no CRM (`create_customer_note`, com confirmação).
5. Avaliação com reuniões gravadas: taxa de sugestões úteis vs. ruído, ajuste dos gatilhos.
