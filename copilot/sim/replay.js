// Reproduz uma reunião gravada (jsonl) contra o servidor local. Uso: node sim/replay.js arquivo.jsonl
import { readFileSync } from "node:fs";
const base = process.env.BASE || "http://localhost:3100";
const r = await fetch(`${base}/meetings`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ clienteNome: "Cliente Exemplo" }),
}).then((x) => x.json());
console.log("Console:", `${base}${r.console}`);
const es = await fetch(`${base}/sessions/${r.sessionId}/stream`);
(async () => { for await (const chunk of es.body) { const m = /data: (.*)/.exec(Buffer.from(chunk).toString()); if (m) { const d = JSON.parse(m[1]); if (d.type !== "transcript") console.log(JSON.stringify(d, null, 1)); } } })();
for (const line of readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean)) {
  await fetch(`${base}/sessions/${r.sessionId}/utterances`, { method: "POST", headers: { "Content-Type": "application/json" }, body: line });
  await new Promise((ok) => setTimeout(ok, 1500));
}
await new Promise((ok) => setTimeout(ok, Number(process.env.WAIT_MS || 30000)));
process.exit(0);
