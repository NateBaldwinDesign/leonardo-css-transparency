// Static exporter for the DEFAULT source scale -> scale.css.
//
// The live tool now authors the scale in-browser (hue & chroma as functions of
// lightness, edited like a gradient), so this file is optional: it emits a
// pure-CSS, no-JS snapshot of the *default* scale for anyone who wants the
// compiled-const workflow. Keep the stop model here in sync with index.html.
//
// Per stop it emits gamut-clamped linear-sRGB components (--cN-r/g/b), WCAG
// luminance (--lN), and a display hex (--hexN).

const STOPS = 33, Llo = 0.03, Lhi = 0.985, CMAX = 0.4;

// hue (deg) & chroma (% of CMAX) at chosen lightness positions — the default scale.
const KEY_STOPS = [
  { L: 0.85, h: 99, c: 95 },
  { L: 0.46, h: 79, c: 100 },
].sort((a, b) => a.L - b.L);

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const D = Math.PI / 180;
const toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const oklchToLin = ([L, C, h]) => {
  const a = C * Math.cos(h * D), b = C * Math.sin(h * D);
  const l = (L + 0.3963377774*a + 0.2158037573*b)**3;
  const m = (L - 0.1055613458*a - 0.0638541728*b)**3;
  const s = (L - 0.0894841775*a - 1.291485548*b)**3;
  return [ 4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
          -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
          -0.0041960863*l - 0.7034186147*m + 1.707614701*s ];
};
const inGamut = (lin) => lin.every((v) => v >= -0.001 && v <= 1.001);
function gamutClamp(L, C, h) {            // reduce chroma to the sRGB boundary (no hue skew)
  let lin = oklchToLin([L, C, h]); if (inGamut(lin)) return lin.map(clamp01);
  let lo = 0, hi = C;
  for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2;
    inGamut(oklchToLin([L, mid, h])) ? lo = mid : hi = mid; }
  return oklchToLin([L, lo, h]).map(clamp01);
}
const lumOf = ([r, g, b]) => 0.2126*r + 0.7152*g + 0.0722*b;
const lerpHue = (h0, h1, f) => { let d = ((h1 - h0) % 360 + 540) % 360 - 180; return h0 + d * f; };
function hcAt(L) {
  const ss = KEY_STOPS, n = ss.length;
  if (L <= ss[0].L) return { h: ss[0].h, c: ss[0].c };
  if (L >= ss[n-1].L) return { h: ss[n-1].h, c: ss[n-1].c };
  let i = 0; while (ss[i+1].L < L) i++;
  const f = (L - ss[i].L) / (ss[i+1].L - ss[i].L);
  return { h: lerpHue(ss[i].h, ss[i+1].h, f), c: ss[i].c + (ss[i+1].c - ss[i].c) * f };
}

const stops = [];
for (let i = 0; i < STOPS; i++) {
  const L = Llo + (Lhi - Llo) * i / (STOPS - 1);
  const { h, c } = hcAt(L);
  const lin = gamutClamp(L, c / 100 * CMAX, h);
  const hex = '#' + lin.map((v) => Math.round(clamp01(toGam(v)) * 255).toString(16).padStart(2, '0')).join('');
  stops.push({ lin, lum: lumOf(lin), hex });
}
stops.sort((a, b) => a.lum - b.lum);       // ascending luminance

const f = (v) => v.toFixed(6);
let css = `/* scale.css — COMPILED ARTIFACT (optional). Static snapshot of the DEFAULT scale.\n`;
css += `   The live tool generates the scale in-browser; regenerate with build/compile.mjs. */\n`;
css += `:root {\n  --scale-count: ${STOPS};\n`;
stops.forEach((s, i) => {
  css += `  --c${i}-r: ${f(s.lin[0])}; --c${i}-g: ${f(s.lin[1])}; --c${i}-b: ${f(s.lin[2])}; --l${i}: ${f(s.lum)}; --hex${i}: ${s.hex};\n`;
});
css += `}\n`;
process.stdout.write(css);
