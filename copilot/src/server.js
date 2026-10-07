import express from "express";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { MeetingSession } from "./session.js";
import { buildBriefing } from "./briefing.js";
import { consoleHtml } from "./console.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const sessions = new Map(); // id -> { session, clients:Set<res> }

function guard(req, res, next) {
  if (!config.consoleToken || req.query.token === config.consoleToken) return next();
  res.status(401).send("não autorizado");
}

async function createSession({ titulo, participantes, clienteNome, dominio, extra }) {
  const id = randomUUID();
  const clients = new Set();
  const publish = (ev) => clients.forEach((c) => c.write(`data: ${JSON.stringify(ev)}\n\n`));
  const briefing = await buildBriefing({ titulo, participantes, clienteNome, dominio, extra });
  const session = new MeetingSession({ id, briefing, publish });
  sessions.set(id, { session, clients });
  return { sessionId: id, briefingChars: briefing.length };
}

function ingestGuard(req, res, next) {
  if (!config.ingestToken || req.get("x-ingest-token") === config.ingestToken) return next();
  res.status(401).send("não autorizado");
}

// Início de reunião (chamado pelo app companheiro ao detectar a reunião, ou manualmente).
// `titulo`/`participantes` ajudam a identificar o cliente; o resto vem das fontes de contexto.
app.post("/meetings", ingestGuard, async (req, res) => {
  try {
    const { sessionId, briefingChars } = await createSession(req.body || {});
    res.json({ sessionId, console: `/console/${sessionId}`, briefingChars });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
  s.clients.add(res);
  req.on("close", () => s.clients.delete(res));
});

app.get("/console/:id", guard, (req, res) => res.type("html").send(consoleHtml(req.params.id, req.query.token || "")));
app.get("/healthz", (_, res) => res.json({ ok: true, mock: config.mock }));

app.listen(config.port, () => console.log(`copilot em :${config.port} (modelo ${config.model}${config.mock ? ", MOCK" : ""})`));
