import express from "express";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { MeetingSession } from "./session.js";
import { buildBriefing } from "./briefing.js";
import { ask } from "./brain.js";
import { saveBriefing, findBriefing } from "./briefings.js";
import { consoleHtml } from "./console.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const sessions = new Map(); // id -> { session, clients:Set<res> }

function guard(req, res, next) {
  if (!config.consoleToken || req.query.token === config.consoleToken) return next();
  res.status(401).send("não autorizado");
}

// A sessão (e o console) nascem NA HORA; o briefing carrega em segundo plano e chega por evento.
function createSession({ titulo, participantes, clienteNome, dominio, extra }) {
  const id = randomUUID();
  const clients = new Set();
  const history = []; // reenviado a quem abre o console depois
  const publish = (ev) => {
    history.push(ev);
    if (history.length > 300) history.shift();
    clients.forEach((c) => c.write(`data: ${JSON.stringify(ev)}\n\n`));
  };
  const session = new MeetingSession({ id, briefing: "Contexto ainda carregando; use apenas a conversa até chegar.", publish });
  sessions.set(id, { session, clients, history });
  publish({ type: "status", text: `Reunião iniciada${titulo ? `: ${titulo}` : ""}. Estou ouvindo. Carregando o contexto do cliente...` });
  const pre = findBriefing({ titulo, clienteNome, dominio });
  if (pre) publish({ type: "status", text: `Briefing da sua rotina encontrado para "${pre.cliente || pre.dominio}".` });
  buildBriefing({ titulo, participantes, clienteNome, dominio, extra: [extra, pre?.texto].filter(Boolean).join("\n\n") })
    .then((b) => {
      session.briefing = b;
      publish({ type: "briefing", text: b });
    })
    .catch((e) => publish({ type: "error", message: `Contexto indisponível: ${e.message}` }));
  return { sessionId: id };
}

function ingestGuard(req, res, next) {
  if (!config.ingestToken || req.get("x-ingest-token") === config.ingestToken) return next();
  res.status(401).send("não autorizado");
}

// Início de reunião (chamado pelo app companheiro ao detectar a reunião, ou manualmente).
// `titulo`/`participantes` ajudam a identificar o cliente; o resto vem das fontes de contexto.
app.post("/meetings", ingestGuard, (req, res) => {
  try {
    const { sessionId } = createSession(req.body || {});
    res.json({ sessionId, console: `/console/${sessionId}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// A rotina de preparação de briefing do Rodrigo empurra o briefing aqui; casa com a reunião por cliente/domínio.
app.post("/briefings", ingestGuard, (req, res) => {
  try {
    const b = saveBriefing(req.body || {});
    res.status(201).json({ cliente: b.cliente, dominio: b.dominio });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Segmentos de transcrição vindos do app companheiro.
app.post("/ingest/:id", ingestGuard, (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.sendStatus(404);
  const { speaker, text } = req.body || {};
  s.session.addUtterance(speaker, text);
  res.sendStatus(202);
});

// Injeção manual de falas (simulação/testes).
app.post("/sessions/:id/utterances", guard, (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.sendStatus(404);
  s.session.addUtterance(req.body.speaker, req.body.text);
  res.sendStatus(202);
});

app.get("/sessions/:id/stream", guard, (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.sendStatus(404);
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  s.history.forEach((ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`));
  s.clients.add(res);
  req.on("close", () => s.clients.delete(res));
});

// Pergunta direta do Rodrigo ao consultor (caixa de texto do console).
app.post("/sessions/:id/ask", guard, async (req, res) => {
  const s = sessions.get(req.params.id);
  const pergunta = String(req.body?.pergunta || "").trim();
  if (!s || !pergunta) return res.sendStatus(400);
  s.session.publish({ type: "question", text: pergunta });
  try {
    const text = await ask({ briefing: s.session.briefing, transcript: s.session.recentTranscript(), pergunta });
    s.session.publish({ type: "answer", text });
    res.json({ ok: true });
  } catch (e) {
    s.session.publish({ type: "error", message: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get("/console/:id", guard, (req, res) => res.type("html").send(consoleHtml(req.params.id, req.query.token || "")));
app.get("/healthz", (_, res) => res.json({ ok: true, mock: config.mock }));

app.listen(config.port, () => console.log(`copilot em :${config.port} (modelo ${config.model}${config.mock ? ", MOCK" : ""})`));
