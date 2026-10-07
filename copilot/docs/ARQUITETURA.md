# Copiloto de reuniões Gantech — arquitetura v4 (legendas ao vivo)

## Princípio
Nenhum bot entra na reunião. Um app companheiro no PC do Rodrigo detecta a reunião, **abre a janela
privada na hora** e entrega ao agente o texto das **legendas ao vivo do próprio Teams/Zoom/Meet**
(sem áudio, sem motor de transcrição). O agente raciocina com o portfólio Gantech + contexto do cliente (CRM, e-mail, Teams,
WhatsApp, e o briefing da rotina que você já tem) e dialoga com você: sugere sem ser chamado e responde
quando você pergunta. **Não lê calendário**: isso é da sua rotina de briefing existente.

```
PC do Rodrigo (Windows)                          Servidor do agente (Node)
┌───────────────────────────────┐  POST /meetings  ┌──────────────────────────────────────────┐
│ companion/companion.py        │ ───────────────► │ sessão + console criados IMEDIATAMENTE    │
│  • detecta Teams/Zoom/Meet    │                  │ briefing carrega em segundo plano e       │
│  • abre a janela privada      │                  │ chega ao console como evento              │
│  • mic → "Rodrigo"            │  POST /ingest/id │ session.js: gatilhos (palavras/pergunta/  │
│  • áudio do sistema→"Cliente" │ ───────────────► │   debounce/cooldown)                      │
│  • STT (motor a definir)      │   (só texto)     │ brain.js: Claude + catálogo + ferramentas │
└───────────────────────────────┘                  │  (analisar_infra_cliente, buscar_crm)     │
Texto também pode chegar por outra via             │ links só do catálogo                      │
(transcrição ao vivo do app) em /ingest/:id        └──────────────────────────────────────────┘
Console privado /console/:id ◄──── SSE ─────────── sugestões, status, briefing, respostas
 (2º monitor/celular) ──── POST /sessions/:id/ask ► pergunta direta ao consultor
```

## Decisões de arquitetura
| Tema | Decisão | Por quê |
|---|---|---|
| Captura | App local, áudio do mic + loopback do sistema | Independe do app de reunião; sem bot visível |
| Texto da reunião | **Legendas ao vivo do próprio app** (`companion/captions.py`) | Sem áudio, sem motor de STT, sem custo; exige legendas LIGADAS na reunião |
| Quem fala | O nome do falante vem da legenda; `USER_NAMES` identifica o Rodrigo | Sem diarização própria |
| Leitor de legendas | Calibrado com `companion/probe.py` numa reunião real | Não adivinhamos elementos de interface; a lógica de estabilização já é testada |
| Início | Companheiro detecta a reunião → sessão e console abrem na hora | Diálogo começa com a reunião; o contexto não bloqueia |
| Diálogo | Sugestões espontâneas + caixa de pergunta no console | Mão dupla |
| Contexto | (1) briefing da sua rotina via `POST /briefings`; (2) fontes MCP próprias (`CONTEXT_SOURCES_FILE`): WhatsApp (Railway), CRM; tudo resumido pelo Claude | Reaproveita o que já funciona; filtra ruído pessoal |
| Calendário | **Fora do escopo do agente** | Já existe rotina própria de briefing |
| Links | Só do catálogo | Nunca inventa URL |

## Acesso às fontes de contexto
- **WhatsApp:** MCP já publicado no Railway (`whatsappgantechmcp-production.up.railway.app`); falta confirmar o caminho (`/mcp`) e se exige token.
- **E-mail e Teams (Microsoft 365):** as permissões que você concedeu pertencem ao conector do Claude.ai e **não podem ser
  reutilizadas por um servidor próprio**. Por isso o agente **não lê o M365 diretamente**: e-mail e transcrições de reuniões
  passadas entram pelo briefing que a sua rotina já prepara, enviado a `POST /briefings`. Entra ID só seria necessário se
  um dia o agente precisasse consultar e-mail/Teams por conta própria, durante a reunião.
- **CRM:** mesma lógica; se o MCP do CRM (Railway) tiver URL/token, preencher no arquivo de fontes.
- **LGPD/consentimento:** usar WhatsApp, e-mail e legendas de terceiros exige base legal, aviso aos participantes e política de
  retenção. Hoje **nada é gravado em disco**.
- **Sistema operacional:** Windows (confirmado).

## Estado atual
| Peça | Estado |
|---|---|
| Servidor, sessões, gatilhos, cérebro, console, catálogo, links | Pronto; testado em modo simulado (`BRAIN_MOCK=1`) |
| Briefing com fontes MCP + resumo | Escrito; **não testado** com fontes reais |
| Companheiro (detecção, janela privada) | Escrito; **não testado** (sem Windows no ambiente de desenvolvimento) |
| Estabilização das legendas (`CaptionStream`) | Pronto e testado (4 testes) |
| Leitor de legendas por app (Teams/Zoom/Meet) | **Não existe**: depende de calibração com `probe.py` |
| Briefing empurrado (`/briefings`) | Pronto; testado |
| Claude real (prompts, qualidade das sugestões) | **Não testado** (sem chave no ambiente) |

## Rodar
Servidor: `cd copilot && npm install && npm start` (`BRAIN_MOCK=1` para testar sem chave; `npm run sim` reproduz uma reunião).
Companheiro (Windows): `pip install -r companion/requirements.txt` e `python companion/companion.py`,
com `COPILOT_URL`, `INGEST_TOKEN`, `CONSOLE_TOKEN` e (após calibrar) `CAPTIONS_READER`.
Calibração: `python companion/probe.py "Microsoft Teams"` numa reunião com legendas ligadas.
Defina `INGEST_TOKEN` e `CONSOLE_TOKEN` antes de expor o servidor fora da sua máquina.

## Roadmap
1. Calibrar: rodar `probe.py` em reuniões internas (Teams, Zoom, Meet) e escrever os leitores com os elementos reais.
2. Teste ponta a ponta local; depois ligar WhatsApp e CRM no `context-sources.json` e a rotina de briefing em `/briefings`.
3. Pós-reunião: ata, próximos passos, nota no CRM (com sua confirmação).
4. Avaliar com reuniões gravadas: sugestões úteis x ruído; ajustar gatilhos e prompts.
