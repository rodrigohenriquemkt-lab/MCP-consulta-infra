import { readFileSync } from "node:fs";
import { config } from "./config.js";
import { callMcpTool } from "./mcp.js";

export const clip = (s, n) => (s.length > n ? s.slice(0, n) + "…[truncado]" : s);

// Fontes de contexto configuráveis (arquivo JSON em CONTEXT_SOURCES_FILE). Cada fonte é um
// servidor MCP (WhatsApp, e-mail/Teams/agenda do Microsoft 365, CRM...) com as chamadas
// de leitura a fazer. Placeholders: {cliente}, {dominio}, {titulo}.
// Exemplo em docs/context-sources.exemplo.json. Somente leitura.
export function loadSources() {
  if (!config.contextSourcesFile) return [];
  return JSON.parse(readFileSync(config.contextSourcesFile, "utf8"));
}

export const expand = (v, vars) =>
  typeof v === "string"
    ? v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "")
    : Array.isArray(v) ? v.map((x) => expand(x, vars))
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expand(x, vars)]))
    : v;

// Deduz o domínio do cliente pelos e-mails dos participantes (ignora domínios internos).
export function domainFromParticipants(participantes = []) {
  for (const p of participantes) {
    const d = String(p).split("@")[1]?.toLowerCase();
    if (d && !config.domainsInternal.includes(d)) return d;
  }
  return "";
}

// Coleta bruta, em paralelo; uma fonte fora do ar não derruba as demais.
export async function gatherRaw({ clienteNome, dominio, titulo }) {
  const vars = { cliente: clienteNome || "", dominio: dominio || "", titulo: titulo || "" };
  const jobs = [];
  for (const src of loadSources()) {
    for (const c of src.chamadas || []) {
      jobs.push(
        callMcpTool({ url: src.url, token: src.token }, c.tool, expand(c.args || {}, vars))
          .then((t) => `## ${src.nome} / ${c.tool}\n${clip(t, src.maxChars || 6000)}`)
          .catch((e) => `## ${src.nome} / ${c.tool}: indisponível (${e.message})`)
      );
    }
  }
  if (dominio)
    jobs.push(
      callMcpTool({ url: config.infraMcpUrl }, "analyze_company", { domain: dominio })
        .then((t) => `## Infraestrutura pública de ${dominio}\n${clip(t, 6000)}`)
        .catch((e) => `## Infra: indisponível (${e.message})`)
    );
  return (await Promise.all(jobs)).join("\n\n");
}

// Ferramentas que o agente pode acionar DURANTE a reunião (sob demanda).
export const liveTools = [
  {
    name: "analisar_infra_cliente",
    description:
      "Consulta a infraestrutura pública (DNS, nuvem, WAF/CDN, TLS, portas expostas/CVEs, subdomínios) de um domínio. Use quando a conversa citar o ambiente do cliente e isso ajudar a embasar a recomendação.",
    input_schema: {
      type: "object",
      properties: { domain: { type: "string", description: "Domínio puro, ex.: cliente.com.br" } },
      required: ["domain"],
      additionalProperties: false,
    },
  },
  ...(config.crmMcpUrl
    ? [
        {
          name: "buscar_crm",
          description:
            "Busca no CRM da Gantech (clientes, oportunidades, notas) por termo. Somente leitura.",
          input_schema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
          },
        },
      ]
    : []),
];

export async function runLiveTool(name, input) {
  if (name === "analisar_infra_cliente")
    return clip(await callMcpTool({ url: config.infraMcpUrl }, "analyze_company", { domain: input.domain }), 8000);
  if (name === "buscar_crm")
    return clip(await callMcpTool({ url: config.crmMcpUrl, token: config.crmMcpToken }, "search", { query: input.query }), 6000);
  throw new Error(`Ferramenta desconhecida: ${name}`);
}
