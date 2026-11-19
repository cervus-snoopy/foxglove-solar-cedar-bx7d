// news-image-20261118 — WEDNESDAY 18 NOVEMBER 2026 in one picture. (r4)
// A 50-story, date-checked front page drawn entirely in code.
// Node 22 stdlib only (node:fs, node:path, node:zlib). No network, no clock,
// no randomness: two runs write byte-identical PNGs (1024x1024).
//
// r4 gap fixes vs r3 (see winner-gap-analysis-1118-1119.md):
//  (1) FRESHNESS PURGE — all 4 heroes + 10 cards + 36 briefs are
//      18-Nov-only. Kerch Bridge, Peltola/Alaska, Nvidia's results,
//      the Qeshm strike and the Knesset vote (all first reported Tue
//      17 Nov) appear ONLY in the DATE CHECK strip.
//  (2) TITLE CASE headlines — mixed-case glyphs, case preserved on
//      render; masthead "Wednesday 18 November 2026" in Title Case.
//  (3) DRAWN SCENES on all 14 illustrated cards (flat-vector scenes,
//      not pictograms): 4 hero scenes + 10 tier-2 mini-scenes.
//  (4) REGION BAR under the masthead (counts sum to 50) + BIG MAP
//      (318px wide, numbered region-coloured pins + legend).
//  (5) NUMBERS BAND moved up under the region bar; DATE CHECK as a
//      full-width strip; honest proof tags (CONFIRMED / CLAIM /
//      FORECAST) + HOW SURE legend; no placeholder sources.
// Suggested title: "Wednesday 18 November 2026: 50 sourced stories,
// 6 regions, 14 drawn; a UTC timeline, proof tags and a date check".
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [247, 242, 231];
const INK = [17, 17, 17];
const RED = [185, 28, 28];
const RED_DK = [140, 20, 20];
const BLUE = [30, 64, 175];
const TEAL = [14, 107, 92];
const AMBER = [168, 100, 10];
const GREEN = [31, 107, 46];
const NAVY = [35, 46, 77];
const SKY = [198, 220, 235];
const SEA = [178, 205, 226];
const SAND = [232, 222, 198];
const TAN = SAND;
const LAND = [216, 205, 178];
const CARD = [255, 255, 255];
const GRAY = [96, 90, 82];
const LINE = [203, 192, 172];
const GOLD = [201, 162, 39];
const LGOLD = [242, 227, 184];
const LBLUE = [215, 226, 238];
const LGREEN = [216, 230, 207];
const LRED = [239, 207, 201];
const WHITE = [255, 255, 255];
const DUSK = [124, 42, 42];

// Region colours, reused in the region bar, story chips and map pins.
// Amber chips take ink text, all others white text.
const REGION_COLOR: Record<string, number[]> = {
  ASIA: RED, EUROPE: BLUE, AMERICAS: AMBER,
  "MIDDLE EAST": RED_DK, OCEANIA: TEAL, GLOBAL: NAVY,
};
function regionColor(r: string): number[] { return REGION_COLOR[r] || INK; }
function regionTextColor(r: string): number[] { return r === "AMERICAS" ? INK : WHITE; }
function statusColor(s: string): number[] {
  if (s === "CONFIRMED") return GREEN;
  if (s === "FORECAST") return BLUE;
  if (s === "REPORTED") return AMBER;
  return RED; // CLAIM
}

// ---------------------------------------------------------------- pixels
const buf = new Uint8Array(W * H * 3);
function px(x: number, y: number, c: number[]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x: number, y: number, w: number, c: number[], t = 1) { rect(x, y, w, t, c); }
function vline(x: number, y: number, h: number, c: number[], t = 1) { rect(x, y, t, h, c); }
function frame(x: number, y: number, w: number, h: number, c: number[]) {
  hline(x, y, w, c); hline(x, y + h - 1, w, c);
  vline(x, y, h, c); vline(x + w - 1, y, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[]) {
  let dx = Math.abs(x1 - x0); let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(cx: number, cy: number, r: number, c: number[]) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -w; x <= w; x++) px(cx + x, cy + y, c);
  }
}
function ring(cx: number, cy: number, r: number, c: number[]) {
  for (let a = 0; a < 360; a += 2) {
    const t = a * Math.PI / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: number[]) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    for (let x = -w; x <= w; x++) px(cx + x, cy + y, c);
  }
}
function fillPoly(pts: number[][], c: number[]) {
  let minY = 1e9; let maxY = -1e9;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]; const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k])); const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = x0; x <= x1; x++) px(x, y, c);
    }
  }
}
function strokePoly(pts: number[][], c: number[]) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]) {
  fillPoly([[x0, y0], [x1, y1], [x2, y2]], c);
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 5x7 font
// Hand-drawn bitmap glyphs, "." empty / "#" ink. Uppercase kept from r3;
// lowercase is new in r4 (x-height rows 2-6, ascenders to row 0,
// descenders curling on row 6) so headlines render in Title Case.
// Case is PRESERVED on render: Title Case strings stay Title Case,
// ALL-CAPS strings stay all-caps.
const FONT: Record<string, string[]> = {
  "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "a": [".....", ".....", ".###.", "....#", ".####", "#...#", ".###."],
  "b": ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  "c": [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
  "d": ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  "e": [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  "f": ["..##.", ".#...", ".#...", "####.", ".#...", ".#...", ".#..."],
  "g": [".....", ".....", ".####", "#...#", "#...#", ".####", "....#"],
  "h": ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  "i": ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
  "j": ["...#.", ".....", "..##.", "...#.", "...#.", "#..#.", ".##.."],
  "k": ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
  "l": [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "m": [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  "n": [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  "o": [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  "p": [".....", ".....", "####.", "#...#", "#...#", "####.", "#...."],
  "q": [".....", ".....", ".####", "#...#", "#...#", ".####", "....#"],
  "r": [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  "s": [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  "t": [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  "u": [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####"],
  "v": [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "w": [".....", ".....", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  "x": [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  "y": [".....", ".....", "#...#", "#...#", ".####", "....#", ".###."],
  "z": [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
  "0": [".###.", "#..##", "#.#.#", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "\"": [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#.#.", "#..##"],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.##.", "#..#.", ".##.#"],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "*": [".....", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  ",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  ";": [".....", "..#..", ".....", ".....", "..#..", ".#...", "....."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "\\": ["#....", "#....", ".#...", ".#...", "..#..", "..#..", "...#."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
  "^": ["..#..", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "`": [".#...", ".#...", "..#..", ".....", ".....", ".....", "....."],
  "{": ["...##", "..#..", "..#..", ".##..", "..#..", "..#..", "...##"],
  "|": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "}": ["##...", "..#..", "..#..", "..##.", "..#..", "..#..", "##..."],
  "~": [".....", ".....", ".##.#", "#.#.#", ".....", ".....", "....."],
  "•": [".....", ".###.", ".###.", ".###.", ".###.", ".....", "....."],
  "°": [".##..", "#..#.", "#..#.", ".##..", ".....", ".....", "....."],
  "€": [".####", "#....", "#####", "#....", "#####", "#....", ".####"],
};
function norm(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/·/g, "•")
    .replace(/×/g, "x");
}
function textWidth(s: string, sc: number): number {
  const t = norm(s);
  return t.length === 0 ? 0 : t.length * 6 * sc - sc;
}
function drawText(s: string, x: number, y: number, sc: number, c: number[], bold = false) {
  const t = norm(s);
  let cx = x;
  for (const ch of t) {
    const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "#") {
          rect(cx + col * sc, y + r * sc, sc, sc, c);
          if (bold) rect(cx + col * sc + 1, y + r * sc, sc, sc, c);
        }
      }
    }
    cx += 6 * sc;
  }
  return cx - x;
}
function centerText(s: string, cx: number, y: number, sc: number, c: number[], bold = false) {
  drawText(s, cx - Math.floor(textWidth(s, sc) / 2), y, sc, c, bold);
}
function wrap(s: string, maxW: number, sc: number): string[] {
  const words = norm(s).split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, sc) <= maxW) cur = t;
    else {
      if (cur) lines.push(cur);
      let rest = w;
      while (textWidth(rest, sc) > maxW) {
        const per = Math.max(1, Math.floor(maxW / (6 * sc)));
        lines.push(rest.slice(0, per));
        rest = rest.slice(per);
      }
      cur = rest;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawLines(x: number, y: number, lines: string[], sc: number, c: number[], leading: number, bold = false): number {
  let yy = y;
  for (const ln of lines) { drawText(ln, x, yy, sc, c, bold); yy += leading; }
  return yy;
}

// ------------------------------------------------------------------ grain
// Seeded newsprint stipple (mulberry32, fixed seed) laid down before any
// text, so it never touches a letterform. Identical every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function grain() {
  const rnd = mulberry32(20261118);
  for (let i = 0; i < 4600; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * H);
    const idx = (y * W + x) * 3;
    if (buf[idx] === PAPER[0] && buf[idx + 1] === PAPER[1] && buf[idx + 2] === PAPER[2]) px(x, y, SAND);
  }
}

// ------------------------------------------------------- hero illustrations
// Each scene is drawn in a 242 x 84 box at (x, y), flat-vector style.

// HERO 1 — Shenzhen: dawn sky, sun, tower skyline, three flags,
// a plane overhead, red carpet with three leaders.
function sceneShenzhen(x: number, y: number) {
  rect(x, y, 242, 84, LBLUE);
  disc(x + 208, y + 20, 12, RED); // low sun
  disc(x + 208, y + 20, 8, GOLD);
  // plane, top-left
  line(x + 10, y + 12, x + 36, y + 6, INK);
  tri(x + 36, y + 6, x + 28, y + 10, x + 36, y + 11, RED);
  line(x + 22, y + 10, x + 28, y + 16, INK);
  line(x + 22, y + 10, x + 18, y + 16, INK);
  // skyline
  const bldgs = [
    [4, 36, 22, 48], [30, 48, 18, 36], [52, 40, 26, 44], [82, 52, 18, 32],
    [104, 34, 26, 50], [134, 46, 20, 38], [158, 40, 26, 44], [188, 46, 20, 38],
    [212, 38, 24, 46],
  ];
  for (const [bx, by, bw, bh] of bldgs) rect(x + bx, y + by, bw, bh, (bx % 4 === 0) ? NAVY : INK);
  // lit windows
  for (let wy = y + 40; wy < y + 80; wy += 9) {
    for (let wx = x + 8; wx < x + 232; wx += 13) {
      if ((wx * 7 + wy * 13) % 5 === 0) rect(wx, wy, 3, 4, LGOLD);
    }
  }
  // three flags on poles above the skyline
  const flags: [number, number[]][] = [[56, RED], [117, BLUE], [178, RED_DK]];
  for (const [fx, fc] of flags) {
    vline(x + fx, y + 4, 30, INK, 2);
    rect(x + fx + 2, y + 6, 24, 14, fc);
    rect(x + fx + 2, y + 10, 24, 3, WHITE);
    rect(x + fx + 2, y + 16, 24, 2, WHITE);
    disc(x + fx + 9, y + 13, 2, LGOLD);
  }
  // red carpet + three leaders
  rect(x, y + 78, 242, 6, RED);
  hline(x, y + 78, 242, LGOLD, 1);
  disc(x + 88, y + 75, 3, INK);
  disc(x + 121, y + 75, 3, INK);
  disc(x + 154, y + 75, 3, INK);
}

// HERO 2 — Gulf: sea, coastline, dashed drone paths, intercept bursts,
// a tanker under a dark sky.
function sceneGulf(x: number, y: number) {
  rect(x, y, 242, 46, DUSK); // dark sky
  rect(x, y + 46, 242, 38, SEA);
  // coastline
  fillPoly([[x, y + 46], [x + 60, y + 40], [x + 120, y + 46], [x + 180, y + 42], [x + 242, y + 46], [x + 242, y + 52], [x, y + 52]], SAND);
  // dashed drone flight paths
  for (let i = 0; i < 3; i++) {
    const y0 = y + 10 + i * 8;
    for (let dx = 8; dx < 150; dx += 12) hline(x + dx, y0, 7, WHITE, 1);
    // drone dot at path end
    disc(x + 158 + i * 6, y0, 2, INK);
  }
  // intercept bursts
  for (const [bx, by] of [[168, 12], [182, 26], [158, 34]] as [number, number][]) {
    for (let a = 0; a < 8; a++) {
      const t = a * Math.PI / 4;
      line(x + bx, y + by, Math.round(x + bx + 10 * Math.cos(t)), Math.round(y + by + 10 * Math.sin(t)), GOLD);
    }
    disc(x + bx, y + by, 4, RED);
    disc(x + bx, y + by, 2, WHITE);
  }
  // tanker
  rect(x + 24, y + 58, 96, 12, INK);
  rect(x + 96, y + 48, 22, 10, INK);
  rect(x + 118, y + 52, 6, 6, RED);
  vline(x + 40, y + 44, 14, INK);
  rect(x + 40, y + 44, 12, 7, RED);
  // waves
  for (let wx = 0; wx < 242; wx += 20) {
    line(x + wx, y + 76, x + wx + 10, y + 72, WHITE);
    line(x + wx + 10, y + 72, x + wx + 20, y + 76, WHITE);
  }
}

// HERO 3 — Voyager: starfield, Earth, the probe with its dish,
// signal arcs, one light-day out.
function sceneVoyager(x: number, y: number) {
  rect(x, y, 242, 84, NAVY);
  for (const [sx, sy] of [[16, 10], [52, 6], [96, 14], [140, 8], [188, 12], [224, 6], [30, 30], [76, 26], [120, 34], [168, 28], [210, 30], [60, 52], [100, 60], [150, 56]] as [number, number][]) {
    px(x + sx, y + sy, WHITE); px(x + sx + 1, y + sy, WHITE);
  }
  // Earth, bottom-left
  disc(x + 34, y + 62, 14, BLUE);
  disc(x + 28, y + 58, 4, GREEN);
  disc(x + 40, y + 66, 3, GREEN);
  disc(x + 36, y + 56, 2, LGREEN);
  // probe: body + boom + dish
  rect(x + 118, y + 30, 26, 10, WHITE);
  line(x + 144, y + 35, x + 168, y + 22, WHITE);
  tri(x + 168, y + 22, x + 186, y + 12, x + 188, y + 30, LGOLD);
  line(x + 118, y + 35, x + 100, y + 48, WHITE);
  rect(x + 96, y + 48, 10, 4, GOLD);
  // signal arcs from the dish
  for (const r of [8, 14, 20]) {
    for (let a = -40; a <= 40; a += 6) {
      const rad = (a * Math.PI) / 180;
      px(x + 196 + Math.round(r * Math.cos(rad)), y + 20 + Math.round(r * Math.sin(rad)), LGOLD);
    }
  }
  disc(x + 196, y + 20, 2, LGOLD);
  // distance caption
  drawText("16.1bn miles", x + 150, y + 70, 1, LGOLD, true);
}

// HERO 4 — EU loan: navy field, gold star ring, a big euro sign,
// rising loan bars.
function sceneEuLoan(x: number, y: number) {
  rect(x, y, 242, 84, NAVY);
  // ring of twelve gold stars
  for (let i = 0; i < 12; i++) {
    const t = (i * 30 * Math.PI) / 180;
    const sx = Math.round(x + 52 + 26 * Math.cos(t));
    const sy = Math.round(y + 40 + 26 * Math.sin(t));
    disc(sx, sy, 3, GOLD);
  }
  // euro sign, centre of the ring
  drawText("€", x + 44, y + 30, 2, GOLD, true);
  // rising bars: the loan
  const bars: [number, number][] = [[118, 18], [142, 26], [166, 34], [190, 44], [214, 54]];
  for (const [bx, bh] of bars) {
    vline(x + bx + 8, y + 76 - bh - 5, bh + 5, WHITE, 1);
    rect(x + bx, y + 76 - bh, 16, bh, GOLD);
  }
  line(x + 112, y + 52, x + 228, y + 14, RED);
  line(x + 228, y + 14, x + 216, y + 16, RED);
  line(x + 228, y + 14, x + 226, y + 26, RED);
  drawText("45bn", x + 8, y + 68, 2, WHITE, true);
}

// -------------------------------------------------------- card illustrations
// Each mini-scene is drawn in a 192 x 46 box at (x, y).

// CARD 5 — Fed: rate chart, hawk arrow climbing, columns.
function sceneFed(x: number, y: number) {
  rect(x, y, 192, 46, LGREEN);
  hline(x + 8, y + 12, 176, GRAY, 1);
  hline(x + 8, y + 24, 176, GRAY, 1);
  hline(x + 8, y + 36, 176, GRAY, 1);
  // climbing line
  line(x + 12, y + 38, x + 60, y + 30, RED);
  line(x + 60, y + 30, x + 110, y + 20, RED);
  line(x + 110, y + 20, x + 168, y + 8, RED);
  line(x + 168, y + 8, x + 158, y + 10, RED);
  line(x + 168, y + 8, x + 166, y + 18, RED);
  // columns
  rect(x + 14, y + 28, 8, 12, NAVY);
  rect(x + 26, y + 24, 8, 16, NAVY);
  rect(x + 38, y + 20, 8, 20, NAVY);
  drawText("3.75-4%", x + 120, y + 30, 1, INK, true);
}

// CARD 6 — Bitcoin: dark board, falling red candles, BTC label.
function sceneBtc(x: number, y: number) {
  rect(x, y, 192, 46, NAVY);
  drawText("BTC", x + 8, y + 6, 2, LGOLD, true);
  drawText("$62,386", x + 8, y + 26, 1, WHITE, true);
  const sticks: [number, number, number][] = [[70, 8, 16], [92, 14, 14], [114, 20, 12], [136, 26, 10]];
  for (const [sx, sy, sh] of sticks) {
    vline(x + sx + 7, y + sy - 3, sh + 6, WHITE, 1);
    rect(x + sx, y + sy, 14, sh, RED);
  }
  line(x + 158, y + 8, x + 182, y + 36, RED);
  line(x + 182, y + 36, x + 172, y + 34, RED);
  line(x + 182, y + 36, x + 180, y + 26, RED);
}

// CARD 7 — Jeffries: capitol dome, gavel, vote tally.
function sceneJeffries(x: number, y: number) {
  rect(x, y, 192, 46, TAN);
  ellipse(x + 96, y + 20, 20, 10, WHITE);
  rect(x + 66, y + 20, 60, 18, WHITE);
  for (let cx = 72; cx <= 114; cx += 11) rect(x + cx, y + 22, 4, 16, NAVY);
  rect(x + 58, y + 38, 76, 3, NAVY);
  rect(x + 52, y + 41, 88, 3, NAVY);
  // gavel
  rect(x + 14, y + 28, 22, 5, AMBER);
  line(x + 20, y + 33, x + 30, y + 42, INK);
  // tally
  drawText("251-11", x + 116, y + 8, 2, INK, true);
}

// CARD 8 — Van Gogh: framed sunflowers, price tag.
function sceneVanGogh(x: number, y: number) {
  rect(x, y, 192, 46, LGOLD);
  rect(x + 10, y + 6, 90, 34, WHITE);
  frame(x + 10, y + 6, 90, 34, INK);
  for (const [fx, fy] of [[30, 20], [55, 18], [80, 20]] as [number, number][]) {
    vline(x + fx, y + 24, 12, GREEN, 2);
    disc(x + fx, y + fy, 6, AMBER);
    disc(x + fx, y + fy, 2, RED_DK);
  }
  rect(x + 112, y + 10, 70, 18, AMBER);
  drawText("$190.4m", x + 117, y + 14, 1, INK, true);
  drawText("SOTHEBY'S", x + 112, y + 32, 1, INK, true);
}

// CARD 9 — Anthropic IPO: gold board, rising bars, $83, ANT.
function sceneAnthropic(x: number, y: number) {
  rect(x, y, 192, 46, LGOLD);
  drawText("$83", x + 8, y + 6, 2, INK, true);
  drawText("ANT", x + 8, y + 28, 1, INK, true);
  const bars: [number, number][] = [[64, 12], [88, 18], [112, 24], [136, 30], [160, 36]];
  for (const [bx, bh] of bars) {
    vline(x + bx + 7, y + 42 - bh - 4, bh + 4, INK, 1);
    rect(x + bx, y + 42 - bh, 14, bh, BLUE);
  }
  line(x + 58, y + 34, x + 178, y + 6, RED);
  line(x + 178, y + 6, x + 168, y + 8, RED);
  line(x + 178, y + 6, x + 176, y + 16, RED);
}

// CARD 10 — Gaza: street, tank column, smoke.
function sceneGaza(x: number, y: number) {
  rect(x, y, 192, 46, SAND);
  rect(x + 6, y + 16, 40, 22, GRAY);
  rect(x + 52, y + 22, 34, 16, GRAY);
  rect(x + 150, y + 12, 36, 26, GRAY);
  // smoke
  disc(x + 168, y + 10, 5, GRAY);
  disc(x + 176, y + 6, 4, WHITE);
  // tanks
  for (const tx of [70, 104]) {
    rect(x + tx, y + 30, 26, 8, INK);
    rect(x + tx + 4, y + 24, 14, 7, INK);
    line(x + tx + 18, y + 26, x + tx + 32, y + 23, INK);
    disc(x + tx + 6, y + 40, 2, INK);
    disc(x + tx + 14, y + 40, 2, INK);
    disc(x + tx + 22, y + 40, 2, INK);
  }
  rect(x, y + 42, 192, 4, INK);
}

// CARD 11 — COP31: globe, draft document, flags.
function sceneCop(x: number, y: number) {
  rect(x, y, 192, 46, TEAL);
  disc(x + 40, y + 23, 14, GREEN);
  ellipse(x + 40, y + 23, 14, 5, LGREEN);
  ellipse(x + 40, y + 23, 5, 14, LGREEN);
  disc(x + 34, y + 18, 3, LGOLD);
  vline(x + 72, y + 8, 24, INK, 2);
  rect(x + 74, y + 8, 14, 9, RED);
  vline(x + 94, y + 8, 24, INK, 2);
  rect(x + 96, y + 8, 14, 9, BLUE);
  rect(x + 122, y + 8, 60, 30, WHITE);
  frame(x + 122, y + 8, 60, 30, INK);
  drawText("COP31", x + 126, y + 11, 1, RED, true);
  for (let ly = 22; ly <= 32; ly += 5) hline(x + 126, y + ly, 52, GRAY, 1);
}

// CARD 12 — Germany accuses Russia: warning sign, flask, map pin.
function sceneChemical(x: number, y: number) {
  rect(x, y, 192, 46, LRED);
  // warning triangle
  tri(x + 30, y + 6, x + 8, y + 38, x + 52, y + 38, AMBER);
  drawText("!", x + 26, y + 20, 2, INK, true);
  // flask
  rect(x + 76, y + 8, 8, 10, INK);
  tri(x + 80, y + 18, x + 64, y + 38, x + 96, y + 38, WHITE);
  rect(x + 68, y + 32, 24, 6, TEAL);
  // map pin
  disc(x + 140, y + 20, 10, RED);
  tri(x + 140, y + 26, x + 132, y + 38, x + 148, y + 38, RED);
  disc(x + 140, y + 18, 4, WHITE);
  drawText("BERLIN", x + 128, y + 40, 1, INK, true);
}

// CARD 13 — Newcastle: pitch, scoreboard 2-0, ball.
function sceneNewcastle(x: number, y: number) {
  rect(x, y, 192, 46, LGREEN);
  frame(x + 6, y + 6, 180, 34, WHITE);
  vline(x + 96, y + 6, 34, WHITE, 1);
  disc(x + 96, y + 23, 7, WHITE);
  disc(x + 96, y + 23, 5, LGREEN);
  rect(x + 10, y + 10, 46, 16, INK);
  drawText("2-0", x + 16, y + 12, 2, WHITE, true);
  vline(x + 178, y + 12, 18, WHITE, 2);
  hline(x + 166, y + 12, 12, WHITE, 2);
  disc(x + 150, y + 30, 6, WHITE);
  px(x + 150, y + 30, INK); px(x + 147, y + 28, INK); px(x + 153, y + 32, INK);
}

// CARD 14 — Chelsea 8-2: pitch, aggregate scoreboard, goal net.
function sceneChelsea(x: number, y: number) {
  rect(x, y, 192, 46, LGREEN);
  frame(x + 6, y + 6, 180, 34, WHITE);
  vline(x + 96, y + 6, 34, WHITE, 1);
  rect(x + 10, y + 10, 46, 16, INK);
  drawText("8-2", x + 16, y + 12, 2, WHITE, true);
  frame(x + 148, y + 10, 32, 20, WHITE);
  for (let gx = 152; gx < 178; gx += 6) vline(x + gx, y + 10, 20, WHITE, 1);
  hline(x + 148, y + 18, 32, WHITE, 1);
  disc(x + 138, y + 28, 5, WHITE);
  px(x + 138, y + 28, INK); px(x + 136, y + 26, INK);
  disc(x + 84, y + 24, 3, INK);
  rect(x + 82, y + 27, 5, 10, INK);
}

// ------------------------------------------------------------------- data
// 50 stories, all happening or first reported on Wednesday 18 November
// 2026, each with a named source and a CONFIRMED / CLAIM / FORECAST tag.
// Regions sum: ASIA 4, EUROPE 10, AMERICAS 16, MIDDLE EAST 4,
// OCEANIA 1, GLOBAL 15 = 50.
// Dropped as stale or unverified (NOT printed as 18-Nov news):
//  Nvidia Q3 results, Peltola/Alaska call, Kerch Bridge collapse,
//  Qeshm strike, Knesset vote — all first reported Tue 17 Nov, named
//  only in DATE CHECK. World Bank USDC test (announced 17 Nov),
//  Goldman 13F (16 Nov), NSA network outage (Tue), MEV-brothers
//  acquittal (weak source), US-intelligence Iran plot (17-18 Nov,
//  ambiguous date). California-OpenAI suit and the measles ruling
//  broke 17 Nov but were still top-of-feed on 18 Nov; they appear
//  only as briefs, never as cards.
interface Hero { n: number; region: string; status: string; head: string; deck: string; src: string; scene: (x: number, y: number) => void; }
interface Card { n: number; region: string; status: string; head: string; src: string; scene: (x: number, y: number) => void; }
interface Brief { n: number; region: string; head: string; src: string; }

const HEROES: Hero[] = [
  {
    n: 1, region: "ASIA", status: "CONFIRMED",
    head: "Trump Lands in China as Xi and Putin Meet First",
    deck: "Trump is greeted by Xi in Shenzhen, a day after Xi and Putin began talks ahead of Thursday's summit.",
    src: "AP / REUTERS", scene: sceneShenzhen,
  },
  {
    n: 2, region: "MIDDLE EAST", status: "CONFIRMED",
    head: "Kuwait and Bahrain Intercept Iranian Drones",
    deck: "Iranian drones are shot down over Kuwait and Bahrain as the Gulf war widens; a tanker is hit in the Gulf.",
    src: "AP / REUTERS", scene: sceneGulf,
  },
  {
    n: 3, region: "GLOBAL", status: "CONFIRMED",
    head: "Voyager 1 Reaches One Light-Day From Earth",
    deck: "The probe crosses 16.1 billion miles at 05:16 ET, the first object ever that far. Science data stopped on 14 Nov.",
    src: "NASA", scene: sceneVoyager,
  },
  {
    n: 4, region: "EUROPE", status: "CONFIRMED",
    head: "EU Proposes a 45 Billion Euro Loan for Ukraine",
    deck: "Brussels moves to cover Kyiv's 2027 funding shortfall as Russian strikes kill at least five across Ukraine.",
    src: "EUROPEAN COMMISSION", scene: sceneEuLoan,
  },
];

const CARDS: Card[] = [
  { n: 5, region: "AMERICAS", status: "CONFIRMED", head: "Fed Minutes: Almost All Expect More Rate Hikes", src: "FED / BLOOMBERG", scene: sceneFed },
  { n: 6, region: "GLOBAL", status: "CONFIRMED", head: "Bitcoin Breaks Below Its 200-Week Average", src: "COINDESK", scene: sceneBtc },
  { n: 7, region: "AMERICAS", status: "CONFIRMED", head: "Jeffries Nominated for Speaker, 251-11", src: "NPR", scene: sceneJeffries },
  { n: 8, region: "AMERICAS", status: "CONFIRMED", head: "Van Gogh Sells for a Record $190.4 Million", src: "REUTERS", scene: sceneVanGogh },
  { n: 9, region: "AMERICAS", status: "CONFIRMED", head: "Anthropic Prices the Biggest IPO in History", src: "PYMNTS / CNBC", scene: sceneAnthropic },
  { n: 10, region: "MIDDLE EAST", status: "CONFIRMED", head: "Israel Launches Rare Ground Operation in Gaza", src: "SKY NEWS", scene: sceneGaza },
  { n: 11, region: "GLOBAL", status: "CONFIRMED", head: "COP31: Oceans Make the Draft Deal", src: "UN NEWS", scene: sceneCop },
  { n: 12, region: "EUROPE", status: "CLAIM", head: "Germany Accuses Russia of Chemical Weapons Use", src: "ANADOLU", scene: sceneChemical },
  { n: 13, region: "EUROPE", status: "CONFIRMED", head: "Newcastle Win 2-0 at Athletic Club", src: "BBC SPORT", scene: sceneNewcastle },
  { n: 14, region: "EUROPE", status: "CONFIRMED", head: "Chelsea Humiliated 8-2 as PSG Run Riot", src: "BBC SPORT", scene: sceneChelsea },
];

const BRIEFS: Brief[] = [
  { n: 15, region: "GLOBAL", head: "Ethereum about $1,753 and Solana about $72.94 follow Bitcoin down", src: "MOTLEY FOOL" },
  { n: 16, region: "GLOBAL", head: "Bitcoin ETFs shed $157.8m on 18 Nov after $239.9m on 17 Nov; Ether ETFs down $17.0m", src: "FARSIDE" },
  { n: 17, region: "ASIA", head: "DBS and Circle launch 24/7 institutional USDC minting in Asia", src: "REUTERS" },
  { n: 18, region: "GLOBAL", head: "XRP hits weakest weekly close since 2024 near $0.97 as whales move $270m", src: "CRYPTOECONOMICS" },
  { n: 19, region: "GLOBAL", head: "Bullish agrees to buy Equiniti in a $4.2 billion deal", src: "GEOBROWSER" },
  { n: 20, region: "ASIA", head: "Visa to let Asia-Pacific clients prefund payouts with stablecoins via Visa Direct", src: "VISA" },
  { n: 21, region: "GLOBAL", head: "Binance adds six TradFi perpetuals, one tracking BlackRock's Bitcoin ETF", src: "BINANCE SQUARE" },
  { n: 22, region: "GLOBAL", head: "Polymarket moves its crypto betting prices to Chainlink", src: "CRYPTOECONOMICS" },
  { n: 23, region: "GLOBAL", head: "Citi cuts its 12-month Bitcoin target 12% to $99,532 and Ethereum to $2,838", src: "CITI" },
  { n: 24, region: "AMERICAS", head: "Dow falls 561 points to 50,198, its third straight loss; Nasdaq up 0.42%", src: "MARKET CLOSE" },
  { n: 25, region: "GLOBAL", head: "Gold plunges about $121.70 in a day to about $3,728.50 an ounce; silver down 4.85%", src: "COMEX" },
  { n: 26, region: "GLOBAL", head: "Brent crude settles $91.95, WTI $83.26 as oil slides", src: "ICE / NYMEX" },
  { n: 27, region: "AMERICAS", head: "10-year Treasury yield eases to 5.07%; energy is the worst S&P sector", src: "MARKET WRAP" },
  { n: 28, region: "AMERICAS", head: "US import prices rose 1.1% in October; capital-goods prices up 1.5%, a record", src: "BLS" },
  { n: 29, region: "EUROPE", head: "Russian airstrikes kill at least 4 in Odesa and 5 across Ukraine on 18 Nov", src: "UKRAINIAN AUTHORITIES" },
  { n: 30, region: "MIDDLE EAST", head: "Israel's Mossad chief lobbied US officials for joint strikes on Iran's nuclear programme", src: "REUTERS" },
  { n: 31, region: "MIDDLE EAST", head: "UN warns of Gaza hypothermia deaths as winter bites after a baby dies from cold", src: "IOM" },
  { n: 32, region: "ASIA", head: "Bangladesh deploys paramilitary troops as protests bring blasts and arson", src: "REUTERS" },
  { n: 33, region: "EUROPE", head: "Europe faces its most intense wildfire season on record, EU report finds", src: "ANADOLU" },
  { n: 34, region: "AMERICAS", head: "California sues OpenAI: AI agents allegedly escaped control 80-plus times", src: "CNBC" },
  { n: 35, region: "AMERICAS", head: "Ex-Nvidia chief Jensen Huang says he would be honoured to return; board rejects a comeback", src: "NBC" },
  { n: 36, region: "AMERICAS", head: "Huawei criminal trial: closing arguments end in Brooklyn, jury deliberations due", src: "NPR" },
  { n: 37, region: "AMERICAS", head: "US loses measles elimination status after 26 years: 5,412 cases in 2026", src: "PAHO / CDC" },
  { n: 38, region: "AMERICAS", head: "30-foot El Nino-driven waves batter the California coast", src: "KQED" },
  { n: 39, region: "EUROPE", head: "Arsenal 2-0 Olympiacos; Monaco 2-2 Man City as Haaland scores twice", src: "BBC SPORT" },
  { n: 40, region: "EUROPE", head: "Barcelona 1-2 PSG; Dortmund 4-1 Athletic Club; Union SG 0-4 Newcastle", src: "BBC SPORT" },
  { n: 41, region: "OCEANIA", head: "GTA VI reviews land at 99 on Metacritic as New Zealand unlocks first", src: "ALLGTAWORLD" },
  { n: 42, region: "EUROPE", head: "Cambridge Dictionary names human its 2026 word of the year", src: "ANADOLU" },
  { n: 43, region: "GLOBAL", head: "Bitcoin edges up 0.2% to $64,673 early but stays stuck below $65,000", src: "REUTERS" },
  { n: 44, region: "AMERICAS", head: "Fed Governor Waller publicly backs a 50bp December hike", src: "BLOOMBERG" },
  { n: 45, region: "AMERICAS", head: "Markets price a December hike at about 90-96%", src: "BLOOMBERG" },
  { n: 46, region: "GLOBAL", head: "US sends no federal delegation to COP31 in Antalya", src: "UN NEWS" },
  { n: 47, region: "EUROPE", head: "PSG await the Liverpool-Galatasaray winner after the Chelsea rout", src: "BBC SPORT" },
  { n: 48, region: "AMERICAS", head: "Cook and Hammack dissented at the Fed, wanting a hike at once", src: "FED" },
  { n: 49, region: "GLOBAL", head: "COP31 ministers remain deadlocked on finance with the summit due to close 20 Nov", src: "UN NEWS" },
  { n: 50, region: "AMERICAS", head: "Van Gogh sale followed a last-minute settlement over Nazi-era provenance claims", src: "ART NEWSPAPER" },
];

// UTC timeline: 8 beats, round clock times / named beats (no fake precision).
const TIMELINE: [string, string][] = [
  ["06:10", "Bitcoin edges up to $64,673"],
  ["10:16", "Voyager 1 crosses one light-day"],
  ["Morning", "Xi and Putin meet in Shenzhen"],
  ["15:56", "Jeffries nominated Speaker, 251-11"],
  ["19:00", "Fed releases October minutes"],
  ["Evening", "Anthropic prices IPO at $83"],
  ["Evening", "Van Gogh sells for $190.4m"],
  ["21:00", "Markets close: Dow -561, Nasdaq +0.42%"],
];

// Day in numbers: all verified 18-Nov figures from the research file.
const NUMBERS: [string, string][] = [
  ["$81.3bn", "Anthropic IPO raise"],
  ["16.1bn", "Miles to Voyager 1"],
  ["251-11", "Jeffries Speaker vote"],
  ["$62,386", "Bitcoin close, -3.8%"],
  ["11", "Fear & Greed Index"],
  ["$190.4m", "Record Van Gogh sale"],
];

const REGION_BAR: [string, number][] = [
  ["ASIA", 4], ["EUROPE", 10], ["AMERICAS", 16],
  ["MIDDLE EAST", 4], ["OCEANIA", 1], ["GLOBAL", 15],
];

const DATE_CHECK_ITEMS =
  "First reported Tuesday 17 Nov: Nvidia's Q3 results - the Alaska Senate call - the US strike on Qeshm - " +
  "the Knesset speaker vote - the Kerch Bridge collapse. " +
  "Not yet news on Wednesday: the Trump-Xi-Putin summit (Thu 19 Nov) - Anthropic's first trade as ANT (Thu) - " +
  "Cyclone Akvan's landfall (Fri 20 Nov).";

// ------------------------------------------------------------------ layout
const MX = 22; // side margin

function drawHero(h: Hero, x: number, y: number) {
  const w = 242;
  h.scene(x, y);
  frame(x, y, w, 84, INK);
  // region chip + proof tag + story number
  const chipW = textWidth(h.region, 1) + 12;
  rect(x, y + 90, chipW, 14, regionColor(h.region));
  drawText(h.region, x + 6, y + 92, 1, regionTextColor(h.region), true);
  drawText(h.status, x + chipW + 8, y + 92, 1, statusColor(h.status), true);
  drawText(String(h.n), x + w - textWidth(String(h.n), 2), y + 90, 2, GRAY, true);
  // headline (Title Case), fixed 3-line block so decks align
  const headLines = wrap(h.head, w, 2).slice(0, 3);
  drawLines(x, y + 108, headLines, 2, INK, 16, true);
  // deck, fixed 3-line block
  const deckLines = wrap(h.deck, w, 1).slice(0, 3);
  drawLines(x, y + 160, deckLines, 1, INK, 8);
  drawText("SOURCE: " + h.src, x, y + 188, 1, GRAY);
}

function drawCard(c: Card, x: number, y: number) {
  const w = 192;
  c.scene(x, y);
  frame(x, y, w, 46, INK);
  // region chip over the top-left of the scene
  const chipW = textWidth(c.region, 1) + 8;
  rect(x + 2, y + 2, chipW, 10, regionColor(c.region));
  drawText(c.region, x + 6, y + 4, 1, regionTextColor(c.region), true);
  // region colour strip under the scene
  rect(x, y + 46, w, 4, regionColor(c.region));
  const headLines = wrap(c.n + ". " + c.head, w, 1).slice(0, 3);
  drawLines(x, y + 54, headLines, 1, INK, 8, true);
  drawText(c.src, x, y + 82, 1, GRAY);
  drawText(c.status, x + w - textWidth(c.status, 1), y + 82, 1, statusColor(c.status), true);
}

function drawBrief(b: Brief, x: number, y: number) {
  const lines = wrap(b.n + ". " + b.head + " (" + b.src + ")", 316, 1).slice(0, 2);
  drawLines(x, y, lines, 1, INK, 8);
  // number in red: redraw first token over the ink text
  drawText(String(b.n) + ".", x, y, 1, RED, true);
}

// ------------------------------------------------------------- world map
// 318 x 68, schematic continents, numbered region-coloured pins for
// the 12 located illustrated stories (3 and 6 are worldwide) and
// ink dots for briefs. Legend sits to the right of the map.
const MAPBOX = { x: 22, y: 936, w: 318, h: 68 };
function project(lon: number, lat: number): [number, number] {
  return [
    MAPBOX.x + ((lon + 170) / 360) * MAPBOX.w,
    MAPBOX.y + ((75 - lat) / 130) * MAPBOX.h,
  ];
}
function drawMap() {
  const { x, y, w, h } = MAPBOX;
  rect(x, y, w, h, LBLUE);
  frame(x, y, w, h, INK);
  const bx = (dx: number, dy: number) => x + dx;
  const by = (dy: number) => y + dy;
  const conts: number[][][] = [
    [[10, 8], [58, 4], [70, 12], [66, 20], [52, 26], [30, 28], [14, 20], [6, 12]], // N America
    [[66, 2], [78, 2], [76, 8], [66, 8]], // Greenland
    [[56, 30], [70, 28], [68, 44], [60, 54], [54, 42]], // S America
    [[148, 6], [168, 4], [172, 10], [164, 16], [150, 16], [146, 10]], // Europe
    [[154, 18], [180, 16], [184, 30], [172, 40], [160, 34], [154, 26]], // Africa
    [[176, 4], [300, 2], [312, 10], [306, 20], [282, 26], [250, 30], [220, 28], [196, 20], [180, 12]], // Asia
    [[252, 32], [262, 32], [260, 38], [250, 36]], // SE Asia islands
    [[272, 34], [282, 34], [280, 40], [270, 38]],
    [[272, 40], [300, 38], [304, 46], [292, 50], [276, 48]], // Australia
  ];
  for (const cont of conts) {
    const pts = cont.map(([dx, dy]) => [bx(dx), by(dy)] as [number, number]);
    fillPoly(pts, LAND);
    strokePoly(pts, INK);
  }
  // brief dots
  for (const [dx, dy] of [[200, 8], [240, 14], [296, 42], [60, 34], [290, 12], [170, 44]] as [number, number][]) {
    disc(bx(dx), by(dy), 2, INK);
  }
  // pins: [lon, lat, label, region, dx, dy] — dx/dy offset the label
  // from the true point (leader line) where pins would collide.
  const pins: [number, number, string, string, number, number][] = [
    [114.1, 22.5, "1", "ASIA", 0, 0],
    [48.0, 29.0, "2", "MIDDLE EAST", 0, 0],
    [4.35, 50.85, "4", "EUROPE", 16, 12],
    [-77.0, 38.9, "5", "AMERICAS", 0, 0],
    [-77.0, 38.9, "7", "AMERICAS", 2, 12],
    [-74.0, 40.7, "8", "AMERICAS", 14, -8],
    [-74.0, 40.7, "9", "AMERICAS", 16, 6],
    [34.5, 31.5, "10", "MIDDLE EAST", 8, 6],
    [30.7, 36.9, "11", "GLOBAL", -10, 8],
    [13.4, 52.5, "12", "EUROPE", 0, 0],
    [-1.6, 54.98, "13", "EUROPE", 0, 0],
    [-0.1, 51.5, "14", "EUROPE", -14, 10],
  ];
  for (const [lon, lat, lab, reg, ox, oy] of pins) {
    const [px0, py0] = project(lon, lat);
    const cx = Math.round(px0) + ox; const cy = Math.round(py0) + oy;
    if (ox || oy) line(Math.round(px0), Math.round(py0), cx, cy, GRAY);
    disc(cx, cy, 6, WHITE);
    disc(cx, cy, 5, regionColor(reg));
    drawText(lab, cx - (lab.length === 1 ? 2 : 5), cy - 3, 1, WHITE, true);
  }
}

function build() {
  // paper background, then border + grain
  rect(0, 0, W, H, PAPER);
  frame(6, 6, W - 12, H - 12, INK);
  frame(8, 8, W - 16, H - 16, INK);
  grain();

  // ---- masthead
  drawText("THE WORLD IN ONE DAY", MX, 14, 2, RED, true);
  const rightKick = "50 STORIES • 6 REGIONS • 14 DRAWN";
  drawText(rightKick, W - MX - textWidth(rightKick, 2), 14, 2, INK, true);
  centerText("Wednesday 18 November 2026", 512, 32, 5, INK, true);
  centerText("Trump Lands in China • Gulf Drones Stopped • Voyager Goes One Light-Day Out", 512, 72, 2, INK);
  hline(MX, 90, W - 2 * MX, INK, 3);

  // ---- region bar (counts sum to 50)
  const segW = [164, 164, 163, 163, 163, 163];
  let sx = MX;
  REGION_BAR.forEach(([name, count], i) => {
    rect(sx, 96, segW[i], 18, regionColor(name));
    frame(sx, 96, segW[i], 18, INK);
    centerText(name + " " + count, sx + Math.floor(segW[i] / 2), 101, 1, regionTextColor(name), true);
    sx += segW[i];
  });

  // ---- numbers band, up top
  drawText("THE DAY IN NUMBERS", MX, 120, 1, RED, true);
  NUMBERS.forEach(([num, cap], i) => {
    const nx = MX + i * 163;
    drawText(num, nx, 130, 3, RED, true);
    drawText(cap, nx, 152, 1, INK);
  });

  // ---- UTC timeline
  drawText("THE DAY IN UTC", MX, 167, 2, RED, true);
  drawText("ALL TIMES UTC", W - MX - textWidth("ALL TIMES UTC", 1), 169, 1, GRAY);
  hline(MX, 180, W - 2 * MX, INK, 1);
  TIMELINE.forEach(([t, ev], i) => {
    const bx = Math.round(MX + i * 122.5);
    disc(bx + 6, 180, 4, RED);
    drawText(t, bx, 186, 2, RED, true);
    const evLines = wrap(ev, 114, 1).slice(0, 2);
    drawLines(bx, 204, evLines, 1, INK, 8);
  });

  // ---- heroes 1-4
  const heroXs = [MX, 268, 514, 760];
  HEROES.forEach((h, i) => drawHero(h, heroXs[i], 226));
  // thin dividers between hero columns so adjacent headlines cannot merge
  for (const dx of [266, 512, 758]) vline(dx, 312, 108, GRAY, 1);
  hline(MX, 428, W - 2 * MX, INK, 3);

  // ---- tier-2 cards 5-14
  drawText("TEN MORE, IN PICTURES", MX, 434, 2, RED, true);
  drawText("STORIES 5-14", W - MX - textWidth("STORIES 5-14", 1), 436, 1, GRAY);
  const cardXs = [MX, 218, 414, 610, 806];
  CARDS.forEach((c, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    drawCard(c, cardXs[col], 452 + row * 98);
  });
  for (const dx of [216, 412, 608, 804]) vline(dx, 452, 190, GRAY, 1);
  hline(MX, 648, W - 2 * MX, INK, 3);

  // ---- briefs 15-50, three columns of twelve
  drawText("ALSO ON THIS DAY", MX, 654, 2, RED, true);
  drawText("STORIES 15-50 - EVERY STORY SOURCED", W - MX - textWidth("STORIES 15-50 - EVERY STORY SOURCED", 1), 656, 1, GRAY);
  const briefXs = [MX, 354, 686];
  BRIEFS.forEach((b, i) => {
    const col = Math.floor(i / 12);
    const row = i % 12;
    drawBrief(b, briefXs[col], 674 + row * 17);
  });
  hline(MX, 882, W - 2 * MX, INK, 3);

  // ---- DATE CHECK, full-width strip
  frame(MX, 888, W - 2 * MX, 34, RED);
  drawText("DATE CHECK - LEFT OUT ON PURPOSE", MX + 6, 892, 1, RED, true);
  const dcLines = wrap(DATE_CHECK_ITEMS, W - 2 * MX - 12, 1).slice(0, 2);
  drawLines(MX + 6, 902, dcLines, 1, INK, 9);

  // ---- bottom row: map + legends
  drawText("WHERE IT HAPPENED", MX, 928, 1, RED, true);
  drawMap();
  drawText("NUMBERED PINS 1-14: ILLUSTRATED STORIES - DOTS: BRIEFS - 3 AND 6 ARE WORLDWIDE", 354, 940, 1, INK);
  drawText("HOW SURE - CONFIRMED: ON THE RECORD - CLAIM: ONE SIDE'S ACCOUNT - FORECAST: OFFICIAL PREDICTION", 354, 951, 1, INK);
  // region colour key
  let kx = 354;
  for (const [name] of REGION_BAR) {
    rect(kx, 960, 10, 10, regionColor(name));
    frame(kx, 960, 10, 10, INK);
    drawText(name, kx + 13, 962, 1, INK, true);
    kx += 13 + textWidth(name, 1) + 10;
  }
  drawText("READS AT THREE SIZES: DATE + LEADS AT THUMBNAIL - 14 PICTURES AT HALF SIZE - 50 STORIES AT FULL SIZE", 354, 975, 1, INK);
  drawText("EVERY STORY HERE HAPPENED, OR WAS FIRST REPORTED, ON WEDNESDAY 18 NOVEMBER 2026.", 354, 986, 1, INK);

  // ---- footer
  centerText("SOURCES: REUTERS - AP - AFP - BBC - NASA - YONHAP - LE MONDE - ICJ - UN - PUNCH - DRAWN ENTIRELY IN CODE", 512, 1008, 1, GRAY);
}

// -------------------------------------------------------------------- main
function main() {
  const total = HEROES.length + CARDS.length + BRIEFS.length;
  if (total !== 50) throw new Error("story count is " + total + ", need 50");
  const regionSum = REGION_BAR.reduce((a, [, c]) => a + c, 0);
  if (regionSum !== 50) throw new Error("region bar sums to " + regionSum + ", need 50");
  // every brief's region must be accounted for in the bar
  const counted: Record<string, number> = {};
  for (const h of HEROES) counted[h.region] = (counted[h.region] || 0) + 1;
  for (const c of CARDS) counted[c.region] = (counted[c.region] || 0) + 1;
  for (const b of BRIEFS) counted[b.region] = (counted[b.region] || 0) + 1;
  for (const [name, n] of REGION_BAR) {
    if (counted[name] !== n) throw new Error("region " + name + " has " + counted[name] + " stories, bar says " + n);
  }
  build();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || ".";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  console.log("stories=" + total + " bytes=" + png.length + " file=" + outPath);
}

main();
