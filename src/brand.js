import { rgb } from "pdf-lib";

// Gantech brand tokens — mirrors the palette documented in the
// `apresentacao-gantech` skill (vinho→magenta gradient, red content
// titles, infographic accents). Kept in one place so the whole report
// stays visually consistent with other Gantech-branded deliverables.

function hex(h) {
  const n = h.replace("#", "");
  const r = parseInt(n.substring(0, 2), 16) / 255;
  const g = parseInt(n.substring(2, 4), 16) / 255;
  const b = parseInt(n.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export const COLORS = {
  vinho: hex("EA1F3E"),
  magenta: hex("E82350"),
  tituloVermelho: hex("C00000"),
  ciano: hex("50B9CF"),
  laranja: hex("FF9933"),
  azulPetroleo: hex("20617B"),
  cinzaEscuro: hex("2B2B2B"),
  cinzaMedio: hex("6B6B6B"),
  cinzaClaro: hex("F2F2F2"),
  cinzaBorda: hex("DDDDDD"),
  branco: rgb(1, 1, 1),
};

// Cycled accent used to color technology category chips.
export const CATEGORY_ACCENTS = [
  COLORS.tituloVermelho,
  COLORS.ciano,
  COLORS.laranja,
  COLORS.azulPetroleo,
];

export function accentForCategory(category) {
  let hashCode = 0;
  for (let i = 0; i < category.length; i++) {
    hashCode = (hashCode * 31 + category.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_ACCENTS[hashCode % CATEGORY_ACCENTS.length];
}

// Linear-interpolated multi-band fill to approximate the vinho→magenta
// gradient (pdf-lib has no native gradient fill).
export function drawGradientRect(page, { x, y, width, height, from, to, steps = 24, horizontal = true }) {
  const bandSize = (horizontal ? width : height) / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = rgb(
      from.red + (to.red - from.red) * t,
      from.green + (to.green - from.green) * t,
      from.blue + (to.blue - from.blue) * t
    );
    if (horizontal) {
      page.drawRectangle({ x: x + i * bandSize, y, width: bandSize + 0.5, height, color });
    } else {
      page.drawRectangle({ x, y: y + i * bandSize, width, height: bandSize + 0.5, color });
    }
  }
}
