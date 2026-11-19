import { colourAt, colourProjection, palette, plasma } from "./plasma-field.js";

const csi = "\x1b[";
const beginSync = csi + "?2026h";
const endSync = csi + "?2026l";
const inputColours = csi + "38;5;1;48;5;0m";
const unset = -1;

// The Unicode sextant run omits the empty, full and two vertical half blocks.
const sextants = Array(64);
let codePoint = 0x1fb00;
for (let mask = 0; mask < 64; mask++) {
  switch (mask) {
    case 0: sextants[mask] = " "; break;
    case 21: sextants[mask] = "▌"; break;
    case 42: sextants[mask] = "▐"; break;
    case 63: sextants[mask] = "█"; break;
    default: sextants[mask] = String.fromCodePoint(codePoint++); break;
  }
}
const quadrants = [..." ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█"];
const glyphs = [...sextants, ...quadrants];
const thresholds = [1, 4, 5, 2, 3, 0].map(i => (i + .5) / 6);

export const enterPlasma = csi + "?1049h" + csi + "?25l" + csi + "?7l"
  + palette.map((hex, i) => `\x1b]4;${i};#${hex}\x1b\\`).join("");

function cellPaint(x, y, w, h, t) {
  const { first, second } = colourAt(plasma(x + w * .5, y + h * .5, t));
  let mask = 0;
  let middleBoundary = 0;

  for (let i = 0; i < 6; i++) {
    const subX = x + ((i % 2) + .5) * w / 2;
    const subY = y + (Math.floor(i / 2) + .5) * h / 3;
    const { rgb } = colourAt(plasma(subX, subY, t));
    const mix = colourProjection(rgb, first, second);
    if (mix >= thresholds[i]) mask |= 1 << i;
    if ((i === 2 || i === 3) && Math.abs(mix - thresholds[i]) < .08)
      middleBoundary |= 1 << (i - 2);
  }
  const top = mask & 3, bottom = mask >> 4, middle = (mask >> 2) & 3;
  // At a near-midpoint split, the quadrant's half-cell edge is more precise
  // than committing that uncertain middle sextant to either side.
  const split = top ^ bottom;
  const glyph = split && (split & middleBoundary) === split && !((middle ^ top) & ~split)
    ? 64 + (top | bottom << 2) : mask;
  // Unused foreground is irrelevant for a blank.
  if (glyphs[glyph] === " ") return first;
  return first | second << 4 | glyph << 8;
}

export function createGrid(cols, rows) {
  const painted = new Uint16Array(cols * rows);
  painted.fill(65535); // A cell cannot use all 16 bits.
  let previousEchoRow = unset;
  let previousText = "";

  return (box, t, text) => {
    const w = box.width / cols, h = box.height / rows;
    // Keep the echo in ordinary buffer cells so Puzzle's selection can copy it.
    const echoRow = text ? Math.floor(rows / 2) : unset;
    let penCol = 0, penRow = 0, ink = unset, paper = unset;
    let body = "";
    const move = (col, row) => {
      if (row !== penRow) {
        body += "\r" + csi + (row - penRow) + "B";
        penCol = 0;
        penRow = row;
      }
      if (penCol !== col) {
        body += csi + Math.abs(col - penCol) + (col > penCol ? "C" : "D");
        penCol = col;
      }
    };

    for (let row = 0, i = 0; row < rows; row++) {
      const y = box.y + row * h;
      let redrawEcho = row === echoRow && text !== previousText;
      const clearEcho = row === previousEchoRow && (echoRow !== row || redrawEcho);
      for (let col = 0; col < cols; col++, i++) {
        const paint = cellPaint(box.x + col * w, y, w, h, t);
        if (!clearEcho && paint === painted[i]) continue;
        painted[i] = paint;
        move(col, row);
        const bg = paint & 15, fg = (paint >> 4) & 15, glyph = paint >> 8;
        if (paper !== bg || (glyph !== 0 && ink !== fg)) {
          if (paper !== bg && glyph !== 0 && ink !== fg) {
            body += csi + "38;5;" + fg + ";48;5;" + bg + "m";
            ink = fg;
          } else if (paper !== bg) {
            body += csi + "48;5;" + bg + "m";
          } else {
            body += csi + "38;5;" + fg + "m";
            ink = fg;
          }
          paper = bg;
        }
        body += glyphs[glyph];
        penCol = Math.min(cols - 1, penCol + 1);
        if (row === echoRow) redrawEcho = true;
      }
      if (row === echoRow && redrawEcho) {
        const start = Math.min(2, cols - 1);
        move(start, row);
        body += inputColours + text;
        ink = 1;
        paper = 0;
      }
    }
    previousEchoRow = echoRow;
    previousText = text;
    return body ? beginSync + csi + "H" + body + endSync : "";
  };
}
