// Curated fingerprint rules. Each rule tests HTTP headers and/or HTML body
// against a pattern and, on match, reports a technology + category.
// This is intentionally small and hand-curated (not a vendored copy of any
// third-party proprietary database) to keep licensing clean.

function headerContains(headers, headerName, substring) {
  const value = headers.get(headerName);
  return !!value && value.toLowerCase().includes(substring.toLowerCase());
}

export const SIGNATURES = [
  // --- CDN / Edge ---
  {
    name: "Cloudflare",
    category: "CDN",
    test: (h) => h.headers.has("cf-ray") || headerContains(h.headers, "server", "cloudflare"),
  },
  {
    name: "Amazon CloudFront",
    category: "CDN",
    test: (h) => h.headers.has("x-amz-cf-id") || headerContains(h.headers, "via", "cloudfront"),
  },
  {
    name: "Fastly",
    category: "CDN",
    test: (h) => h.headers.has("x-served-by") && headerContains(h.headers, "x-served-by", "cache-"),
  },
  {
    name: "Akamai",
    category: "CDN",
    test: (h) => headerContains(h.headers, "server", "akamaighost") || h.headers.has("x-akamai-transformed"),
  },

  // --- Hosting / PaaS ---
  {
    name: "Vercel",
    category: "Hosting/PaaS",
    test: (h) => h.headers.has("x-vercel-id") || headerContains(h.headers, "server", "vercel"),
  },
  {
    name: "Netlify",
    category: "Hosting/PaaS",
    test: (h) => h.headers.has("x-nf-request-id") || headerContains(h.headers, "server", "netlify"),
  },
  {
    name: "GitHub Pages",
    category: "Hosting/PaaS",
    test: (h) => headerContains(h.headers, "server", "github.com"),
  },
  {
    name: "Heroku",
    category: "Hosting/PaaS",
    test: (h) => headerContains(h.headers, "via", "heroku"),
  },
  {
    name: "Amazon S3 (static hosting)",
    category: "Hosting/PaaS",
    test: (h) => headerContains(h.headers, "server", "amazons3"),
  },

  // --- CMS ---
  {
    name: "WordPress",
    category: "CMS",
    test: (h) =>
      /wp-content|wp-includes/i.test(h.body) || /<meta[^>]+generator[^>]+wordpress/i.test(h.body),
  },
  {
    name: "Shopify",
    category: "Ecommerce",
    test: (h) => h.headers.has("x-shopify-stage") || /cdn\.shopify\.com/i.test(h.body),
  },
  {
    name: "Wix",
    category: "CMS",
    test: (h) => headerContains(h.headers, "server", "wixserver") || /static\.wixstatic\.com/i.test(h.body),
  },
  {
    name: "Squarespace",
    category: "CMS",
    test: (h) => /static1\.squarespace\.com/i.test(h.body),
  },
  {
    name: "Webflow",
    category: "CMS",
    test: (h) => /assets\.website-files\.com/i.test(h.body),
  },
  {
    name: "Drupal",
    category: "CMS",
    test: (h) => h.headers.has("x-drupal-cache") || /sites\/(all|default)\/(modules|themes)/i.test(h.body),
  },

  // --- Analytics / Marketing ---
  {
    name: "Google Analytics",
    category: "Analytics",
    test: (h) => /googletagmanager\.com\/gtag\/js|google-analytics\.com\/analytics\.js/i.test(h.body),
  },
  {
    name: "Google Tag Manager",
    category: "Analytics",
    test: (h) => /googletagmanager\.com\/gtm\.js/i.test(h.body),
  },
  {
    name: "Hotjar",
    category: "Analytics",
    test: (h) => /static\.hotjar\.com/i.test(h.body),
  },
  {
    name: "Segment",
    category: "Analytics",
    test: (h) => /cdn\.segment\.com/i.test(h.body),
  },
  {
    name: "HubSpot",
    category: "Marketing",
    test: (h) => /js\.hs-scripts\.com|js\.hubspot\.com/i.test(h.body),
  },

  // --- Payments ---
  {
    name: "Stripe",
    category: "Payments",
    test: (h) => /js\.stripe\.com/i.test(h.body),
  },
  {
    name: "PayPal",
    category: "Payments",
    test: (h) => /paypal\.com\/sdk\/js/i.test(h.body),
  },

  // --- Frontend frameworks (light signal) ---
  {
    name: "React",
    category: "Frontend Framework",
    test: (h) => /data-reactroot|__next|react-dom/i.test(h.body),
  },
  {
    name: "Next.js",
    category: "Frontend Framework",
    test: (h) => /__next|_next\/static/i.test(h.body),
  },
];

// ASN organization name -> cloud provider label. Matched with substring
// search against the "org"/"as" fields returned by ip-api.com.
export const ASN_ORG_TO_PROVIDER = [
  { match: "amazon", provider: "Amazon Web Services (AWS)" },
  { match: "google", provider: "Google Cloud Platform (GCP)" },
  { match: "microsoft", provider: "Microsoft Azure" },
  { match: "cloudflare", provider: "Cloudflare" },
  { match: "fastly", provider: "Fastly" },
  { match: "akamai", provider: "Akamai" },
  { match: "digitalocean", provider: "DigitalOcean" },
  { match: "linode", provider: "Linode (Akamai Connected Cloud)" },
  { match: "ovh", provider: "OVHcloud" },
  { match: "hetzner", provider: "Hetzner" },
  { match: "oracle", provider: "Oracle Cloud Infrastructure (OCI)" },
  { match: "alibaba", provider: "Alibaba Cloud" },
];

export const MX_TO_EMAIL_PROVIDER = [
  { match: "google.com", provider: "Google Workspace" },
  { match: "outlook.com", provider: "Microsoft 365 / Outlook" },
  { match: "protection.outlook.com", provider: "Microsoft 365 / Outlook" },
  { match: "zoho.com", provider: "Zoho Mail" },
  { match: "mailgun.org", provider: "Mailgun" },
  { match: "pphosted.com", provider: "Proofpoint" },
];
