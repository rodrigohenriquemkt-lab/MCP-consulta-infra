// Lógica pura da ponte (sem rede), para ser testável.
// Guarda UMA coleta, só em memória: cada envio substitui a anterior, nada vai para disco,
// e a coleta expira sozinha após `ttlMs` (reiniciar o serviço também apaga tudo).
import crypto from "node:crypto";

export const KINDS = ["email", "chat", "meeting", "task", "whatsapp"];
const MAX_ITEMS = 100;
const DEFAULT_TTL_MS = 24 * 3600e3;

const isPlainObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

// Aceita { email?, chat?, meeting?, task?, whatsapp?, failed? }. Um tipo só vale se vier como
// lista e não estiver em `failed`. Se nenhum tipo foi coletado, recusa: não sobrescreve a coleta boa.
export function validateInbox(input) {
  if (!isPlainObject(input)) throw new Error("corpo inválido: esperado um objeto");
  const failed = Array.isArray(input.failed) ? input.failed.filter((k) => KINDS.includes(k)) : [];
  const out = { failed };
  let ok = 0;
  for (const k of KINDS) {
    if (failed.includes(k) || input[k] === undefined) continue;
    if (!Array.isArray(input[k])) throw new Error(`${k}: deve ser uma lista`);
    if (input[k].length > MAX_ITEMS) throw new Error(`${k}: no máximo ${MAX_ITEMS} itens`);
    if (!input[k].every(isPlainObject)) throw new Error(`${k}: cada item deve ser um objeto`);
    out[k] = input[k];
    ok++;
  }
  if (!ok) throw new Error("nenhum tipo coletado com sucesso; coleta anterior mantida");
  return out;
}

const counts = (data) => Object.fromEntries(KINDS.filter((k) => Array.isArray(data[k])).map((k) => [k, data[k].length]));

export function createInbox({ ttlMs = DEFAULT_TTL_MS, now = Date.now } = {}) {
  let current = null;
  const fresh = () => {
    if (current && now() - current.receivedAt > ttlMs) current = null;
    return current;
  };
  return {
    put(input) {
      const data = validateInbox(input);
      current = { receivedAt: now(), data };
      return { receivedAt: new Date(current.receivedAt).toISOString(), counts: counts(data), failed: data.failed };
    },
    // Formato igual ao da coleta crua que o app já entende, mais `receivedAt`.
    get() {
      const c = fresh();
      return c ? { receivedAt: new Date(c.receivedAt).toISOString(), ...c.data } : null;
    },
    // Só metadados, nunca o conteúdo.
    status() {
      const c = fresh();
      return c ? { has_data: true, receivedAt: new Date(c.receivedAt).toISOString(), counts: counts(c.data), failed: c.data.failed } : { has_data: false };
    },
  };
}

const sha = (s) => crypto.createHash("sha256").update(String(s ?? "")).digest();
// Comparação em tempo constante (hash antes, para não vazar o tamanho do token).
export const tokenMatches = (expected, given) => crypto.timingSafeEqual(sha(expected), sha(given));
