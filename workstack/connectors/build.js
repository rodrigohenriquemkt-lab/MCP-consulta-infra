'use strict';
// Converte a coleta crua ({ email, chat, meeting, task, whatsapp, failed }) no arquivo de troca
// ({ generatedAt, okKinds, items }). Usado pelo app (que lê a coleta crua direto do OneDrive)
// e pelo script bin/build-inbox.js.
const { normalizeAll, NORMALIZERS } = require('./normalize');

function buildInbox(input, { me, now } = {}) {
  const failed = new Set(input.failed || []);
  // Só conta como coletado com sucesso o tipo que veio como lista e não está em `failed`.
  const okKinds = Object.keys(NORMALIZERS).filter((k) => !failed.has(k) && Array.isArray(input[k]));
  const items = okKinds.flatMap((k) => normalizeAll(k, input[k], { me, now }));
  return { generatedAt: new Date(now || Date.now()).toISOString(), okKinds, items };
}

module.exports = { buildInbox };
