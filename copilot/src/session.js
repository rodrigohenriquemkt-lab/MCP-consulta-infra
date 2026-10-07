import { config } from "./config.js";
import { analyze } from "./brain.js";

const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const isQuestion = (s) => /\?\s*$/.test(s.trim());

// Uma sessão por reunião: acumula falas, decide QUANDO analisar e publica sugestões.
export class MeetingSession {
  constructor({ id, briefing, publish }) {
    this.id = id;
    this.briefing = briefing;
    this.publish = publish; // (evento) => void  (SSE para o console)
    this.utterances = []; // { speaker, text, ts }
    this.newWords = 0;
    this.lastRun = 0;
    this.running = false;
    this.timer = null;
    this.jaSugerido = [];
  }

  // Fala FINAL (não parcial) vinda da captura.
  addUtterance(speaker, text) {
    if (!text?.trim()) return;
    this.utterances.push({ speaker, text: text.trim(), ts: Date.now() });
    this.newWords += wordCount(text);
    this.publish({ type: "transcript", speaker, text });

    const fromClient = !config.userNames.includes((speaker || "").toLowerCase());
    // Pergunta do cliente dispara análise sem esperar o limiar de palavras.
    const urgent = fromClient && isQuestion(text);
    if (this.newWords >= config.minNewWords || urgent) this.schedule(urgent ? 800 : config.debounceMs);
  }

  recentTranscript(n = 40) {
    return this.utterances.slice(-n).map((u) => `${u.speaker}: ${u.text}`).join("\n");
  }

  schedule(delay) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), delay); // debounce: espera a fala assentar
  }

  async run() {
    const now = Date.now();
    if (this.running) return this.schedule(2000);
    if (now - this.lastRun < config.cooldownMs) return this.schedule(config.cooldownMs - (now - this.lastRun));
    this.running = true;
    this.newWords = 0;
    this.lastRun = now;
    try {
      const out = await analyze({ briefing: this.briefing, transcript: this.recentTranscript(), jaSugerido: this.jaSugerido });
      if (out.relevante && out.sugestoes.length) {
        for (const s of out.sugestoes) this.jaSugerido.push(`${s.tipo}: ${s.titulo}`);
        this.jaSugerido = this.jaSugerido.slice(-20);
        this.publish({ type: "suggestions", topico: out.topico, sugestoes: out.sugestoes });
      }
    } catch (e) {
      this.publish({ type: "error", message: e.message });
    } finally {
      this.running = false;
    }
  }
}
