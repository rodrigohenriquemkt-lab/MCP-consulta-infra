# Instalação e configuração — company-tech-profiler-remote

Este documento registra como o servidor MCP `company-tech-profiler-remote`
está hospedado e conectado, para referência futura (reinstalação, troca de
provedor, onboarding de outra pessoa).

## Histórico

- **Até 09/2026:** hospedado no Render (free tier), via `render.yaml`.
  O free tier "dormia" após ~15 min de inatividade, causando 20-30s de
  atraso na primeira chamada após período ocioso.
- **A partir de 09/2026:** migrado para o Railway, via `railway.json`.
  Sem dormência por inatividade no plano usado.

## 1. Deploy no Railway

1. Login em https://railway.com com a conta do GitHub
   (`rodrigohenriquemkt-lab`).
2. **New Project** → **Deploy from GitHub repo** → selecionar o repositório
   `rodrigohenriquemkt-lab/MCP-consulta-infra`.
3. O Railway lê `railway.json` automaticamente:
   - Build: Nixpacks, `npm install`
   - Start: `npm start` (roda `node src/index.js`)
4. Em **Settings → Networking** do serviço, clicar em **Generate Domain**
   para expor uma URL pública. A porta é detectada via `process.env.PORT`
   (já usada em `src/index.js`).
5. Projeto atual no Railway:
   - **Projeto:** `analyze_company`
   - **Serviço:** `company-tech-profiler-remote`
   - **Domínio público:**
     `https://company-tech-profiler-remote-production.up.railway.app`
   - **Endpoint MCP:**
     `https://company-tech-profiler-remote-production.up.railway.app/mcp`

Nenhuma variável de ambiente além da porta (gerenciada automaticamente
pelo Railway) é necessária — todas as fontes de dados usadas pelas
ferramentas são públicas e gratuitas (DNS, RDAP, TLS, crt.sh, ip-api.com).

## 2. Conectar no Cowork / claude.ai

1. Em claude.ai/Cowork → **Configurações → Conectores**.
2. **Adicionar conector customizado** → tipo **MCP remoto (Streamable
   HTTP)**.
3. URL: `https://company-tech-profiler-remote-production.up.railway.app/mcp`
4. Nome sugerido: `company-tech-profiler-remote`.
5. Salvar e testar chamando qualquer ferramenta (ex: `analyze_company`)
   com um domínio de teste.

> **Nota:** se um conector antigo (apontando para o Render) não permitir
> editar a URL, é necessário excluí-lo e criar um novo — não há edição
> in-place de URL em todos os casos.

## 3. Ferramentas expostas

- `get_dns_records`
- `get_domain_registration`
- `get_ssl_certificate`
- `fingerprint_website`
- `get_ip_and_cloud_provider`
- `find_subdomains`
- `analyze_company`
- `generate_report_pdf`

## 4. Rodar localmente (dev)

```bash
npm install
npm start
# ouve em http://localhost:3000, endpoint MCP em /mcp
```

## 5. Checklist de migração (concluído em 09/2026)

- [x] `railway.json` criado, `render.yaml` removido
- [x] Deploy no Railway validado (`SUCCESS`)
- [x] Domínio público gerado
- [x] Conector novo criado em claude.ai/Cowork apontando para o Railway
- [x] Conector antigo (Render) removido do Cowork
- [x] Serviço no Render desligado
- [x] PR de migração mergeado (`#1` — "Migra deploy de Render para
      Railway")
