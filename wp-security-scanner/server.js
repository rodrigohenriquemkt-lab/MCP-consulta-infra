'use strict';
const http = require('http');
const https = require('https');
const tls = require('tls');
const { execFile } = require('child_process');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const SCAN_KEY = process.env.SCANNER_API_KEY || '';
const ALLOWED = (process.env.ALLOWED_DOMAINS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const WPSCAN_TOKEN = process.env.WPSCAN_API_TOKEN || '';

const lastResults = {};

function checkHeaders(domain) {
  return new Promise((resolve) => {
    const req = https.request(
      { host: domain, path: '/', method: 'HEAD', timeout: 15000 },
      (res) => {
        const h = res.headers;
        const wanted = [
          'strict-transport-security',
          'content-security-policy',
          'x-frame-options',
          'x-content-type-options',
          'referrer-policy',
          'permissions-policy',
        ];
        const report = {};
        for (const name of wanted) report[name] = h[name] || null;
        report.server = h.server || null;
        report['x-powered-by'] = h['x-powered-by'] || null;
        resolve({ status: res.statusCode, headers: report });
        res.resume();
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

function checkTlsVersion(domain, version) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        minVersion: version,
        maxVersion: version,
        rejectUnauthorized: false,
        timeout: 10000,
      },
      () => {
        settled = true;
        resolve(true);
        socket.end();
      }
    );
    socket.on('error', () => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    });
    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
      socket.destroy();
    });
  });
}

async function checkTls(domain) {
  const results = {};
  for (const v of ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3']) {
    results[v] = await checkTlsVersion(domain, v);
  }
  return results;
}

function runWpscan(domain) {
  return new Promise((resolve) => {
    const args = [
      '--url',
      `https://${domain}`,
      '--enumerate',
      'vp,vt,u',
      '--random-user-agent',
      '--format',
      'json',
      '--no-banner',
      '--throttle',
      '500',
    ];
    if (WPSCAN_TOKEN) args.push('--api-token', WPSCAN_TOKEN);

    execFile(
      'wpscan',
      args,
      { timeout: 8 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (stdout) {
          try {
            return resolve(JSON.parse(stdout));
          } catch (e) {
            return resolve({ raw: stdout, parseError: e.message });
          }
        }
        resolve({ error: err ? err.message : 'no output', stderr });
      }
    );
  });
}

async function scanDomain(domain) {
  const [headers, tlsVersions, wpscan] = await Promise.all([
    checkHeaders(domain),
    checkTls(domain),
    runWpscan(domain),
  ]);
  return { domain, scannedAt: new Date().toISOString(), headers, tls: tlsVersions, wpscan };
}

async function scanAll() {
  for (const domain of ALLOWED) {
    console.log(`[scan] starting ${domain}`);
    try {
      const result = await scanDomain(domain);
      lastResults[domain] = result;
      console.log('===SCAN_RESULT_START===');
      console.log(JSON.stringify(result, null, 2));
      console.log('===SCAN_RESULT_END===');
    } catch (e) {
      console.log(`[scan] failed ${domain}: ${e.message}`);
    }
  }
}

function requireKey(req, parsed, res) {
  const key = req.headers['x-scan-key'] || parsed.searchParams.get('key');
  if (!SCAN_KEY || key !== SCAN_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  if (parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (parsed.pathname === '/scan') {
    if (!requireKey(req, parsed, res)) return;
    const domain = (parsed.searchParams.get('domain') || '').toLowerCase();
    if (!ALLOWED.includes(domain)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'domain not allowed', allowed: ALLOWED }));
    }
    console.log(`[http] on-demand scan requested for ${domain}`);
    const result = await scanDomain(domain);
    lastResults[domain] = result;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result, null, 2));
  }

  if (parsed.pathname === '/results') {
    if (!requireKey(req, parsed, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(lastResults, null, 2));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`wp-security-scanner listening on ${PORT}`);
  if (ALLOWED.length) {
    scanAll();
  } else {
    console.log('[scan] no ALLOWED_DOMAINS configured, skipping boot scan');
  }
});
