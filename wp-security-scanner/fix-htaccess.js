'use strict';
const { Client } = require('basic-ftp');

const XMLRPC_BLOCK = `# --- wp-security-scanner: disable XML-RPC (start) ---
<IfModule mod_authz_core.c>
  <Files "xmlrpc.php">
    Require all denied
  </Files>
</IfModule>
<IfModule !mod_authz_core.c>
  <Files "xmlrpc.php">
    Order allow,deny
    Deny from all
  </Files>
</IfModule>
# --- wp-security-scanner: disable XML-RPC (end) ---
`;

const SECURITY_HEADERS_BLOCK = `# --- wp-security-scanner: security headers (start) ---
<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>
# --- wp-security-scanner: security headers (end) ---
`;

const BACKUP_DB_HTACCESS = `# wp-security-scanner: block public access to this directory
<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Order allow,deny
  Deny from all
</IfModule>
`;

function log(step, msg) {
  console.log(`[ftp-fix] ${step}: ${msg}`);
}

async function findWebRoot(client) {
  const candidates = ['/', '/public_html', '/www', '/htdocs'];
  for (const dir of candidates) {
    try {
      const list = await client.list(dir);
      if (list.some((f) => f.name === 'wp-config.php')) {
        return dir;
      }
    } catch (e) {
      // candidate path doesn't exist, keep trying
    }
  }
  return null;
}

async function downloadText(client, remotePath) {
  const chunks = [];
  const { Writable } = require('stream');
  const sink = new Writable({
    write(chunk, enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  await client.downloadTo(sink, remotePath);
  return Buffer.concat(chunks).toString('utf8');
}

async function uploadText(client, remotePath, text) {
  const { Readable } = require('stream');
  await client.uploadFrom(Readable.from([text]), remotePath);
}

async function diagCheck() {
  // Isolates whether outbound FTP (port 21) works at all from this
  // container, using a well-known public anonymous FTP server, unrelated
  // to the real target. Helps tell apart "Railway blocks port 21" from
  // "the target host rejects/firewalls this connection".
  const client = new Client(15000);
  client.ftp.verbose = true;
  client.ftp.log = (msg) => console.log(`[diag-raw] ${msg}`);
  try {
    log('diag', 'trying plain FTP to speedtest.tele2.net:21 (anonymous, public test server)');
    await client.access({ host: 'speedtest.tele2.net', user: 'anonymous', password: 'anonymous@', secure: false });
    log('diag', 'SUCCESS connecting to public FTP server — outbound port 21 works from this container');
  } catch (e) {
    log('diag', `FAILED connecting to public FTP server: ${e.name || 'Error'}: ${e.message} code=${e.code || 'n/a'}`);
  } finally {
    client.close();
  }
}

async function run() {
  if (process.env.FTP_DIAG === 'true') {
    await diagCheck();
    return;
  }
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASSWORD;
  const port = Number(process.env.FTP_PORT || 21);

  if (!host || !user || !password) {
    log('config', 'FTP_HOST/FTP_USER/FTP_PASSWORD not set, aborting');
    return;
  }

  const client = new Client(30000);
  client.ftp.verbose = true;
  client.ftp.log = (msg) => console.log(`[ftp-raw] ${msg}`);

  try {
    log('connect', `connecting to ${host}:${port} (explicit FTPS)`);
    await client.access({
      host,
      port,
      user,
      password,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });
    log('connect', 'connected');

    const webRoot = await findWebRoot(client);
    if (!webRoot) {
      log('webroot', 'could not find wp-config.php in / , /public_html, /www, /htdocs — aborting');
      return;
    }
    log('webroot', `found WordPress root at ${webRoot}`);

    // 1. Root .htaccess: backup, then append XML-RPC block + security headers
    const rootHtaccess = `${webRoot === '/' ? '' : webRoot}/.htaccess`;
    let currentHtaccess = '';
    try {
      currentHtaccess = await downloadText(client, rootHtaccess);
      log('htaccess', `downloaded current .htaccess (${currentHtaccess.length} bytes)`);
    } catch (e) {
      log('htaccess', `no existing .htaccess found (${e.message}), starting fresh`);
    }

    const backupPath = `${rootHtaccess}.bak-${Date.now()}`;
    if (currentHtaccess) {
      await uploadText(client, backupPath, currentHtaccess);
      log('htaccess', `backed up existing .htaccess to ${backupPath}`);
    }

    let updated = currentHtaccess;
    if (!updated.includes('wp-security-scanner: disable XML-RPC')) {
      updated = `${updated}\n${XMLRPC_BLOCK}`;
    } else {
      log('htaccess', 'XML-RPC block already present, skipping');
    }
    if (!updated.includes('wp-security-scanner: security headers')) {
      updated = `${updated}\n${SECURITY_HEADERS_BLOCK}`;
    } else {
      log('htaccess', 'security headers block already present, skipping');
    }

    await uploadText(client, rootHtaccess, updated);
    log('htaccess', 'uploaded updated .htaccess with XML-RPC block + security headers');

    // 2. List /wp-content/backup-db/ so a human can see what was exposed
    const backupDbDir = `${webRoot === '/' ? '' : webRoot}/wp-content/backup-db`;
    try {
      const files = await client.list(backupDbDir);
      log(
        'backup-db',
        `contents of ${backupDbDir}: ${files.length === 0 ? '(empty)' : files.map((f) => f.name).join(', ')}`
      );
    } catch (e) {
      log('backup-db', `could not list ${backupDbDir} (${e.message})`);
    }

    // 3. Drop a .htaccess inside backup-db to block direct web access
    try {
      await uploadText(client, `${backupDbDir}/.htaccess`, BACKUP_DB_HTACCESS);
      log('backup-db', `uploaded .htaccess to ${backupDbDir} to block public access`);
    } catch (e) {
      log('backup-db', `failed to write .htaccess in ${backupDbDir}: ${e.message}`);
    }

    log('done', 'all fixes applied');
  } catch (e) {
    log('error', `${e.name || 'Error'}: ${e.message || '(no message)'} code=${e.code || 'n/a'}`);
    if (e.stack) console.log(`[ftp-fix] stack: ${e.stack}`);
  } finally {
    client.close();
  }
}

module.exports = { run };
