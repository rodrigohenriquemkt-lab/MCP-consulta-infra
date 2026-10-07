import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.PORTFOLIO_FILE || path.join(here, "../data/portfolio.json");

export const catalog = JSON.parse(readFileSync(file, "utf8")).produtos;
const byId = new Map(catalog.map((p) => [p.id, p]));

// Versão compacta para o prompt (o modelo escolhe por id; os links são anexados pelo servidor).
export function catalogForPrompt() {
  return catalog.map(({ id, nome, fabricante, categoria, temas, quando_indicar, perguntas_discovery }) => ({
    id, nome, fabricante, categoria, temas, quando_indicar, perguntas_discovery,
  }));
}

// Anti-alucinação: links só vêm do catálogo; ids desconhecidos são descartados.
export function resolveProducts(ids = []) {
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => ({ id: p.id, nome: p.nome, fabricante: p.fabricante, links: p.links || [] }));
}
