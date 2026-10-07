import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { catalogForPrompt, resolveProducts } from "./catalog.js";
import { liveTools, runLiveTool } from "./context.js";

const client = config.mock ? null : new Anthropic();

const SYSTEM = `Você é o consultor-sombra estratégico, técnico e comercial de cibersegurança do Rodrigo (Senior Cybersecurity Account Manager, Gantech). Ele está em uma reunião ao vivo com um cliente; só ele vê suas respostas.

PAPEL
- Ouça a transcrição recente e devolva, quando houver valor, sugestões curtas e acionáveis: oferta Gantech aderente, pergunta de discovery para o cliente, alerta de risco/oportunidade ou insight técnico.
- Fale em português do Brasil, objetivo e preciso. Sem floreio, sem repetir o que o Rodrigo acabou de dizer.
- "fala_sugerida" é o que o Rodrigo pode dizer: consultiva, em primeira pessoa, ancorada em risco, governança (NIST), arquitetura e valor de negócio, nunca "empurrando" produto.

ESCOPO
- Ignore assuntos pessoais, small talk e temas fora de cibersegurança/TI relacionada: nesses casos retorne relevante=false e sugestoes vazias.
- Use apenas produtos do CATÁLOGO, referenciados pelo id. Nunca invente produto, preço, prazo, certificação ou URL; links são anexados pelo sistema.
- Fatos sobre o cliente só se constarem do BRIEFING, da transcrição ou do retorno de ferramentas. Se não souber, faça uma pergunta em vez de supor. Marque inferências como tal.
- Use ferramentas só quando a informação mudar a recomendação (ex.: cliente cita um domínio/ambiente).
- Não repita sugestões já feitas (lista em JA_SUGERIDO). Prefira 0 a 2 sugestões por rodada; silêncio é válido quando nada acrescenta.

SAÍDA: apenas o JSON do schema.`;

const SCHEMA = {
  type: "object",
  properties: {
    relevante: { type: "boolean" },
    topico: { type: "string", description: "Tema atual em poucas palavras" },
    sugestoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["oferta", "pergunta", "alerta", "insight"] },
          titulo: { type: "string" },
          fala_sugerida: { type: "string" },
          porque: { type: "string", description: "Gatilho na conversa/contexto, 1 frase" },
          produtos: { type: "array", items: { type: "string" }, description: "ids do catálogo" },
          urgencia: { type: "string", enum: ["agora", "quando_oportuno"] },
        },
        required: ["tipo", "titulo", "fala_sugerida", "porque", "produtos", "urgencia"],
        additionalProperties: false,
      },
    },
  },
  required: ["relevante", "topico", "sugestoes"],
  additionalProperties: false,
};

export async function analyze({ briefing, transcript, jaSugerido }) {
  if (config.mock) return mockAnalyze(transcript);

  const system = [
    { type: "text", text: SYSTEM },
    {
      type: "text",
      text: `CATÁLOGO:\n${JSON.stringify(catalogForPrompt())}\n\nBRIEFING DO CLIENTE:\n${briefing}`,
      cache_control: { type: "ephemeral" },
    },
  ];
  const messages = [
    {
      role: "user",
      content: `JA_SUGERIDO:\n${jaSugerido.join("\n") || "(nada)"}\n\nTRANSCRIÇÃO RECENTE:\n${transcript}`,
    },
  ];

  for (let turn = 0; turn < 4; turn++) {
    const res = await client.messages.create({
      model: config.model,
      max_tokens: 2000,
      system,
      tools: liveTools,
      messages,
      output_config: { effort: config.effort, format: { type: "json_schema", schema: SCHEMA } },
    });
    if (res.stop_reason === "refusal") return { relevante: false, topico: "", sugestoes: [] };
    if (res.stop_reason !== "tool_use") {
      const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
      return enrich(JSON.parse(text));
    }
    messages.push({ role: "assistant", content: res.content });
    const results = await Promise.all(
      res.content
        .filter((b) => b.type === "tool_use")
        .map(async (b) => {
          try {
            return { type: "tool_result", tool_use_id: b.id, content: await runLiveTool(b.name, b.input) };
          } catch (e) {
            return { type: "tool_result", tool_use_id: b.id, content: `Erro: ${e.message}`, is_error: true };
          }
        })
    );
    messages.push({ role: "user", content: results });
  }
  return { relevante: false, topico: "", sugestoes: [] };
}

// Anexa links reais do catálogo; descarta ids desconhecidos.
function enrich(out) {
  out.sugestoes = (out.sugestoes || []).map((s) => ({ ...s, produtos: resolveProducts(s.produtos) }));
  return out;
}

function mockAnalyze(transcript) {
  const t = transcript.toLowerCase();
  if (!/(ransomware|nuvem|cloud|soc|seguran|incidente)/.test(t))
    return { relevante: false, topico: "fora de escopo", sugestoes: [] };
  return enrich({
    relevante: true,
    topico: "ransomware / endpoint",
    sugestoes: [
      {
        tipo: "oferta",
        titulo: "EDR/XDR com resposta",
        fala_sugerida: "Pelo que vocês descreveram, vale olhar a cobertura de endpoint e quem responde fora do horário comercial.",
        porque: "Cliente citou incidente de ransomware.",
        produtos: ["exemplo-edr", "id-inexistente"],
        urgencia: "agora",
      },
    ],
  });
}
