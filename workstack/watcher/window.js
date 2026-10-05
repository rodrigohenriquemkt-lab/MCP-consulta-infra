'use strict';
// Observa a janela em primeiro plano (somente Windows) e reconhece quando o usuário
// abre um e-mail/reunião no Outlook ou uma conversa/reunião no Teams (apps desktop).
// Só processos da lista abaixo são lidos; o título de qualquer outro app é descartado
// na hora e nunca armazenado.
const { spawn } = require('child_process');

const OUTLOOK_VIEWS = new Set(['mail', 'email', 'e-mail', 'inbox', 'caixa de entrada', 'calendar', 'calendário',
  'calendario', 'people', 'pessoas', 'contatos', 'contacts', 'tasks', 'tarefas', 'to do', 'sent items',
  'itens enviados', 'drafts', 'rascunhos', 'deleted items', 'itens excluídos', 'junk email',
  'lixo eletrônico', 'archive', 'arquivo', 'search', 'pesquisa', 'resultados da pesquisa']);
const TEAMS_VIEWS = new Set(['chat', 'bate-papo', 'conversa', 'calendar', 'calendário', 'calendario', 'activity',
  'atividade', 'teams', 'equipes', 'communities', 'comunidades', 'calls', 'chamadas', 'files', 'arquivos',
  'onedrive', 'apps', 'more', 'mais', 'feed', 'copilot', 'novo chat', 'new chat']);

const strip = (t) => String(t || '').replace(/^\(\d+\)\s*/, '').replace(/\s+/g, ' ').trim();
const KIND_BY_WORD = [
  [/^(mensagem|message|discuss[ãa]o|discussion)$/i, 'email'],
  [/^(reuni[ãa]o|meeting|compromisso|appointment|evento|event)$/i, 'meeting'],
  [/^(tarefa|task)$/i, 'task'],
];

function parseOutlook(proc, title) {
  // Janela própria de um item (Outlook clássico): "Assunto  -  Mensagem (HTML)"
  const m = title.match(/^(.+?)\s+-\s+(Mensagem|Message|Reunião|Reuniao|Meeting|Compromisso|Appointment|Evento|Event|Tarefa|Task|Discussão|Discussion)\b/i);
  if (m) {
    const subject = strip(m[1]);
    const kind = (KIND_BY_WORD.find(([re]) => re.test(m[2])) || [])[1];
    if (subject && kind && !/^(sem t[ií]tulo|untitled)$/i.test(subject)) return { kind, source: 'outlook', key: subject.toLowerCase(), title: subject };
    return null;
  }
  // Novo Outlook (olk): janela destacada, melhor esforço. A janela principal tem 3+ partes
  // ("Mail - Nome - Outlook") e é ignorada; só vale "Assunto - Outlook" com 2 partes.
  if (proc === 'olk') {
    const parts = title.split(' - ').map(strip);
    if (parts.length === 2 && /^outlook$/i.test(parts[1]) && parts[0] && !OUTLOOK_VIEWS.has(parts[0].toLowerCase())) {
      return { kind: 'email', source: 'outlook', key: parts[0].toLowerCase(), title: parts[0] };
    }
  }
  return null;
}

function parseTeams(title) {
  const parts = title.split('|').map(strip).filter(Boolean);
  if (parts.length && /^microsoft teams$/i.test(parts[parts.length - 1])) parts.pop();
  while (parts.length && TEAMS_VIEWS.has(parts[0].toLowerCase())) parts.shift();
  if (!parts.length) return null;
  const name = parts.join(' · ');
  const kind = /reuni[ãa]o|meeting|chamada|call/i.test(parts[0]) ? 'meeting' : 'chat';
  return { kind, source: 'teams', key: name.toLowerCase(), title: name };
}

// proc: nome do processo sem .exe; title: título da janela. Retorna null se não for relevante.
function parseWindow(proc, title) {
  const p = String(proc || '').toLowerCase();
  const t = String(title || '');
  if (!t) return null;
  if (p === 'outlook' || p === 'olk') return parseOutlook(p, t);
  if (p === 'ms-teams' || p === 'teams' || p === 'msteams') return parseTeams(t);
  return null;
}

// Um único PowerShell de longa duração imprime "processo|título" quando a janela ativa muda.
const PS = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class W {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int p);
}
"@
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$last = ""
while ($true) {
  $h = [W]::GetForegroundWindow()
  $sb = New-Object Text.StringBuilder 512
  [void][W]::GetWindowText($h, $sb, 512)
  $procId = 0
  [void][W]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
  $line = "$name|" + $sb.ToString()
  if ($line -ne $last) { $last = $line; $line }
  Start-Sleep -Milliseconds 1000
}
`;

// onOpen(item) é chamado quando a mesma janela relevante fica em foco por `dwellMs`
// (evita registrar alt-tab de passagem).
function startWatcher(onOpen, { dwellMs = 4000, debug = false, platform = process.platform } = {}) {
  if (platform !== 'win32') return { stop() {}, supported: false };
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(PS, 'utf16le').toString('base64')], { windowsHide: true });
  let buf = '', timer = null;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
      const cut = line.indexOf('|'); // título pode conter '|', então só o primeiro separa
      if (cut < 0) continue;
      const proc = line.slice(0, cut), title = line.slice(cut + 1);
      clearTimeout(timer);
      const parsed = parseWindow(proc, title);
      if (debug && /^(outlook|olk|ms-teams|teams|msteams)$/i.test(proc)) console.log(`[watch] ${proc} | ${title} -> ${parsed ? parsed.title : '(ignorado)'}`);
      if (parsed) timer = setTimeout(() => onOpen(parsed), dwellMs);
    }
  });
  child.on('error', () => {});
  return { supported: true, stop() { clearTimeout(timer); child.kill(); } };
}

module.exports = { parseWindow, startWatcher };
