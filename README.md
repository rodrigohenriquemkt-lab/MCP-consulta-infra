# company-tech-profiler-remote

Versão HTTP (remota) do MCP `company-tech-profiler`. Mesmas 7 ferramentas do
servidor local — `get_dns_records`, `get_domain_registration`,
`get_ssl_certificate`, `fingerprint_website`, `get_ip_and_cloud_provider`,
`find_subdomains`, `analyze_company` — só que expostas via HTTP (protocolo
MCP Streamable HTTP) em vez de um processo local por stdio, para que
ambientes que não têm acesso à sua máquina (Cowork, claude.ai) também
consigam usá-la.

Todas as fontes de dados continuam públicas e gratuitas (DNS, RDAP, TLS,
fingerprint HTTP, crt.sh, ip-api.com) — sem nenhuma API key.

## Rodar localmente

```bash
npm install
npm start
# ouve em http://localhost:3000, endpoint MCP em /mcp
```

## Deploy no Railway

1. Suba este diretório para um repositório Git (GitHub/GitLab).
2. Em https://railway.com, crie uma conta (ou entre na existente).
3. **New Project** → **Deploy from GitHub repo**, aponte para este
   repositório — o `railway.json` já descreve o build (Nixpacks,
   `npm install`) e o start command (`npm start`).
4. Em **Settings → Networking**, gere um domínio público (**Generate
   Domain**). A porta é detectada automaticamente via `process.env.PORT`,
   que o servidor já usa (`src/index.js`).
5. Aguarde o deploy. A URL final fica algo como
   `https://company-tech-profiler-remote-production.up.railway.app`.
6. O endpoint MCP é essa URL + `/mcp`
   (ex: `https://company-tech-profiler-remote-production.up.railway.app/mcp`).

**Nota:** diferente do free tier do Render, o Railway não coloca o serviço
para dormir por padrão — as respostas ficam consistentes sem o atraso de
"acordar" após inatividade. O plano gratuito do Railway é por créditos
mensais (uso), não por tempo ocioso.

## Conectar no Cowork / claude.ai

Use a URL do passo 5 acima (terminando em `/mcp`) na tela de conectores/MCP
remotos do Cowork/claude.ai, como um servidor MCP do tipo "Streamable HTTP".
