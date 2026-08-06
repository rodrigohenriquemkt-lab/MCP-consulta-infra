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

## Deploy no Render (free tier)

1. Suba este diretório para um repositório Git (GitHub/GitLab).
2. Em https://render.com, crie uma conta gratuita (ou entre na existente).
3. **New +** → **Blueprint**, aponte para o repositório — o `render.yaml`
   já descreve o serviço (`company-tech-profiler-remote`, plano free).
   Alternativamente, **New +** → **Web Service** manual, com:
   - Build command: `npm install`
   - Start command: `npm start`
4. Aguarde o deploy. A URL final fica algo como
   `https://company-tech-profiler-remote.onrender.com`.
5. O endpoint MCP é essa URL + `/mcp`
   (ex: `https://company-tech-profiler-remote.onrender.com/mcp`).

**Nota sobre o free tier:** o serviço "dorme" após ~15 min sem receber
requisições. A primeira chamada depois disso demora uns 20-30s pra acordar;
chamadas seguintes respondem normalmente.

## Conectar no Cowork / claude.ai

Use a URL do passo 5 acima (terminando em `/mcp`) na tela de conectores/MCP
remotos do Cowork/claude.ai, como um servidor MCP do tipo "Streamable HTTP".
