# Copiloto de reuniões Gantech — arquitetura v2 (sem serviços de captura de terceiros)

## Princípio
Nenhum bot entra na reunião e nenhum áudio vai para terceiros. Um app companheiro no PC do Rodrigo
captura e transcreve localmente; só **texto** sobe para o agente. O agente raciocina com o portfólio
Gantech + contexto do cliente (CRM, e-mail, Teams, WhatsApp) e devolve a fala consultiva.

```
PC do Rodrigo (Windows)                               Servidor do agente (Node)
┌──────────────────────────────┐                      ┌───────────────────────────────────────┐
│ companion/companion.py       │   POST /meetings     │ briefing.js                           │
│  • detecta Teams/Zoom/Meet   │ ───────────────────► │  fontes MCP (CRM, e-mail, Teams,      │
│  • mic  → "Rodrigo"          │                      │  WhatsApp, agenda) + infra pública    │
│  • áudio do sistema→"Cliente"│   POST /ingest/:id   │  → Claude resume em briefing          │
│  • VAD + Whisper LOCAL       │ ───────────────────► │ session.js: gatilhos (palavras/       │
│  • abre o console            │   (só texto)         │  pergunta/debounce/cooldown)          │
└──────────────────────────────┘                      │ brain.js: Claude + catálogo + tools   │
                                                      │  (analisar_infra_cliente, buscar_crm) │
Console privado /console/:id  ◄──── SSE ───────────── │ links só do catálogo (anti-alucinação)│
(2º monitor ou celular)                               └───────────────────────────────────────┘
```

## Decisões de arquitetura
| Tema | Decisão | Por quê |
|---|---|---|
| Captura | App local, áudio do mic + loopback do sistema | Independe do app de reunião; sem bot visível; sem custo por hora |
| Quem fala | Mic = Rodrigo, sistema = Cliente | Separa vendedor/cliente sem diarização (exige fone de ouvido) |
| Transcrição | faster-whisper local (modelo `small`/`medium`) | Áudio nunca sai do PC; custo zero; trade-off: latência/qualidade dependem da CPU/GPU |
| Início automático | Companheiro detecta a reunião (janela/processo) e chama `POST /meetings` | Roda sozinho ao abrir a reunião |
| Contexto | Fontes MCP configuráveis (`CONTEXT_SOURCES_FILE`) → resumo pelo Claude | WhatsApp/e-mail/Teams são ruidosos e pessoais; o resumo filtra e estrutura |
| Cérebro | Claude com catálogo (11 fabricantes) + ferramentas de infra/CRM | Portfólio no prompt (cache); ferramentas só quando mudam a recomendação |
| Links | Só do catálogo | Nunca inventa URL |

## Requisitos dependentes de você (bloqueantes para contexto real)
1. **Acesso programático às fontes.** Os conectores do Claude.ai (CRM, Microsoft 365, WhatsApp) são
   da sua conta no Claude e **não são acessíveis a um servidor próprio**. Opções por fonte:
   - Se você já expõe esses MCPs com URL e token (ex.: o do CRM, o do WhatsApp), basta preencher `docs/context-sources.exemplo.json`.
   - Microsoft 365 (e-mail, Teams, transcrições, agenda): registrar um app no Entra ID com permissões
     Graph de leitura delegadas (Mail.Read, Chat.Read, OnlineMeetingTranscript.Read.All, Calendars.Read) e expô-lo como MCP/endpoint.
     Transcrições do Teams só existem se a transcrição estiver habilitada nas reuniões (política do tenant).
   - WhatsApp: depende de como o seu MCP atual obtém as mensagens (hoje não sei; informe a URL/forma de acesso).
2. **LGPD/consentimento:** transcrever fala de terceiros e usar WhatsApp/e-mail como contexto exige base legal,
   aviso aos participantes e política de retenção. Hoje **nada é gravado em disco** (transcrição fica em memória da sessão).
3. **Sistema operacional:** o companheiro assume **Windows** (WASAPI loopback). Mac exigiria outra rota de captura.

## Estado atual
| Peça | Estado |
|---|---|
| Servidor, sessões, gatilhos, cérebro, console, catálogo, links | Pronto; testado em modo simulado (`BRAIN_MOCK=1`) |
| Briefing com fontes MCP + resumo | Escrito; **não testado** com fontes reais |
| Companheiro (detecção, captura, Whisper) | Escrito; **não testado** (sem áudio/Windows no ambiente de desenvolvimento) |
| Claude real (prompts, qualidade das sugestões) | **Não testado** (sem chave no ambiente) |

## Rodar
Servidor: `cd copilot && npm install && npm start` (`BRAIN_MOCK=1` para testar sem chave; `npm run sim` reproduz uma reunião).
Companheiro (Windows): `pip install -r companion/requirements.txt` e `python companion/companion.py`,
com `COPILOT_URL`, `INGEST_TOKEN`, `CONSOLE_TOKEN` e `USER_LABEL` (seu nome, como quer aparecer).
Defina `INGEST_TOKEN` e `CONSOLE_TOKEN` antes de expor o servidor fora da sua máquina.

## Roadmap
1. Teste local ponta a ponta: companheiro + servidor na mesma máquina, reunião interna, sem fontes de contexto.
2. Ligar CRM e depois M365/WhatsApp no `context-sources.json`; avaliar a qualidade do briefing.
3. Identificar o cliente pela agenda (Outlook) em vez do título da janela.
4. Pós-reunião: ata, próximos passos, nota no CRM (com sua confirmação).
5. Avaliar com reuniões gravadas: sugestões úteis x ruído; ajustar gatilhos e prompts.
