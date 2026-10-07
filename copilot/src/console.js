// Painel privado (só o Rodrigo vê): abra em 2º monitor/celular. Não aparece na reunião.
export function consoleHtml(id, token) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Copiloto Gantech</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--card:#f5f1f3;--accent:#8a1c4a;--mut:#6b6b6b}
@media(prefers-color-scheme:dark){:root{--bg:#141214;--fg:#eee;--card:#231f22;--accent:#e0679d;--mut:#9a9a9a}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;padding:16px;max-width:760px;margin:auto}
.card{background:var(--card);border-left:4px solid var(--accent);border-radius:8px;padding:12px 14px;margin:10px 0}
.tag{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);font-weight:700}
.fala{margin:6px 0;font-style:italic}.mut{color:var(--mut);font-size:13px}
a{color:var(--accent)} #tx{font-size:13px;color:var(--mut);max-height:22vh;overflow:auto;border-top:1px solid var(--card);margin-top:16px;padding-top:8px}
</style></head><body><h3>Copiloto Gantech <span class="mut" id="t"></span></h3><div id="s"></div><div id="tx"></div>
<script>
const s=document.getElementById('s'),tx=document.getElementById('tx'),esc=x=>String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const es=new EventSource('/sessions/${id}/stream?token=${encodeURIComponent(token)}');
es.onmessage=e=>{const d=JSON.parse(e.data);
 if(d.type==='transcript'){tx.insertAdjacentHTML('beforeend','<div><b>'+esc(d.speaker)+':</b> '+esc(d.text)+'</div>');tx.scrollTop=tx.scrollHeight}
 if(d.type==='error')s.insertAdjacentHTML('afterbegin','<div class="card mut">Erro: '+esc(d.message)+'</div>');
 if(d.type==='suggestions'){document.getElementById('t').textContent='· '+d.topico;
  for(const g of d.sugestoes.reverse()){const links=g.produtos.flatMap(p=>p.links.map(l=>'<a target="_blank" rel="noopener" href="'+esc(l.url)+'">'+esc(l.titulo)+'</a>')).join(' · ');
   s.insertAdjacentHTML('afterbegin','<div class="card"><div class="tag">'+g.tipo+' · '+(g.urgencia==='agora'?'agora':'oportuno')+'</div><b>'+esc(g.titulo)+'</b><div class="fala">“'+esc(g.fala_sugerida)+'”</div><div class="mut">'+esc(g.porque)+'</div>'+(g.produtos.length?'<div class="mut">'+g.produtos.map(p=>esc(p.nome)).join(', ')+'</div>':'')+(links?'<div>'+links+'</div>':'')+'</div>')}}};
</script></body></html>`;
}
