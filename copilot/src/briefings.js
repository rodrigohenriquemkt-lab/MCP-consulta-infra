// Briefings empurrados pela rotina de preparação do Rodrigo (POST /briefings) e casados com a
// reunião pelo título da janela ou pelo domínio. Em memória: reinício do servidor apaga.
const TTL_MS = 48 * 3600 * 1000;
const store = [];

export const norm = (s = "") =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function saveBriefing({ cliente = "", dominio = "", texto = "" }) {
  if (!texto.trim() || (!cliente && !dominio)) throw new Error("informe texto e cliente ou dominio");
  const i = store.findIndex((b) => norm(b.cliente) === norm(cliente) && b.dominio === dominio);
  const item = { cliente, dominio: dominio.toLowerCase(), texto, ts: Date.now() };
  if (i >= 0) store[i] = item; else store.push(item);
  return item;
}

export function findBriefing({ titulo = "", clienteNome = "", dominio = "" }) {
  const t = ` ${norm(titulo)} ${norm(clienteNome)} `;
  const fresh = store.filter((b) => Date.now() - b.ts < TTL_MS);
  return (
    fresh.find((b) => dominio && b.dominio === dominio.toLowerCase()) ||
    fresh.find((b) => norm(b.cliente).length >= 3 && t.includes(` ${norm(b.cliente)} `)) ||
    null
  );
}
