import dns from "node:dns/promises";
import tls from "node:tls";
import { SIGNATURES, ASN_ORG_TO_PROVIDER, MX_TO_EMAIL_PROVIDER } from "./signatures.js";

const UA = "company-tech-profiler-mcp/1.0 (+public-data-only)";

export async function getDnsRecords(domain) {
  const records = {};
  const lookups = {
    A: () => dns.resolve4(domain),
    AAAA: () => dns.resolve6(domain),
    MX: () => dns.resolveMx(domain),
    NS: () => dns.resolveNs(domain),
    TXT: () => dns.resolveTxt(domain),
    CNAME: () => dns.resolveCname(domain),
  };
  for (const [type, fn] of Object.entries(lookups)) {
    try {
      records[type] = await fn();
    } catch {
      records[type] = null;
    }
  }
  return records;
}

export function detectEmailProvider(mxRecords) {
  if (!mxRecords) return null;
  const exchanges = mxRecords.map((r) => r.exchange.toLowerCase());
  for (const { match, provider } of MX_TO_EMAIL_PROVIDER) {
    if (exchanges.some((ex) => ex.includes(match))) return provider;
  }
  return null;
}

export async function getRdap(domain) {
  const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { "User-Agent": UA, Accept: "application/rdap+json" },
  });
  if (!res.ok) {
    return { error: `RDAP lookup failed with status ${res.status}` };
  }
  const data = await res.json();
  const events = Object.fromEntries(
    (data.events || []).map((e) => [e.eventAction, e.eventDate])
  );
  const registrarEntity = (data.entities || []).find((e) =>
    (e.roles || []).includes("registrar")
  );
  return {
    domain: data.ldhName || domain,
    registrar: registrarEntity?.vcardArray
      ? extractVcardField(registrarEntity.vcardArray, "fn")
      : undefined,
    status: data.status || [],
    registered_at: events.registration || null,
    expires_at: events.expiration || null,
    last_changed: events.lastChanged || null,
    nameservers: (data.nameservers || []).map((n) => n.ldhName),
  };
}

function extractVcardField(vcardArray, field) {
  try {
    const entries = vcardArray[1];
    const hit = entries.find((e) => e[0] === field);
    return hit ? hit[3] : undefined;
  } catch {
    return undefined;
  }
}

export function getSslCertificate(domain, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: 443, servername: domain, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate(false);
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          resolve({ error: "No certificate returned" });
          return;
        }
        resolve({
          subject: cert.subject?.CN,
          issuer: cert.issuer?.O || cert.issuer?.CN,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          subject_alt_names: cert.subjectaltname
            ? cert.subjectaltname.split(", ").map((s) => s.replace(/^DNS:/, ""))
            : [],
        });
      }
    );
    socket.on("error", (err) => resolve({ error: err.message }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ error: "Connection timed out" });
    });
  });
}

export async function fingerprintWebsite(domain) {
  const url = `https://${domain}`;
  let res;
  try {
    res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return { error: `Fetch failed: ${err.message}` };
  }
  const body = await res.text();
  const ctx = { headers: res.headers, body };

  const detected = SIGNATURES.filter((sig) => {
    try {
      return sig.test(ctx);
    } catch {
      return false;
    }
  }).map((sig) => ({ name: sig.name, category: sig.category }));

  return {
    final_url: res.url,
    status: res.status,
    server_header: res.headers.get("server") || null,
    powered_by_header: res.headers.get("x-powered-by") || null,
    technologies: detected,
  };
}

export async function getIpInfo(ip) {
  const res = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,isp,org,as,query`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return { error: `ip-api lookup failed with status ${res.status}` };
  const data = await res.json();
  if (data.status !== "success") return { error: data.message || "lookup failed" };

  const asOrg = `${data.org || ""} ${data.as || ""}`.toLowerCase();
  const provider = ASN_ORG_TO_PROVIDER.find((p) => asOrg.includes(p.match))?.provider || null;

  return {
    ip: data.query,
    isp: data.isp,
    org: data.org,
    asn: data.as,
    country: data.country,
    region: data.regionName,
    city: data.city,
    inferred_cloud_provider: provider,
  };
}

export async function findSubdomains(domain, limit = 50) {
  const res = await fetch(
    `https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) }
  );
  if (!res.ok) return { error: `crt.sh lookup failed with status ${res.status}` };
  const text = await res.text();
  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    return { error: "crt.sh returned unparseable data (it may be rate-limiting)" };
  }
  const names = new Set();
  for (const entry of entries) {
    for (const line of String(entry.name_value || "").split("\n")) {
      const clean = line.trim().toLowerCase();
      if (clean && !clean.startsWith("*.")) names.add(clean);
    }
  }
  const sorted = [...names].sort();
  return {
    total_unique_names: sorted.length,
    subdomains: sorted.slice(0, limit),
    truncated: sorted.length > limit,
  };
}
