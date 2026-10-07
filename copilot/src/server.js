import express from "express";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { MeetingSession } from "./session.js";
import { buildBriefing } from "./context.js";
import { joinMeeting, parseRecallEvent } from "./recall.js";
import { consoleHtml } from "./console.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const sessions = new Map(); // id -> { session, clients:Set<res> }

function guard(req, res, next) {
  if (!config.consoleToken || req.query.token === config.consoleToken) return next();
  res.status(401).send("não autorizado");
}

async function createSession({ clienteNome, dominio, extra }) {
  const id = randomUUID();
  const clients = new Set();
  const publish = (ev) => clients.forEach((c) => c.write(`data: ${JSON.stringify(ev)}\n\n`));
  const briefing = await buildBriefing({ clienteNome, dominio, extra });
  const session = new MeetingSession({ id, briefing, publish });
  sessions.set(id, { session, clients });
  return { id, briefing };
}

// Início de reunião: cria sessão (briefing) e, se houver link, manda o bot entrar.
app.post("/meetings", guard, async (req, res) => {
  try {
    const { meetingUrl, clienteNome, dominio, extra } = req.body;
    const { id, briefing } = await createSession({ clienteNome, dominio, extra });
    const bot = meetingUrl ? await joinMeeting({ meetingUrl, sessionId: id }) : null;
    res.json({ sessionId: id, console: `/console/${id}`, briefingChars: briefing.length, bot: bot?.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook de transcrição em tempo real (Recall.ai).
app.post("/webhooks/recall", (req, res) => {
  if (config.webhookSecret && req.query.secret !== config.webhookSecret) return res.sendStatus(401);
  res.sendStatus(200); // responde rápido; processa em seguida
  const ev = parseRecallEvent(req.body);
  if (ev) sessions.get(ev.sessionId)?.session.addUtterance(ev.speaker, ev.text);
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
