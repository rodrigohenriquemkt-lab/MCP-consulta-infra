import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Chamada pontual a uma ferramenta de um MCP remoto (conexão curta, stateless).
export async function callMcpTool({ url, token }, name, args) {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
  const client = new Client({ name: "gantech-copilot", version: "0.1.0" });
  await client.connect(transport);
  try {
    const res = await client.callTool({ name, arguments: args });
    return (res.content || []).map((c) => c.text ?? "").join("\n");
  } finally {
    await client.close().catch(() => {});
  }
}
