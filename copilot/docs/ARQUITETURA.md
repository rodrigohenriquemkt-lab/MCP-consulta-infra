# Copiloto de reuniões Gantech — arquitetura v3

## Princípio
Nenhum bot entra na reunião. Um app companheiro no PC do Rodrigo detecta a reunião, **abre a janela
privada na hora** e entrega ao agente o texto da conversa (vindo do áudio capturado ou da transcrição
ao vivo). O agente raciocina com o portfólio Gantech + contexto do cliente (CRM, e-mail, Teams,
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
| Quem fala | Mic = Rodrigo, sistema = Cliente | Separa vendedor/cliente sem diarização (exige fone de ouvido) |
| Transcrição | **Pendente de decisão** (`companion/stt.py` define o contrato). Whisper removido | Ver opções no fim |
| Texto ao vivo | `POST /ingest/:id` aceita texto de qualquer origem | Permite usar legendas/transcrição do próprio app |
| Início | Companheiro detecta a reunião → sessão e console abrem na hora | Diálogo começa com a reunião; o contexto não bloqueia |
| Diálogo | Sugestões espontâneas + caixa de pergunta no console | Mão dupla |
| Contexto | Fontes MCP (`CONTEXT_SOURCES_FILE`) → resumo pelo Claude; briefing da sua rotina entra por `extra` | Filtra o ruído pessoal de WhatsApp/e-mail |
| Calendário | **Fora do escopo do agente** | Já existe rotina própria de briefing |
| Links | Só do catálogo | Nunca inventa URL |

## Requisitos dependentes de você (bloqueantes para contexto real)
1. **Acesso programático às fontes.** Os conectores do Claude.ai (CRM, Microsoft 365, WhatsApp) são
   da sua conta no Claude e **não são acessíveis a um servidor próprio**. Opções por fonte:
   - Se você já expõe esses MCPs com URL e token (ex.: o do CRM, o do WhatsApp), basta preencher `docs/context-sources.exemplo.json`.
   - Microsoft 365 (e-mail, Teams, transcrições): registrar um app no Entra ID com permissões
     Graph de leitura delegadas (Mail.Read, Chat.Read, OnlineMeetingTranscript.Read.All) e expô-lo como MCP/endpoint.
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
| Companheiro (detecção, janela privada, captura) | Escrito; **não testado** (sem áudio/Windows no ambiente de desenvolvimento) |
| Motor de transcrição | **Não existe** — aguardando escolha; sem ele o companheiro roda em modo texto |
| Claude real (prompts, qualidade das sugestões) | **Não testado** (sem chave no ambiente) |

## Rodar
Servidor: `cd copilot && npm install && npm start` (`BRAIN_MOCK=1` para testar sem chave; `npm run sim` reproduz uma reunião).
Companheiro (Windows): `pip install -r companion/requirements.txt` e `python companion/companion.py`,
com `COPILOT_URL`, `INGEST_TOKEN`, `CONSOLE_TOKEN`, `USER_LABEL` e (quando existir) `STT_ENGINE`.
Defina `INGEST_TOKEN` e `CONSOLE_TOKEN` antes de expor o servidor fora da sua máquina.

## Roadmap
1. Teste local ponta a ponta: companheiro + servidor na mesma máquina, reunião interna, sem fontes de contexto.
2. Ligar CRM e depois M365/WhatsApp no `context-sources.json`; avaliar a qualidade do briefing.
3. Pós-reunião: ata, próximos passos, nota no CRM (com sua confirmação).
4. Avaliar com reuniões gravadas: sugestões úteis x ruído; ajustar gatilhos e prompts.

## Motor de transcrição: opções (decisão pendente)
- **Azure AI Speech (streaming, pt-BR):** latência baixa, combina com ambiente Microsoft; o áudio vai para a nuvem da Microsoft.
- **Legendas/transcrição ao vivo do próprio app (Teams/Zoom/Meet):** nenhum áudio sai do PC e não há motor extra; depende de a transcrição estar ligada na reunião e de uma forma de ler o texto (cada app é diferente).
- **Outro STT em nuvem (Google, Deepgram etc.):** equivalente ao Azure, outro fornecedor.
