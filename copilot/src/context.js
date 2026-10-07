import { config } from "./config.js";
import { callMcpTool } from "./mcp.js";

const clip = (s, n) => (s.length > n ? s.slice(0, n) + "…[truncado]" : s);

// Briefing pré-reunião: roda UMA vez no início e fica em cache no prompt.
// Fontes: CRM (cliente + notas), infraestrutura pública (MCP de infra).
// E-mail/Teams: ver docs/ARQUITETURA.md (fase 2); aceitos aqui via `extra`.
export async function buildBriefing({ clienteNome, dominio, extra = "" }) {
  const partes = [];
  const jobs = [];

  if (config.crmMcpUrl && clienteNome) {
    const crm = { url: config.crmMcpUrl, token: config.crmMcpToken };
    jobs.push(
      callMcpTool(crm, "search", { query: clienteNome })
        .then((t) => partes.push(`## CRM: busca por "${clienteNome}"\n${clip(t, 4000)}`))
        .catch((e) => partes.push(`## CRM: indisponível (${e.message})`))
    );
  }
  if (dominio) {
    jobs.push(
      callMcpTool({ url: config.infraMcpUrl }, "analyze_company", { domain: dominio })
        .then((t) => partes.push(`## Infraestrutura pública de ${dominio}\n${clip(t, 6000)}`))
        .catch((e) => partes.push(`## Infra: indisponível (${e.message})`))
    );
  }
  await Promise.all(jobs);
  if (extra) partes.push(`## Contexto adicional\n${clip(extra, 4000)}`);
  return partes.join("\n\n") || "Sem contexto prévio disponível.";
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
