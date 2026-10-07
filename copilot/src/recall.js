import { config } from "./config.js";

// Cria o bot do Recall.ai que entra na reunião (Teams/Zoom/Meet) e envia a
// transcrição em tempo real para o nosso webhook. NÃO TESTADO contra a API real:
// valide os campos com a documentação atual do Recall antes do primeiro uso.
export async function joinMeeting({ meetingUrl, sessionId }) {
  const res = await fetch(`${config.recallBase}/api/v1/bot/`, {
    method: "POST",
    headers: { Authorization: `Token ${config.recallToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: "Gantech Notetaker",
      metadata: { session_id: sessionId },
      recording_config: {
        transcript: { provider: { recallai_streaming: {} } },
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${config.publicUrl}/webhooks/recall?secret=${encodeURIComponent(config.webhookSecret)}`,
            events: ["transcript.data"],
          },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`Recall ${res.status}: ${await res.text()}`);
  return res.json();
}

// Extrai {sessionId, speaker, text} de um evento transcript.data (formato tolerante).
export function parseRecallEvent(body) {
  const d = body?.data;
  const words = d?.data?.words;
  if (body?.event !== "transcript.data" || !Array.isArray(words)) return null;
  return {
    sessionId: d?.bot?.metadata?.session_id,
    speaker: d?.data?.participant?.name || "Participante",
    text: words.map((w) => w.text).join(" "),
  };
}
