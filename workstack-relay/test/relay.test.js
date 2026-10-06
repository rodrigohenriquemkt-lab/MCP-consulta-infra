import test from "node:test";
import assert from "node:assert";
import { createInbox, validateInbox, tokenMatches } from "../src/relay.js";

test("coleta válida é guardada; tipo em failed ou ausente não entra", () => {
  const i = createInbox();
  const r = i.put({ email: [{ id: "1" }], chat: [], task: [{ id: "x" }], failed: ["task"] });
  assert.deepStrictEqual(r.counts, { email: 1, chat: 0 });
  const got = i.get();
  assert.deepStrictEqual(got.failed, ["task"]);
  assert.strictEqual(got.task, undefined);
  assert.ok(got.receivedAt);
});

test("nenhum tipo coletado: recusa e mantém a coleta anterior", () => {
  const i = createInbox();
  i.put({ email: [{ id: "1" }] });
  assert.throws(() => i.put({ failed: ["email", "chat"] }), /nenhum tipo/);
  assert.strictEqual(i.get().email.length, 1);
});

test("validação: lista, objetos e limite de itens", () => {
  assert.throws(() => validateInbox({ email: "x" }), /lista/);
  assert.throws(() => validateInbox({ email: ["texto"] }), /objeto/);
  assert.throws(() => validateInbox({ email: Array.from({ length: 101 }, () => ({})) }), /máximo/);
  assert.throws(() => validateInbox(null), /inválido/);
});

test("cada envio substitui o anterior e a coleta expira após o TTL", () => {
  let t = 1000;
  const i = createInbox({ ttlMs: 500, now: () => t });
  i.put({ email: [{ id: "a" }] });
  i.put({ chat: [{ id: "b" }] });
  assert.strictEqual(i.get().email, undefined);
  t += 501;
  assert.strictEqual(i.get(), null);
  assert.deepStrictEqual(i.status(), { has_data: false });
});

test("status nunca expõe o conteúdo", () => {
  const i = createInbox();
  i.put({ email: [{ id: "1", subject: "segredo" }] });
  assert.ok(!JSON.stringify(i.status()).includes("segredo"));
});

test("token: igual passa, diferente ou vazio não", () => {
  assert.ok(tokenMatches("abc", "abc"));
  assert.ok(!tokenMatches("abc", "abd"));
  assert.ok(!tokenMatches("abc", undefined));
});
