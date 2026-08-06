#!/usr/bin/env node
// Remote (HTTP) build of the company-tech-profiler MCP server, for deploys
// where clients can't spawn a local stdio process (e.g. Cowork/claude.ai).
// Same tools as the local stdio server — only the transport differs.

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  getDnsRecords,
  detectEmailProvider,
  getRdap,
  getSslCertificate,
  fingerprintWebsite,
  getIpInfo,
  findSubdomains,
} from "./collectors.js";

const PORT = process.env.PORT || 3000;
const domainSchema = { domain: z.string().describe("A bare domain name, e.g. 'example.com' (no protocol, no path).") };

function normalizeDomain(input) {
  return input.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

function asToolResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function buildServer() {
  const server = new McpServer({ name: "company-tech-profiler", version: "1.0.0" });

  server.registerTool(
    "get_dns_records",
    {
      description:
        "Resolve A, AAAA, MX, NS, TXT and CNAME records for a domain, plus the inferred email provider (Google Workspace, Microsoft 365, etc.) derived from MX records.",
      inputSchema: domainSchema,
    },
    async ({ domain }) => {
      const d = normalizeDomain(domain);
      const records = await getDnsRecords(d);
      return asToolResult({ domain: d, records, inferred_email_provider: detectEmailProvider(records.MX) });
    }
  );

  server.registerTool(
    "get_domain_registration",
    {
      description: "RDAP lookup (modern WHOIS replacement) for registrar, registration/expiration dates, status and nameservers of a domain.",
      inputSchema: domainSchema,
    },
    async ({ domain }) => asToolResult(await getRdap(normalizeDomain(domain)))
  );

  server.registerTool(
    "get_ssl_certificate",
    {
      description: "Connect to the domain on port 443 and report its TLS certificate: issuer, subject, validity window, and subject alternative names.",
      inputSchema: domainSchema,
    },
    async ({ domain }) => asToolResult(await getSslCertificate(normalizeDomain(domain)))
  );

  server.registerTool(
    "fingerprint_website",
    {
      description:
        "Fetch the site's homepage and match HTTP headers + HTML against a curated signature database to detect CDN, hosting/PaaS, CMS, analytics, payments and frontend framework technologies in use.",
      inputSchema: domainSchema,
    },
    async ({ domain }) => asToolResult(await fingerprintWebsite(normalizeDomain(domain)))
  );

  server.registerTool(
    "get_ip_and_cloud_provider",
    {
      description:
        "Resolve the domain's IP and look up its ISP/organization/ASN to infer the underlying cloud or hosting provider (AWS, GCP, Azure, DigitalOcean, etc.), plus rough geolocation.",
      inputSchema: domainSchema,
    },
    async ({ domain }) => {
      const d = normalizeDomain(domain);
      const records = await getDnsRecords(d);
      const ip = records.A?.[0];
      return asToolResult(ip ? await getIpInfo(ip) : { error: "Could not resolve an A record for this domain." });
    }
  );

  server.registerTool(
    "find_subdomains",
    {
      description:
        "Enumerate subdomains observed in public Certificate Transparency logs (crt.sh) for a domain — a free proxy for infrastructure breadth (similar in spirit to a 'domains.count' field).",
      inputSchema: { ...domainSchema, limit: z.number().optional().describe("Max number of subdomains to return (default 50).") },
    },
    async ({ domain, limit }) => asToolResult(await findSubdomains(normalizeDomain(domain), limit || 50))
  );

  server.registerTool(
    "analyze_company",
    {
      description:
        "Run the full pipeline for a domain and return a combined company tech/infra profile: DNS, RDAP registration info, SSL certificate, website fingerprint, cloud provider inference and subdomain count. This is the equivalent of a 'get company report' call.",
      inputSchema: domainSchema,
    },
    async ({ domain }) => {
      const d = normalizeDomain(domain);
      const [dnsRecords, rdap, ssl, fingerprint, subdomains] = await Promise.all([
        getDnsRecords(d),
        getRdap(d).catch((e) => ({ error: e.message })),
        getSslCertificate(d),
        fingerprintWebsite(d),
        findSubdomains(d, 20).catch((e) => ({ error: e.message })),
      ]);
      const ip = dnsRecords.A?.[0];
      const ipInfo = ip ? await getIpInfo(ip).catch((e) => ({ error: e.message })) : null;
      return asToolResult({
        domain: d,
        dns: dnsRecords,
        inferred_email_provider: detectEmailProvider(dnsRecords.MX),
        registration: rdap,
        ssl_certificate: ssl,
        website_fingerprint: fingerprint,
        hosting: ipInfo,
        subdomains,
      });
    }
  );

  return server;
}

const app = express();
app.use(express.json());

// Stateless mode: a fresh McpServer + transport per request. Simple and
// horizontally scalable — fine since every tool here is a pure read with no
// server-side session state to preserve between calls.
app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. This server only supports stateless POST requests." }, id: null });
});

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "company-tech-profiler-remote", mcpEndpoint: "/mcp" });
});

app.listen(PORT, () => {
  console.log(`company-tech-profiler-remote listening on port ${PORT}`);
});
