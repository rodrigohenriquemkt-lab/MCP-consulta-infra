import { test } from "node:test";
import assert from "node:assert/strict";
process.env.BRAIN_MOCK = "1";
process.env.MIN_NEW_WORDS = "5";
process.env.DEBOUNCE_MS = "10";
process.env.COOLDOWN_MS = "10";
const { MeetingSession } = await import("../src/session.js");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("ignora papo pessoal e não sugere nada", async () => {
  const events = [];
  const s = new MeetingSession({ id: "t", briefing: "", publish: (e) => events.push(e) });
  s.addUtterance("Cliente", "Como foi o fim de semana, assistiu o jogo de ontem com a família?");
  await wait(100);
  assert.equal(events.filter((e) => e.type === "suggestions").length, 0);
});

test("sugere oferta e descarta produto inexistente (sem link inventado)", async () => {
  const events = [];
  const s = new MeetingSession({ id: "t", briefing: "", publish: (e) => events.push(e) });
  s.addUtterance("Cliente", "Tivemos um incidente de ransomware em duas filiais mês passado.");
  await wait(100);
  const sug = events.find((e) => e.type === "suggestions");
  assert.ok(sug);
  assert.deepEqual(sug.sugestoes[0].produtos.map((p) => p.id), ["palo-alto"]);
});

test("expansão de placeholders e domínio do cliente", async () => {
  const { expand, domainFromParticipants } = await import("../src/context.js");
  assert.deepEqual(expand({ query: "{dominio}", n: 1 }, { dominio: "acme.com" }), { query: "acme.com", n: 1 });
  assert.equal(domainFromParticipants(["rodrigo@gantech.com.br", "ana@acme.com.br"]), "acme.com.br");
});
