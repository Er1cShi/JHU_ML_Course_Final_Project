// Editable deck: every text is a native text box, the pipeline is native shapes,
// result plots are native PowerPoint charts, MNIST samples are individual pictures.
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
const JSZip = require("jszip");
// pptxgenjs writes Office's stock palette into the theme; overwrite it with THEME.colors
async function applyTheme(file, theme) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const f = "ppt/theme/theme1.xml";
  let xml = await zip.file(f).async("string");
  for (const [k, v] of Object.entries(theme.colors)) {
    xml = xml.replace(new RegExp(`<a:${k}>[\\s\\S]*?</a:${k}>`), `<a:${k}><a:srgbClr val="${v}"/></a:${k}>`);
  }
  xml = xml.replace(/<a:clrScheme name="[^"]*"/, `<a:clrScheme name="${theme.name}"`);
  zip.file(f, xml);
  const out = new JSZip(); // copy files only, so the package has no folder entries
  for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) out.file(name, await entry.async("nodebuffer"), { createFolders: false });
  fs.writeFileSync(file, await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}
const D = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json")));
const TILE = (n) => path.join(__dirname, "tiles", n);
const OUT = process.argv[2] || "deck.pptx";

const THEME = {
  name: "Shortcut Learning",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "14213D", lt1: "FFFFFF", dk2: "4A5568", lt2: "EEF1F5",
    accent1: "2A78D6", accent2: "EB6834", accent3: "1BAF7A",
    accent4: "B86A0B", accent5: "2459A8", accent6: "8A96AB",
    hlink: "2459A8", folHlink: "6B4FA0",
  },
};
const HEX = { ink: "14213D", muted: "4A5568", faint: "6B7280", grid: "E1E4EA",
  erm: "2A78D6", gb: "EB6834", stable: "1BAF7A", theory: "8A96AB", amber: "B86A0B", navy: "2459A8" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "When More Data Does Not Help";
const C = pres.SchemeColor;

// ---------- layouts ----------
const W = 13.333, M = 0.6;
pres.defineSlideMaster({
  title: "Content", background: { color: "FFFFFF" },
  objects: [
    { placeholder: { options: { name: "eyebrow", type: "body", x: M, y: 0.45, w: W - 2 * M, h: 0.35, fontSize: 13, bold: true, color: C.accent5, charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.8, w: W - 2 * M, h: 0.85, fontSize: 34, bold: true, color: C.text1, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
  slideNumber: { x: W - M - 0.6, y: 6.95, w: 0.6, h: 0.3, fontSize: 11, color: C.accent6, align: "right" },
});
pres.defineSlideMaster({
  title: "Dark", background: { color: THEME.colors.dk1 },
  objects: [
    { placeholder: { options: { name: "eyebrow", type: "body", x: M, y: 0.45, w: W - 2 * M, h: 0.35, fontSize: 13, bold: true, color: "F0A64A", charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.8, w: W - 2 * M, h: 0.85, fontSize: 34, bold: true, color: C.background1, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
  slideNumber: { x: W - M - 0.6, y: 6.95, w: 0.6, h: 0.3, fontSize: 11, color: C.accent6, align: "right" },
});
pres.defineSlideMaster({ title: "Cover", background: { color: THEME.colors.dk1 } });

const tb = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, color: C.text1, valign: "top" }, o));
const card = (s, x, y, w, h, fill, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: name });
const head = (s, eyebrow, title) => { s.addText(eyebrow, { placeholder: "eyebrow" }); s.addText(title, { placeholder: "title" }); };

const axisFont = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt",
  catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
  catAxisTitleColor: HEX.muted, valAxisTitleColor: HEX.muted, catAxisTitleFontSize: 11, valAxisTitleFontSize: 11,
  valGridLine: { color: HEX.grid, size: 0.75 }, catGridLine: { style: "none" }, legendFontSize: 11, legendColor: HEX.muted,
  titleColor: HEX.ink, titleFontSize: 13 };

// =========== 1 cover ===========
pres.addSection({ title: "Intro" });
let s = pres.addSlide({ masterName: "Cover", sectionTitle: "Intro" });
tb(s, "JHU MACHINE LEARNING · FINAL PROJECT · FALL 2026", { x: M + 0.2, y: 0.9, w: 8, h: 0.4, fontSize: 14, bold: true, color: "F0A64A", charSpacing: 2 });
tb(s, "When more data\ndoes not help", { x: M + 0.2, y: 2.2, w: 7.6, h: 2.0, fontSize: 48, bold: true, color: C.background1, fontFace: "+mj-lt" });
tb(s, "A closed-form account of shortcut learning and reweighting", { x: M + 0.2, y: 4.3, w: 7.2, h: 0.9, fontSize: 22, color: "BCC6D6" });
tb(s, "[Author 1] · [Author 2] · [Author 3]", { x: M + 0.2, y: 6.3, w: 7, h: 0.4, fontSize: 16, color: "BCC6D6" });
// four MNIST samples, one per group, as a visual
[["y1_a1_1.png", "label 1 · dark"], ["y-1_a-1_2.png", "label 0 · light"], ["y1_a-1_0.png", "label 1 · light"], ["y-1_a1_0.png", "label 0 · dark"]].forEach((t, i) => {
  const x = 8.75 + (i % 2) * 2.0, y = 1.9 + Math.floor(i / 2) * 2.25;
  s.addImage({ path: TILE(t[0]), x, y, w: 1.7, h: 1.7, altText: "MNIST digit with corner marker", objectName: "cover sample " + (i + 1) });
  tb(s, t[1], { x, y: y + 1.75, w: 1.7, h: 0.3, fontSize: 11, color: "8A96AB", align: "center" });
});
s.addNotes("Hi everyone. Our project is about shortcut learning: why a model that looks great on its test set can fall apart when one cue in the data changes. The short version of our answer: collecting more data does not fix it, reweighting does, and in our setting we can compute exactly how much it helps before running anything.");

// =========== 2 problem ===========
s = pres.addSlide({ masterName: "Content", sectionTitle: "Intro" });
head(s, "THE PROBLEM", "A model learns the corner marker, not the digit");
const groups = [["y1_a1", "Label 1 · dark marker", "majority"], ["y1_a-1", "Label 1 · light marker", "minority"], ["y-1_a-1", "Label 0 · light marker", "majority"], ["y-1_a1", "Label 0 · dark marker", "minority"]];
groups.forEach((g, gi) => {
  const y = 1.95 + gi * 1.22;
  tb(s, g[1], { x: M, y: y + 0.18, w: 2.2, h: 0.4, fontSize: 14, bold: true });
  tb(s, g[2] + " group", { x: M, y: y + 0.55, w: 2.2, h: 0.35, fontSize: 12, color: g[2] === "majority" ? C.accent5 : C.accent4 });
  for (let k = 0; k < 3; k++) {
    const x = M + 2.3 + k * 1.15;
    s.addImage({ path: TILE(`${g[0]}_${k}.png`), x, y, w: 1.05, h: 1.05, altText: g[1], objectName: `${g[0]} sample ${k + 1}` });
    if (D.noisy[g[0]][k]) tb(s, "flipped label", { x, y: y + 0.82, w: 1.05, h: 0.22, fontSize: 9, bold: true, color: "FFFFFF", align: "center", fill: { color: HEX.amber } });
  }
});
card(s, 7.15, 1.95, 5.58, 4.75, "EEF1F5", "problem card");
tb(s, [
  { text: "In training, a dark corner square means \"1\" ", options: {} },
  { text: "95%", options: { bold: true, color: C.accent4 } },
  { text: " of the time. The digit itself is right only ", options: {} },
  { text: "75%", options: { bold: true, color: C.accent5 } },
  { text: " of the time (we flipped 25% of labels).", options: {} },
], { x: 7.5, y: 2.25, w: 4.9, h: 1.3, fontSize: 17 });
tb(s, "A CNN trained normally follows the square. When the square flips, accuracy drops to", { x: 7.5, y: 3.65, w: 4.9, h: 0.9, fontSize: 17 });
tb(s, "10%", { x: 7.5, y: 4.5, w: 4.9, h: 1.0, fontSize: 60, bold: true, color: C.accent4 });
tb(s, [{ text: "This is shortcut learning. ", options: { bold: true } }, { text: "Can we predict how much it hurts, and how much a fix helps?" }], { x: 7.5, y: 5.6, w: 4.9, h: 0.9, fontSize: 16 });
s.addNotes("Here is the problem in one picture. These are real MNIST zeros and ones. We painted a small square in the top-left corner: dark usually means one, light usually means zero. In training the square matches the label 95 percent of the time, while the digit only matches 75 percent, because we flipped a quarter of the labels on purpose. A normal CNN takes the easy route: it reads the square, not the digit. When we flip the square at test time, it gets only 10 percent right. That is shortcut learning. Our question: can we predict this failure, and predict how well the standard fixes work?");

// =========== 3 setup ===========
pres.addSection({ title: "Theory and experiments" });
s = pres.addSlide({ masterName: "Content", sectionTitle: "Theory and experiments" });
head(s, "A CONTROLLED SETTING", "Two features: one stable, one shortcut");
card(s, M, 2.0, 5.0, 1.55, "E3ECFA", "stable card");
tb(s, "Xs = Y + noise(1.0)", { x: M + 0.3, y: 2.2, w: 4.4, h: 0.5, fontSize: 22, bold: true, color: C.accent5, fontFace: "Courier New" });
tb(s, "Stable: same in every environment, but noisy", { x: M + 0.3, y: 2.8, w: 4.4, h: 0.6, fontSize: 15, color: C.text2 });
card(s, M, 3.8, 5.0, 1.55, "FBEFDC", "shortcut card");
tb(s, "Xz = A + noise(0.2)", { x: M + 0.3, y: 4.0, w: 4.4, h: 0.5, fontSize: 22, bold: true, color: C.accent4, fontFace: "Courier New" });
tb(s, "Shortcut: A = Y with probability p, else −Y", { x: M + 0.3, y: 4.6, w: 4.4, h: 0.6, fontSize: 15, color: C.text2 });
tb(s, "Train at p = 0.6, 0.8, 0.95. Test at p, 0.5 and 0.1 (reversed). 10 seeds, n = 500 to 8000.", { x: M, y: 5.6, w: 5.0, h: 0.9, fontSize: 15, color: C.text2 });
function scatter(env, title, x) {
  const pts = D.scatter[env];
  const X = pts.map((p) => p[0]);
  const pos = pts.map((p) => (p[2] > 0 ? p[1] : null));
  const neg = pts.map((p) => (p[2] < 0 ? p[1] : null));
  s.addChart(pres.charts.SCATTER, [{ name: "Xs", values: X }, { name: "Y = +1", values: pos }, { name: "Y = −1", values: neg }], Object.assign({}, axisFont, {
    x, y: 1.95, w: 3.55, h: 4.6, lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    chartColors: [HEX.erm, HEX.gb], showTitle: true, title, showLegend: true, legendPos: "b",
    showCatAxisTitle: true, catAxisTitle: "Xs (stable)", showValAxisTitle: true, valAxisTitle: "Xz (shortcut)",
    valAxisMinVal: -2, valAxisMaxVal: 2, catAxisMinVal: -4, catAxisMaxVal: 4, objectName: "scatter " + env,
  }));
}
scatter("train", "Training env (p = 0.95)", 5.85);
scatter("rev", "Reversed test env (p = 0.1)", 9.3);
s.addNotes("To study this exactly, we built a small synthetic version. Each example has two features. Xs is the stable one: it always relates to the label the same way, but it is noisy. Xz is the shortcut: almost noiseless, but its relation to the label depends on p, which changes between environments. In the training data the shortcut separates the classes almost perfectly: blue points sit at the top, orange at the bottom. In the reversed test environment it is the other way round, so a model that reads Xz gets most points wrong. Because we wrote down the distribution, we can compute the optimal classifier and its accuracy exactly.");

// =========== 4 bayes ===========
s = pres.addSlide({ masterName: "Content", sectionTitle: "Theory and experiments" });
head(s, "RESULT 1 · THEORY", "The best model for the training data uses the shortcut");
card(s, M, 1.95, W - 2 * M, 1.9, "EEF1F5", "formula card");
tb(s, [{ text: "log-odds ≈ 2·xs + " }, { text: "log(p / (1−p))", options: { color: C.accent4, bold: true } }, { text: "·sign(xz)" }], { x: M + 0.4, y: 2.2, w: 11.3, h: 0.6, fontSize: 26, fontFace: "Courier New" });
tb(s, "Acc(p, q) = q·Φ(1 + c/2) + (1−q)·Φ(1 − c/2),   c = log(p / (1−p))", { x: M + 0.4, y: 2.95, w: 11.3, h: 0.6, fontSize: 20, fontFace: "Courier New", color: C.text2 });
const stats = [["0.958", "predicted accuracy in the training environment, p = 0.95", C.accent5], ["0.394", "predicted accuracy when the shortcut reverses (q = 0.1)", C.accent4], ["0.841", "stable feature only, in every environment", C.accent3]];
stats.forEach((st, i) => {
  const x = M + i * 4.1;
  tb(s, st[0], { x, y: 4.3, w: 3.7, h: 1.1, fontSize: 60, bold: true, color: st[2] });
  tb(s, st[1], { x, y: 5.45, w: 3.6, h: 0.9, fontSize: 15, color: C.text2 });
});
tb(s, "None of these numbers depends on the sample size n.", { x: M, y: 6.45, w: 10, h: 0.4, fontSize: 15, italic: true, color: C.text2 });
s.addNotes("First result. We wrote down the Bayes-optimal classifier for the training environment. It puts weight 2 on the stable feature and log p over 1 minus p on the shortcut, which is 2.94 when p is 0.95. So relying on the shortcut is not a bug in training: it is the optimal answer for that data. From this we get a closed-form accuracy in any test environment q. At p equals 0.95 it predicts 95.8 percent in distribution, but only 39.4 percent when the shortcut reverses. Using only the stable feature gives 84.1 percent everywhere. Important point: none of these numbers depends on the sample size n.");

// =========== 5 more data ===========
s = pres.addSlide({ masterName: "Content", sectionTitle: "Theory and experiments" });
head(s, "RESULT 2 · EXPERIMENT", "16× more data, same failure");
const envs = [["id", "In-distribution (q = 0.95)"], ["no_corr", "No correlation (q = 0.5)"], ["reversed", "Reversed (q = 0.1)"]];
envs.forEach((e, i) => {
  const md = D.moredata[e[0]];
  const labels = ["500", "2000", "8000"];
  s.addChart([
    { type: pres.charts.LINE, data: [
      { name: "ERM", labels, values: md.erm }, { name: "Group balanced", labels, values: md.group_balanced }, { name: "Stable only", labels, values: md.stable_only }],
      options: { chartColors: [HEX.erm, HEX.gb, HEX.stable], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 8 } },
    { type: pres.charts.LINE, data: [{ name: "Theory (ERM)", labels, values: md.theory }], options: { chartColors: [HEX.theory], lineDash: "dash", lineSize: 2, lineDataSymbol: "none" } },
  ], Object.assign({}, axisFont, {
    x: M + i * 4.1, y: 1.9, w: 3.9, h: 3.9, showTitle: true, title: e[1], showLegend: true, legendPos: "b",
    valAxisMinVal: 0.3, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0.0",
    showCatAxisTitle: true, catAxisTitle: "training size n", objectName: "accuracy vs n " + e[0],
  }));
});
tb(s, [{ text: "ERM at p = 0.95, reversed environment: " }, { text: "0.371 → 0.392 → 0.386", options: { bold: true, color: C.accent4 } }, { text: " for n = 500 → 2000 → 8000. Theory says 0.394. Across all 81 settings, measurement and theory differ by " }, { text: "0.002", options: { bold: true } }, { text: " on average." }],
  { x: M, y: 6.0, w: 11.6, h: 0.8, fontSize: 16, color: C.text2 });
s.addNotes("Then we checked it with experiments: 270 logistic regression models over three correlations, three sample sizes and ten seeds. Each chart is one test environment at p equals 0.95. The lines are flat. Going from 500 to 8000 samples, accuracy in the reversed environment stays around 39 percent, exactly where the dashed theory line puts it. More data only makes the model more confidently wrong, because it converges to a predictor that relies on the shortcut. Orange is group-balanced reweighting and green uses the stable feature only; both stay at 84 percent everywhere. Over all 81 settings, theory and measurement differ by 0.2 percentage points on average.");

// =========== 6 reweight ===========
pres.addSection({ title: "Reweighting" });
s = pres.addSlide({ masterName: "Content", sectionTitle: "Reweighting" });
head(s, "RESULT 3 · OUR MAIN CONTRIBUTION", "Reweighting is a change of environment");
tb(s, "Weight each (label, attribute) group by", { x: M, y: 1.95, w: 5.2, h: 0.4, fontSize: 16, color: C.text2 });
card(s, M, 2.4, 5.2, 0.75, "EEF1F5", "weight formula");
tb(s, "w = (1−α) + α·n / (4·n_g)", { x: M + 0.25, y: 2.55, w: 4.8, h: 0.45, fontSize: 20, fontFace: "Courier New" });
tb(s, "The weighted data is exactly a new environment:", { x: M, y: 3.35, w: 5.2, h: 0.4, fontSize: 16, color: C.text2 });
card(s, M, 3.8, 5.2, 0.85, "E3ECFA", "p alpha formula");
tb(s, "p_α = p − α·(p − ½)", { x: M + 0.25, y: 3.95, w: 4.8, h: 0.55, fontSize: 26, bold: true, color: C.accent5, fontFace: "Courier New" });
tb(s, [{ text: "Best choice for a known test env q: " }, { text: "α* = (p−q)/(p−½)", options: { bold: true } }, { text: ", which can exceed 1." }], { x: M, y: 4.9, w: 5.2, h: 0.8, fontSize: 16 });
tb(s, [{ text: "p = 0.95: balancing (α = 1) gets 0.84 when reversed; α* = 1.89 gets " }, { text: "0.926", options: { bold: true, color: C.accent5 } }, { text: " (theory 0.928)." }], { x: M, y: 5.8, w: 5.2, h: 0.8, fontSize: 16, color: C.text2 });
const fr = D.frontier, al = fr.alpha.map((a) => (Math.abs(a - 1.8889) < 1e-3 ? "1.89" : String(a)));
s.addChart([
  { type: pres.charts.LINE, data: [{ name: "Measured, in-distribution", labels: al, values: fr.id }, { name: "Measured, reversed", labels: al, values: fr.reversed }], options: { chartColors: [HEX.erm, HEX.amber], lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 10 } },
  { type: pres.charts.LINE, data: [{ name: "Theory, in-distribution", labels: al, values: fr.id_th }, { name: "Theory, reversed", labels: al, values: fr.reversed_th }], options: { chartColors: [HEX.theory, "C9A46A"], lineDash: "dash", lineSize: 2, lineDataSymbol: "none" } },
], Object.assign({}, axisFont, {
  x: 6.3, y: 1.9, w: 6.45, h: 4.85, showTitle: true, title: "Accuracy vs reweighting strength α (p = 0.95, n = 8000)",
  showLegend: true, legendPos: "b", valAxisMinVal: 0.4, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0.0",
  showCatAxisTitle: true, catAxisTitle: "α  (0 = ERM, 1 = group balanced)", objectName: "alpha tradeoff chart",
}));
s.addNotes("This is our main contribution. The standard fix is to reweight the four groups defined by label and attribute so they count equally. We interpolate between normal training at alpha zero and full balancing at alpha one. The key observation: the total weight stays one, so the reweighted data is exactly another environment, with correlation p minus alpha times p minus one half. It is linear in alpha. That gives the whole trade-off in closed form: the dashed lines are theory and the dots are experiments landing on them. As alpha grows, in-distribution accuracy falls and reversed accuracy rises. It also tells us the best alpha for a known test environment, and that it can be bigger than one: if you expect the shortcut to reverse, you should over-balance. At p equals 0.95 that reaches 92.6 percent, versus 84 for standard balancing.");

// =========== 7 validation ===========
s = pres.addSlide({ masterName: "Dark", sectionTitle: "Reweighting" });
head(s, "A PRACTICAL FINDING", "Reweight the validation set too");
tb(s, "If the regularization strength is chosen on an unweighted validation set, model selection quietly undoes the reweighting: for α > 1 it picks the strongest penalty every time.", { x: M, y: 2.0, w: 10.5, h: 1.3, fontSize: 20, color: "BCC6D6" });
[["0.059", "largest gap to theory, unweighted validation (n = 8000)", "F0A64A"], ["0.013", "largest gap with the same weights in validation", "8FB8F0"]].forEach((v, i) => {
  const x = M + i * 6.0;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.7, w: 5.6, h: 2.8, rectRadius: 0.12, fill: { color: "1F2E52" }, line: { color: "1F2E52" }, objectName: "stat card " + (i + 1) });
  tb(s, v[0], { x: x + 0.4, y: 3.95, w: 4.8, h: 1.4, fontSize: 80, bold: true, color: v[2] });
  tb(s, v[1], { x: x + 0.4, y: 5.45, w: 4.8, h: 0.8, fontSize: 17, color: "BCC6D6" });
});
s.addNotes("One practical lesson we did not expect. When we picked the regularization strength using a normal, unweighted validation set, the results drifted away from theory. The validation set still looks like the training environment, so for alpha above one it always chose the strongest regularization, which partly undoes the reweighting. The largest gap to theory was 6 points. Using the same weights in the validation loss fixes it: the largest gap drops to about 1 point. So if you reweight training, reweight model selection too.");

// =========== 8 mnist ===========
pres.addSection({ title: "Real images" });
s = pres.addSlide({ masterName: "Content", sectionTitle: "Real images" });
head(s, "RESULT 4 · REAL IMAGES", "The same rule predicts when a CNN switches cues");
const mn = D.mnist, ml = mn.alpha.map((a) => (Math.abs(a - 1.8889) < 1e-3 ? "1.89" : String(a)));
s.addChart([
  { type: pres.charts.LINE, data: [{ name: "CNN, in-dist. (q = 0.95)", labels: ml, values: mn.id }, { name: "CNN, no corr. (q = 0.5)", labels: ml, values: mn.no_corr }, { name: "CNN, reversed (q = 0.1)", labels: ml, values: mn.reversed }], options: { chartColors: [HEX.erm, HEX.stable, HEX.amber], lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 10 } },
  { type: pres.charts.LINE, data: [{ name: "Predicted, in-dist.", labels: ml, values: mn.id_th }, { name: "Predicted, reversed", labels: ml, values: mn.reversed_th }], options: { chartColors: [HEX.theory, "C9A46A"], lineDash: "dash", lineSize: 2, lineDataSymbol: "none" } },
], Object.assign({}, axisFont, {
  x: M, y: 1.9, w: 7.6, h: 4.9, showTitle: true, title: "MNIST 0/1 accuracy vs α (mean of 3 seeds)", showLegend: true, legendPos: "b",
  valAxisMinVal: 0, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.2, valAxisLabelFormatCode: "0.0", showCatAxisTitle: true, catAxisTitle: "α", objectName: "mnist alpha chart",
}));
tb(s, "Prediction from p_α: the CNN follows", { x: 8.6, y: 1.95, w: 4.1, h: 0.4, fontSize: 16, color: C.text2 });
s.addTable([
  [{ text: "α", options: { bold: true, color: HEX.muted } }, { text: "follows", options: { bold: true, color: HEX.muted } }],
  ["< 0.44", { text: "marker", options: { color: HEX.amber, bold: true } }],
  ["0.44 – 1.56", { text: "digit", options: { color: HEX.navy, bold: true } }],
  ["> 1.56", { text: "inverted marker", options: { color: HEX.amber, bold: true } }],
], { x: 8.6, y: 2.45, w: 4.1, colW: [1.6, 2.5], fontSize: 16, fontFace: "+mn-lt", color: HEX.ink, border: { type: "solid", pt: 0.75, color: HEX.grid }, rowH: 0.45, objectName: "switch table" });
tb(s, "Measured: ERM 0.95 / 0.49 / 0.10; balanced ≈ 0.75 everywhere; α* reversed 0.88 (predicted 0.90).", { x: 8.6, y: 4.6, w: 4.1, h: 1.1, fontSize: 15 });
tb(s, "Near the switch points the change is gradual, not a sharp jump.", { x: 8.6, y: 5.8, w: 4.1, h: 0.8, fontSize: 15, italic: true, color: C.text2 });
s.addNotes("Does this carry over to images and neural networks? Back to MNIST. Because the CNN reads the digit almost perfectly, the problem reduces to two yes-or-no cues: the digit, right 75 percent of the time, and the marker, right with probability p. The model should follow whichever is more reliable in the reweighted training data. Using the same p-alpha formula, we predicted it switches from the marker to the digit at alpha 0.44, and to the inverted marker at 1.56. The dashed lines are the prediction, the dots are the CNN averaged over 3 seeds. Far from the switch points the match is close; near them the change is gradual rather than a sharp jump, which we report honestly as a limitation.");

// =========== 9 pipeline (native shapes) ===========
pres.addSection({ title: "Wrap-up" });
s = pres.addSlide({ masterName: "Content", sectionTitle: "Wrap-up" });
head(s, "HOW WE BUILT IT", "Every number is checked against theory");
const box = (x, y, w, h, title, sub, fill, line, name) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: line, width: 1.25 }, objectName: name });
  tb(s, [{ text: title, options: { bold: true, fontFace: "Courier New", fontSize: 13, breakLine: true } }, { text: sub, options: { fontSize: 11, color: HEX.muted } }], { x: x + 0.12, y: y + 0.08, w: w - 0.24, h: h - 0.16, valign: "middle", align: "center" });
};
const arrow = (x1, y1, x2, y2) => s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, flipV: y2 < y1, line: { color: "8A96AB", width: 1.5, endArrowType: "triangle" } });
const B = { fill: "E3ECFA", line: "2459A8" }, A = { fill: "FBEFDC", line: "B86A0B" }, G = { fill: "E1F2E7", line: "2E7D4F" }, N = { fill: "F4F5F7", line: "8A96AB" };
// column 1 inputs
box(0.6, 2.0, 1.9, 0.85, "data.py", "synthetic generator", B.fill, B.line, "data.py");
box(0.6, 3.1, 1.9, 0.85, "models.py", "ERM / GB / α weights", B.fill, B.line, "models.py");
box(0.6, 4.2, 1.9, 0.85, "metrics.py", "acc, worst group", B.fill, B.line, "metrics.py");
// column 2
box(3.0, 3.1, 2.3, 0.85, "run_experiments.py", "E1–E3, 10 seeds", B.fill, B.line, "run_experiments.py");
box(3.0, 1.85, 2.3, 0.85, "theory.py", "closed-form predictions", A.fill, A.line, "theory.py");
box(3.0, 4.75, 2.3, 0.85, "mnist_shortcut.py", "E4, small CNN", A.fill, A.line, "mnist_shortcut.py");
// column 3 csv
box(5.8, 3.1, 1.75, 0.85, "results/*.csv", "per-model rows", N.fill, N.line, "results csv");
box(5.8, 4.75, 1.75, 0.85, "e4_mnist.csv", "per-model rows", N.fill, N.line, "e4 csv");
// column 4 analysis
box(8.05, 3.1, 1.75, 0.85, "analysis.py", "summary, bootstrap", G.fill, G.line, "analysis.py");
box(8.05, 4.75, 1.75, 0.85, "figures/", "fig0 – fig6", G.fill, G.line, "figures");
arrow(2.5, 2.42, 3.0, 3.35); arrow(2.5, 3.52, 3.0, 3.52); arrow(2.5, 4.62, 3.0, 3.7);
arrow(5.3, 3.52, 5.8, 3.52); arrow(5.3, 5.17, 5.8, 5.17);
arrow(7.55, 3.52, 8.05, 3.52); arrow(7.55, 5.17, 8.05, 3.75); arrow(8.92, 3.95, 8.92, 4.75);
arrow(4.15, 2.7, 4.15, 3.1); arrow(5.3, 2.27, 8.6, 3.1);
// stats column
[["1,254", "final trained models across E1–E4"], ["~6 min", "to reproduce everything on a laptop CPU"], ["fixed seeds", "code and results on GitHub"]].forEach((t, i) => {
  tb(s, t[0], { x: 10.2, y: 1.95 + i * 1.6, w: 2.7, h: 0.7, fontSize: 36, bold: true });
  tb(s, t[1], { x: 10.2, y: 2.65 + i * 1.6, w: 2.7, h: 0.7, fontSize: 14, color: C.text2 });
});
tb(s, "Blue: shared core · Amber: theory and MNIST · Green: analysis output", { x: M, y: 6.3, w: 9, h: 0.35, fontSize: 12, color: C.text2 });
s.addNotes("Briefly, how the code is organised. A data generator, the models and metrics feed an experiment runner that writes CSV files. A separate theory module computes the predictions, and the analysis script puts the two side by side for every figure. The MNIST experiment is its own script with a small CNN. Everything uses fixed seeds and reproduces in about six minutes on a laptop CPU. The code and all results are on GitHub.");

// =========== 10 takeaways ===========
s = pres.addSlide({ masterName: "Dark", sectionTitle: "Wrap-up" });
head(s, "WHAT WE LEARNED", "Takeaways");
["Using a reliable shortcut is optimal for the training data. More data from the same place cannot fix it.",
 "Group reweighting is a change of environment, p_α = p − α(p − ½), so its cost and benefit are predictable.",
 "Standard balancing (α = 1) is best only when the test correlation is 0.5. Reweight validation the same way."].forEach((t, i) => {
  const y = 2.0 + i * 1.35;
  s.addShape(pres.shapes.OVAL, { x: M, y: y + 0.1, w: 0.7, h: 0.7, fill: { color: "F0A64A" }, line: { color: "F0A64A" }, objectName: "number " + (i + 1) });
  tb(s, String(i + 1), { x: M, y: y + 0.1, w: 0.7, h: 0.7, fontSize: 24, bold: true, color: C.text1, align: "center", valign: "middle" });
  tb(s, t, { x: M + 1.1, y, w: 10.8, h: 1.0, fontSize: 22, color: C.background1, valign: "middle" });
});
tb(s, "Limits: known group labels, binary attribute, one image construction · Thank you, questions?", { x: M, y: 6.4, w: 11, h: 0.4, fontSize: 14, color: "8A96AB" });
s.addNotes("Three takeaways. First, relying on a reliable shortcut is the optimal thing to do for the training data, so more data from the same place cannot fix it. Second, group reweighting works because it changes the environment, and in our setting that change is linear in the reweighting strength, so cost and benefit can be computed in advance. Third, the standard choice of fully balancing is only optimal if you expect the shortcut to carry no information at test time; and if you reweight, reweight your validation too. Limits: we assume group labels are known and the attribute is binary, and we tested one image construction. Thank you, happy to take questions.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
