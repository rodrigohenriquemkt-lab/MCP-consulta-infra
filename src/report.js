// Same rendering logic as the local skill's gerar_relatorio.js, adapted to
// return in-memory PDF bytes instead of writing to a file — so it can be
// served as an MCP tool result (base64 resource) from a stateless HTTP server.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { COLORS, drawGradientRect, accentForCategory } from "./brand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "..", "assets", "gantech-logo-white.png");

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN_X = 42;
const HEADER_H = 96;
const FOOTER_H = 34;
const CONTENT_TOP = PAGE_H - HEADER_H - 18;
const CONTENT_BOTTOM = FOOTER_H + 16;

function wrapText(text, font, size, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class Report {
  constructor(doc, fonts, meta, logoImage) {
    this.doc = doc;
    this.fonts = fonts;
    this.meta = meta;
    this.logoImage = logoImage;
    this.pageIndex = 0;
    this.page = null;
    this.y = 0;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageIndex += 1;
    this._drawHeader();
    this._drawFooter();
    this.y = CONTENT_TOP;
  }

  ensureSpace(height) {
    if (this.y - height < CONTENT_BOTTOM) this.newPage();
  }

  _drawHeader() {
    const { page } = this;
    drawGradientRect(page, {
      x: 0,
      y: PAGE_H - HEADER_H,
      width: PAGE_W,
      height: HEADER_H,
      from: COLORS.vinho,
      to: COLORS.magenta,
      horizontal: true,
    });

    const logoH = 30;
    const logoW = this.logoImage ? logoH * (this.logoImage.width / this.logoImage.height) : 0;
    const logoX = MARGIN_X;
    const logoY = PAGE_H - HEADER_H + HEADER_H / 2 + 6;
    if (this.logoImage) {
      page.drawImage(this.logoImage, { x: logoX, y: logoY, width: logoW, height: logoH });
    }
    page.drawText("Perfil de Tecnologia & Infraestrutura", {
      x: logoX,
      y: logoY - 16,
      size: 10,
      font: this.fonts.regular,
      color: COLORS.branco,
    });

    const domainSize = 16;
    const domainWidth = this.fonts.bold.widthOfTextAtSize(this.meta.domain, domainSize);
    page.drawText(this.meta.domain, {
      x: PAGE_W - MARGIN_X - domainWidth,
      y: PAGE_H - HEADER_H + HEADER_H / 2 + 10,
      size: domainSize,
      font: this.fonts.bold,
      color: COLORS.branco,
    });
    const dateText = this.meta.dateLabel;
    const dateWidth = this.fonts.regular.widthOfTextAtSize(dateText, 9);
    page.drawText(dateText, {
      x: PAGE_W - MARGIN_X - dateWidth,
      y: PAGE_H - HEADER_H + HEADER_H / 2 - 8,
      size: 9,
      font: this.fonts.regular,
      color: COLORS.branco,
    });
  }

  _drawFooter() {
    const { page } = this;
    drawGradientRect(page, {
      x: 0,
      y: FOOTER_H - 3,
      width: PAGE_W,
      height: 3,
      from: COLORS.vinho,
      to: COLORS.magenta,
      horizontal: true,
    });
    page.drawText(
      "Gerado pelo servico interno Gantech - fontes publicas: DNS, RDAP, TLS, fingerprint HTTP, crt.sh, ip-api.com",
      { x: MARGIN_X, y: 12, size: 7.5, font: this.fonts.regular, color: COLORS.cinzaMedio }
    );
    const pageLabel = `Pagina ${this.pageIndex}`;
    const w = this.fonts.regular.widthOfTextAtSize(pageLabel, 7.5);
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN_X - w,
      y: 12,
      size: 7.5,
      font: this.fonts.regular,
      color: COLORS.cinzaMedio,
    });
  }

  addSectionTitle(text) {
    this.ensureSpace(30);
    this.page.drawText(text.toUpperCase(), {
      x: MARGIN_X,
      y: this.y,
      size: 12.5,
      font: this.fonts.bold,
      color: COLORS.tituloVermelho,
    });
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y - 6 },
      end: { x: PAGE_W - MARGIN_X, y: this.y - 6 },
      thickness: 1.2,
      color: COLORS.tituloVermelho,
      opacity: 0.35,
    });
    this.y -= 26;
  }

  addCards(cards) {
    const gap = 12;
    const cardW = (PAGE_W - MARGIN_X * 2 - gap * (cards.length - 1)) / cards.length;
    const cardH = 62;
    this.ensureSpace(cardH + 8);
    cards.forEach((card, i) => {
      const x = MARGIN_X + i * (cardW + gap);
      const y = this.y - cardH;
      this.page.drawRectangle({ x, y, width: cardW, height: cardH, color: COLORS.cinzaClaro });
      this.page.drawRectangle({ x, y, width: 4, height: cardH, color: card.accent || COLORS.tituloVermelho });
      this.page.drawText(card.label.toUpperCase(), {
        x: x + 12,
        y: y + cardH - 18,
        size: 7.5,
        font: this.fonts.bold,
        color: COLORS.cinzaMedio,
      });
      const valueLines = wrapText(card.value, this.fonts.bold, 11, cardW - 22);
      valueLines.slice(0, 2).forEach((line, li) => {
        this.page.drawText(line, {
          x: x + 12,
          y: y + cardH - 34 - li * 13,
          size: 11,
          font: this.fonts.bold,
          color: card.accent || COLORS.cinzaEscuro,
        });
      });
    });
    this.y -= cardH + 16;
  }

  addChips(items) {
    if (!items.length) {
      this.addParagraph("Nenhuma tecnologia detectada com as assinaturas atuais.", { italic: true, muted: true });
      return;
    }
    const chipH = 20;
    const paddingX = 10;
    const gapX = 8;
    const gapY = 8;
    let cursorX = MARGIN_X;
    this.ensureSpace(chipH + gapY);
    for (const item of items) {
      const label = item.name;
      const textW = this.fonts.bold.widthOfTextAtSize(label, 9);
      const chipW = textW + paddingX * 2;
      if (cursorX + chipW > PAGE_W - MARGIN_X) {
        cursorX = MARGIN_X;
        this.y -= chipH + gapY;
        this.ensureSpace(chipH + gapY);
      }
      const color = item.color || COLORS.tituloVermelho;
      this.page.drawRectangle({
        x: cursorX,
        y: this.y - chipH,
        width: chipW,
        height: chipH,
        color,
        opacity: 0.14,
        borderColor: color,
        borderWidth: 1,
      });
      this.page.drawText(label, {
        x: cursorX + paddingX,
        y: this.y - chipH + 6,
        size: 9,
        font: this.fonts.bold,
        color,
      });
      cursorX += chipW + gapX;
    }
    this.y -= chipH + 18;
  }

  addKeyValueRows(rows) {
    const rowH = 22;
    rows.forEach((row, i) => {
      this.ensureSpace(rowH);
      if (i % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN_X,
          y: this.y - rowH + 6,
          width: PAGE_W - MARGIN_X * 2,
          height: rowH,
          color: COLORS.cinzaClaro,
        });
      }
      this.page.drawText(row.label, {
        x: MARGIN_X + 10,
        y: this.y - rowH + 13,
        size: 9.5,
        font: this.fonts.bold,
        color: COLORS.tituloVermelho,
      });
      const valueLines = wrapText(row.value || "Nao detectado", this.fonts.regular, 9.5, PAGE_W - MARGIN_X * 2 - 190);
      this.page.drawText(valueLines[0], {
        x: MARGIN_X + 190,
        y: this.y - rowH + 13,
        size: 9.5,
        font: this.fonts.regular,
        color: COLORS.cinzaEscuro,
      });
      this.y -= rowH;
    });
    this.y -= 10;
  }

  addParagraph(text, { italic = false, muted = false, size = 9.5 } = {}) {
    const font = italic ? this.fonts.italic : this.fonts.regular;
    const color = muted ? COLORS.cinzaMedio : COLORS.cinzaEscuro;
    const lines = wrapText(text, font, size, PAGE_W - MARGIN_X * 2);
    for (const line of lines) {
      this.ensureSpace(14);
      this.page.drawText(line, { x: MARGIN_X, y: this.y, size, font, color });
      this.y -= 14;
    }
    this.y -= 4;
  }

  addNoteBox(text) {
    const lines = wrapText(text, this.fonts.italic, 8.5, PAGE_W - MARGIN_X * 2 - 24);
    const boxH = lines.length * 12 + 16;
    this.ensureSpace(boxH + 8);
    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - boxH,
      width: PAGE_W - MARGIN_X * 2,
      height: boxH,
      color: COLORS.cinzaClaro,
      borderColor: COLORS.cinzaBorda,
      borderWidth: 0.8,
    });
    lines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN_X + 12,
        y: this.y - 16 - i * 12,
        size: 8.5,
        font: this.fonts.italic,
        color: COLORS.cinzaMedio,
      });
    });
    this.y -= boxH + 10;
  }
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

// Renders the same analyze_company-shaped payload into a Gantech-branded
// PDF and returns the raw bytes (no filesystem write).
export async function buildReportPdfBytes(data, clienteLabel) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const logoImage = fs.existsSync(LOGO_PATH) ? await doc.embedPng(fs.readFileSync(LOGO_PATH)) : null;

  const today = new Date().toLocaleDateString("pt-BR");
  const report = new Report(doc, { regular, bold, italic }, {
    domain: data.domain,
    dateLabel: clienteLabel ? `${clienteLabel} - ${today}` : today,
  }, logoImage);

  const emailProvider = data.inferred_email_provider || "Nao detectado";
  const cloudProvider = data.hosting?.inferred_cloud_provider || data.hosting?.org || "Nao inferido";
  const sslIssuer = data.ssl_certificate?.issuer || "Nao detectado";
  const subCount = typeof data.subdomains?.total_unique_names === "number"
    ? String(data.subdomains.total_unique_names)
    : "Indisponivel";

  report.addCards([
    { label: "Provedor de E-mail", value: emailProvider, accent: COLORS.azulPetroleo },
    { label: "Provedor de Nuvem", value: cloudProvider, accent: COLORS.tituloVermelho },
    { label: "Emissor SSL", value: sslIssuer, accent: COLORS.ciano },
    { label: "Subdominios (CT logs)", value: subCount, accent: COLORS.laranja },
  ]);

  report.addSectionTitle("Tecnologias detectadas no site");
  const techs = data.website_fingerprint?.technologies || [];
  report.addChips(techs.map((t) => ({ name: `${t.name} - ${t.category}`, color: accentForCategory(t.category) })));
  if (data.website_fingerprint?.error) {
    report.addParagraph(`Aviso: fingerprint do site falhou (${data.website_fingerprint.error}).`, { italic: true, muted: true });
  }

  report.addSectionTitle("Registro do dominio (RDAP)");
  report.addKeyValueRows([
    { label: "Registrador", value: data.registration?.registrar },
    { label: "Criado em", value: fmtDate(data.registration?.registered_at) },
    { label: "Expira em", value: fmtDate(data.registration?.expires_at) },
    { label: "Nameservers", value: (data.registration?.nameservers || []).join(", ") },
  ]);

  report.addSectionTitle("Certificado SSL/TLS");
  report.addKeyValueRows([
    { label: "Emissor", value: data.ssl_certificate?.issuer },
    { label: "Sujeito", value: data.ssl_certificate?.subject },
    { label: "Valido de", value: data.ssl_certificate?.valid_from },
    { label: "Valido ate", value: data.ssl_certificate?.valid_to },
    { label: "SANs", value: (data.ssl_certificate?.subject_alt_names || []).join(", ") },
  ]);

  report.addSectionTitle("Hospedagem / Nuvem");
  report.addKeyValueRows([
    { label: "IP", value: data.hosting?.ip },
    { label: "ISP / Organizacao", value: data.hosting?.org || data.hosting?.isp },
    { label: "ASN", value: data.hosting?.asn },
    { label: "Localizacao (IP)", value: [data.hosting?.city, data.hosting?.region, data.hosting?.country].filter(Boolean).join(", ") },
    { label: "Provedor de nuvem inferido", value: data.hosting?.inferred_cloud_provider },
  ]);

  report.addSectionTitle("Subdominios (Certificate Transparency - crt.sh)");
  if (data.subdomains?.error) {
    report.addParagraph(`crt.sh nao respondeu neste momento (${data.subdomains.error}). Este servico publico e conhecido por ser instavel/sobrecarregado; tente novamente mais tarde.`, { italic: true, muted: true });
  } else {
    const subs = data.subdomains?.subdomains || [];
    report.addChips(subs.map((s) => ({ name: s, color: COLORS.azulPetroleo })));
    if (data.subdomains?.truncated) {
      report.addParagraph(`Lista truncada - ${data.subdomains.total_unique_names} subdominios unicos encontrados no total.`, { italic: true, muted: true });
    }
  }

  report.addNoteBox(
    "Relatorio gerado 100% a partir de fontes publicas e gratuitas (DNS, RDAP, certificado TLS, fingerprint HTTP do site, Certificate Transparency logs via crt.sh, geolocalizacao/ASN via ip-api.com). Nao ha estimativa de gasto (spend) em nuvem: essa metrica depende de inferencia estatistica proprietaria (modelo usado por servicos pagos como Intricately) que nao e derivavel de fontes publicas gratuitas com confiabilidade."
  );

  return doc.save();
}
