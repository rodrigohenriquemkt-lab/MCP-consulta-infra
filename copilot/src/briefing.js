import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { gatherRaw, domainFromParticipants, clip } from "./context.js";

const client = config.mock ? null : new Anthropic();

const SYNTH = `Você prepara o briefing que o consultor-sombra de cibersegurança do Rodrigo (Gantech) usará DURANTE uma reunião com cliente.
Receberá dados brutos de CRM, e-mail, transcrições de reuniões do Teams, WhatsApp e infraestrutura pública.
Produza um briefing em português, objetivo, com as seções (omita as vazias):
- Cliente e interlocutores (cargo, papel na decisão)
- Histórico e estágio comercial (oportunidades, propostas, datas)
- Dores e requisitos já declarados (cite a fonte e a data)
- Pendências e compromissos em aberto (de ambos os lados)
- Fabricantes/produtos já discutidos, concorrentes e objeções
- Ambiente técnico conhecido (nuvem, firewall, identidade, etc.)
- Lacunas: o que ainda NÃO sabemos e vale perguntar
Regras: ignore assuntos pessoais e conversas sem relação com negócio/cibersegurança; não copie dados pessoais sensíveis; não invente nada; marque inferências como "(inferido)"; se uma fonte estiver indisponível, diga só isso. Máximo ~600 palavras.`;

export async function buildBriefing({ titulo, participantes, clienteNome, dominio, extra = "" }) {
  dominio = dominio || domainFromParticipants(participantes);
  clienteNome = clienteNome || titulo || "";
  const raw = (await gatherRaw({ clienteNome, dominio, titulo })) + (extra ? `\n\n## Contexto adicional\n${extra}` : "");
  if (!raw.trim()) return "Sem contexto prévio disponível.";
  if (config.mock) return clip(raw, 4000);
  const res = await client.messages.create({
    model: config.model,
    max_tokens: 2500,
    system: SYNTH,
    messages: [{ role: "user", content: `Reunião: ${titulo || "(sem título)"}\nCliente: ${clienteNome}\nDomínio: ${dominio}\n\nDADOS BRUTOS:\n${clip(raw, 60000)}` }],
    output_config: { effort: "medium" },
  });
  return res.content.find((b) => b.type === "text")?.text ?? "Sem contexto prévio disponível.";
}
