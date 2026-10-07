// Configuração central. Tudo sobrescrevível por variável de ambiente.
const env = process.env;

export const config = {
  port: Number(env.PORT || 3100),
  // Modelo do consultor. Padrão: o mais capaz; troque por claude-sonnet-5-5 se latência/custo pesarem.
  model: env.COPILOT_MODEL || "claude-opus-5-5",
  effort: env.COPILOT_EFFORT || "low", // latência em reunião ao vivo
  // Quem é o vendedor (para separar fala do cliente da sua). Nomes separados por vírgula.
  userNames: (env.USER_NAMES || "Rodrigo").split(",").map((s) => s.trim().toLowerCase()),
  // Proteção do console.
  consoleToken: env.CONSOLE_TOKEN || "",
  // Gatilhos de análise.
  minNewWords: Number(env.MIN_NEW_WORDS || 35),
  debounceMs: Number(env.DEBOUNCE_MS || 4000),
  cooldownMs: Number(env.COOLDOWN_MS || 20000),
  // MCPs consultados pelo agente (Streamable HTTP).
  infraMcpUrl:
    env.INFRA_MCP_URL || "https://company-tech-profiler-remote-production.up.railway.app/mcp",
  crmMcpUrl: env.CRM_MCP_URL || "",
  crmMcpToken: env.CRM_MCP_TOKEN || "",
  // Token que o app companheiro (no seu PC) usa para enviar transcrição.
  ingestToken: env.INGEST_TOKEN || "",
  // Fontes extras de contexto (WhatsApp, e-mail, Teams, agenda...): arquivo JSON, ver docs.
  contextSourcesFile: env.CONTEXT_SOURCES_FILE || "",
  domainsInternal: (env.INTERNAL_DOMAINS || "gantech.com.br").split(",").map((s) => s.trim().toLowerCase()),
  mock: env.BRAIN_MOCK === "1",
};
