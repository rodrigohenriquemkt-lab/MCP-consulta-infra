#!/usr/bin/env node
// Ponte Workstack: a tarefa agendada na nuvem envia a coleta por uma ferramenta MCP (conector
// personalizado) e o app no desktop busca por HTTPS. Sem banco, sem disco, sem logs de conteúdo.
//
//   POST /<token>/mcp   MCP (Streamable HTTP, sem estado): ferramentas workstack_push_inbox / workstack_inbox_status
//   GET  /inbox         coleta atual; autenticação: Authorization: Bearer <token>
//   GET  /health        verificação de saúde (sem dados)
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createInbox, tokenMatches } from "./relay.js";

const TOKEN = process.env.RELAY_TOKEN || "";
if (TOKEN.length < 32) {
  console.error("RELAY_TOKEN ausente ou curto demais (mínimo 32 caracteres). Encerrando.");
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const inbox = createInbox();

const asResult = (data) => ({ content: [{ type: "text", text: JSON.stringify(data) }] });
const itemList = z.array(z.record(z.any())).optional();

function buildServer() {
  const server = new McpServer({ name: "workstack-relay", version: "0.1.0" });

  server.registerTool(
    "workstack_push_inbox",
    {
      description:
        "Envia ao Workstack a coleta mais recente (substitui a anterior). Passe uma lista para cada tipo coletado com sucesso (use [] se não houve itens) e coloque em `failed` o nome dos tipos cuja coleta falhou, SEM a lista deles. Se nenhum tipo foi coletado, não chame esta ferramenta.",
      inputSchema: {
        email: itemList,
        chat: itemList,
        meeting: itemList,
        task: itemList,
        whatsapp: itemList,
        failed: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        return asResult({ ok: true, ...inbox.put(args) });
      } catch (e) {
        return { isError: true, ...asResult({ ok: false, error: e.message }) };
      }
    }
  );

  server.registerTool(
    "workstack_inbox_status",
    { description: "Mostra quando foi a última coleta recebida e quantos itens por tipo (sem o conteúdo).", inputSchema: {} },
    async () => asResult(inbox.status())
  );

  return server;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Token errado ou ausente responde 404 (não revela que o caminho existe).
const auth = (req, res, next) => {
  const bearer = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tokenMatches(TOKEN, req.params.token ?? bearer)) return res.status(404).end();
  next();
};

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get(["/inbox", "/:token/inbox"], auth, (_req, res) => {
  const data = inbox.get();
  res.set("Cache-Control", "no-store");
  return data ? res.json(data) : res.status(204).end();
});

// Sem estado: um McpServer + transporte novos por requisição.
app.post("/:token/mcp", auth, async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Erro interno" }, id: null });
  }
});
app.get("/:token/mcp", auth, (_req, res) =>
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Use POST." }, id: null })
);

// Erros de corpo (JSON inválido, grande demais) sem eco do conteúdo.
app.use((err, _req, res, _next) => res.status(err.status === 413 ? 413 : 400).json({ error: "requisição inválida" }));

app.listen(PORT, () => console.log(`workstack-relay ouvindo na porta ${PORT}`));
