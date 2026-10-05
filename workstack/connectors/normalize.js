'use strict';
// Converte itens crus (formato Microsoft Graph / MCP Microsoft 365) em payloads do /ingest
// e aplica o critério de entrada na pilha. Retorna null quando o item não deve virar nota.
//
// Critério:
//  - email:   não lido ou sinalizado, e que não seja da própria pessoa
//  - chat:    menção ao usuário ou mensagem direta não respondida
//  - meeting: começa nas próximas `horizonHours` (padrão 24h) e não foi recusada
//  - task:    não concluída
// Prioridade: vermelho se vencida/urgente (vence em <24h, importância alta ou reunião em <2h),
// laranja se vence em <72h, senão amarelo.

const H = 3600e3;

function priorityFor({ due, important, now }) {
  if (important) return 'red';
  if (due != null) {
    if (due - now < 24 * H) return 'red';
    if (due - now < 72 * H) return 'orange';
  }
  return 'yellow';
}

function email(m, { now = Date.now(), me } = {}) {
  const flagged = m.flag?.flagStatus === 'flagged';
  if (m.isRead && !flagged) return null;
  if (me && m.from?.emailAddress?.address?.toLowerCase() === me.toLowerCase()) return null;
  return {
    kind: 'email', source: 'outlook', externalId: m.id,
    title: m.subject || '(sem assunto)',
    detail: [m.from?.emailAddress?.name, m.bodyPreview].filter(Boolean).join(' — '),
    url: m.webLink, startedAt: m.receivedDateTime,
    priority: priorityFor({ important: m.importance === 'high' || flagged, now }),
  };
}

function chat(m, { now = Date.now() } = {}) {
  if (!m.mentionsMe && !(m.isDirect && !m.answered)) return null;
  return {
    kind: 'chat', source: 'teams', externalId: m.id,
    title: m.topic || `Mensagem de ${m.from || 'alguém'}`,
    detail: m.text || '', url: m.webUrl, startedAt: m.createdDateTime,
    priority: priorityFor({ important: m.mentionsMe && m.importance === 'high', now }),
  };
}

function meeting(e, { now = Date.now(), horizonHours = 24 } = {}) {
  const start = new Date(e.start?.dateTime || e.start).getTime();
  if (!Number.isFinite(start)) return null;
  if (e.responseStatus === 'declined' || e.isCancelled) return null;
  if (start < now - H || start - now > horizonHours * H) return null; // já passou há >1h ou longe demais
  const soon = start - now < 2 * H;
  return {
    kind: 'meeting', source: 'calendar', externalId: e.id,
    title: e.subject || '(reunião)',
    detail: [e.location?.displayName || e.location, e.onlineMeetingUrl].filter(Boolean).join(' · '),
    url: e.onlineMeetingUrl || e.webLink, startedAt: start, due: start,
    priority: soon ? 'red' : priorityFor({ due: start, now }),
  };
}

function task(t, { now = Date.now() } = {}) {
  if (t.status === 'completed' || t.completed) return null;
  const due = t.dueDateTime?.dateTime || t.due;
  const dueMs = due ? new Date(due).getTime() : null;
  return {
    kind: 'task', source: t.list || 'tarefas', externalId: t.id,
    title: t.title, detail: t.body?.content || t.notes || '',
    url: t.webLink, startedAt: t.createdDateTime || now, due: dueMs,
    priority: priorityFor({ due: dueMs, important: t.importance === 'high', now }),
  };
}

// WhatsApp: pergunta recebida e ainda sem resposta sua. `m.messages` em ordem cronológica;
// só conta o que veio depois da sua última mensagem (fromMe).
const QUESTION_START = /^(voc[êe]|vc|pode|poderia|consegue|conseguiria|quando|qual|quais|como|onde|quanto|quantos|tem como|ser[áa]|d[áa] para|me (envia|manda|passa))\b/i;
const looksLikeQuestion = (t) => {
  const s = String(t || '').trim();
  const noVocative = s.replace(/^[^,?!.]{1,30},\s*/, ''); // "Rodrigo, qual o prazo" -> "qual o prazo"
  return /\?/.test(s) || QUESTION_START.test(s) || QUESTION_START.test(noVocative);
};

function whatsapp(m, { now = Date.now() } = {}) {
  if (/@(broadcast|newsletter)$/i.test(String(m.id || ''))) return null; // Status e canais não são conversas
  const msgs = m.messages || [];
  let lastMine = -1;
  msgs.forEach((x, i) => { if (x.fromMe) lastMine = i; });
  const pending = msgs.slice(lastMine + 1).filter((x) => x.text && looksLikeQuestion(x.text));
  if (!pending.length) return null;
  if (m.isGroup && !m.mentionsMe) return null; // em grupos, só se mencionarem você
  const q = pending[pending.length - 1];
  const ts = new Date(q.timestamp).getTime();
  const age = now - ts;
  return {
    kind: 'whatsapp', source: 'whatsapp', externalId: m.id,
    title: `${m.chatName || 'Contato'}: ${String(q.text).slice(0, 80)}`,
    detail: String(q.text).slice(0, 200), startedAt: ts,
    priority: age > 24 * H ? 'red' : age > 4 * H ? 'orange' : 'yellow',
  };
}

const NORMALIZERS = { email, chat, meeting, task, whatsapp };
const normalizeAll = (kind, list, opts) =>
  (list || []).map((x) => NORMALIZERS[kind](x, opts)).filter(Boolean);

module.exports = { ...NORMALIZERS, normalizeAll, NORMALIZERS };
