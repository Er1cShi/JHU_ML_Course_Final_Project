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
    { placeholder: { options: { name: "eyebrow", type: "body", x: M, y: 0.45, w: W - 2 * M, h: 0.4, fontSize: 16, bold: true, color: C.accent5, charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.85, w: W - 2 * M, h: 0.95, fontSize: 40, bold: true, color: C.text1, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
  slideNumber: { x: W - M - 0.6, y: 6.95, w: 0.6, h: 0.3, fontSize: 14, color: C.accent6, align: "right" },
});
pres.defineSlideMaster({
  title: "Dark", background: { color: THEME.colors.dk1 },
  objects: [
    { placeholder: { options: { name: "eyebrow", type: "body", x: M, y: 0.45, w: W - 2 * M, h: 0.4, fontSize: 16, bold: true, color: "F0A64A", charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.85, w: W - 2 * M, h: 0.95, fontSize: 40, bold: true, color: C.background1, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
  slideNumber: { x: W - M - 0.6, y: 6.95, w: 0.6, h: 0.3, fontSize: 14, color: C.accent6, align: "right" },
});
pres.defineSlideMaster({ title: "Cover", background: { color: THEME.colors.dk1 } });

const tb = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 22, color: C.text1, valign: "top" }, o));
const card = (s, x, y, w, h, fill, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: name });
const head = (s, eyebrow, title) => { s.addText(eyebrow, { placeholder: "eyebrow" }); s.addText(title, { placeholder: "title" }); };

const axisFont = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt",
  catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontSize: 16, valAxisLabelFontSize: 16,
  catAxisTitleColor: HEX.muted, valAxisTitleColor: HEX.muted, catAxisTitleFontSize: 16, valAxisTitleFontSize: 16,
  valGridLine: { color: HEX.grid, size: 0.75 }, catGridLine: { style: "none" }, legendFontSize: 16, legendColor: HEX.muted,
  titleColor: HEX.ink, titleFontSize: 18 };
// ===================== MAIN TALK (7 slides, ~6 min) =====================
const lineChart = (s, groups, o) => s.addChart(groups, Object.assign({}, axisFont, o));
const fmtA = (arr) => arr.map((a) => (Math.abs(a - 1.8889) < 1e-3 ? "1.89" : String(a)));

// 1 cover
pres.addSection({ title: "Talk" });
let s = pres.addSlide({ masterName: "Cover", sectionTitle: "Talk" });
tb(s, "JHU MACHINE LEARNING · FINAL PROJECT · FALL 2026", { x: M + 0.2, y: 0.9, w: 8, h: 0.4, fontSize: 16, bold: true, color: "F0A64A", charSpacing: 2 });
tb(s, "When more data\ndoes not help", { x: M + 0.2, y: 2.0, w: 7.6, h: 2.2, fontSize: 54, bold: true, color: C.background1, fontFace: "+mj-lt" });
tb(s, "A closed-form account of shortcut learning and reweighting", { x: M + 0.2, y: 4.35, w: 7.2, h: 1.0, fontSize: 26, color: "BCC6D6" });
tb(s, "[Author 1] · [Author 2] · [Author 3]", { x: M + 0.2, y: 6.2, w: 7.4, h: 0.5, fontSize: 20, color: "BCC6D6" });
[["y1_a1_1.png", "label 1 · dark"], ["y-1_a-1_2.png", "label 0 · light"], ["y1_a-1_0.png", "label 1 · light"], ["y-1_a1_0.png", "label 0 · dark"]].forEach((t, i) => {
  const x = 8.6 + (i % 2) * 2.15, y = 1.7 + Math.floor(i / 2) * 2.45;
  s.addImage({ path: TILE(t[0]), x, y, w: 1.85, h: 1.85, altText: "MNIST digit with corner marker", objectName: "cover sample " + (i + 1) });
  tb(s, t[1], { x, y: y + 1.92, w: 1.85, h: 0.35, fontSize: 14, color: "8A96AB", align: "center" });
});
s.addNotes("(about 15 s) Hi everyone. Our project asks why a model that looks great on its test set can fail when one cue in the data changes, and whether we can predict how much a fix helps.");

// 2 motivation
s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
head(s, "MOTIVATION", "A CNN learns the corner square, not the digit");
const groups = [["y1_a1", "Label 1 · dark", "common"], ["y1_a-1", "Label 1 · light", "rare"], ["y-1_a-1", "Label 0 · light", "common"], ["y-1_a1", "Label 0 · dark", "rare"]];
groups.forEach((g, gi) => {
  const y = 2.05 + gi * 1.2;
  tb(s, g[1], { x: M, y: y + 0.2, w: 2.3, h: 0.45, fontSize: 18, bold: true });
  tb(s, g[2] + " in training", { x: M, y: y + 0.62, w: 2.3, h: 0.4, fontSize: 15, color: g[2] === "common" ? C.accent5 : C.accent4 });
  for (let k = 0; k < 2; k++) {
    const x = M + 2.4 + k * 1.2;
    s.addImage({ path: TILE(`${g[0]}_${k}.png`), x, y, w: 1.1, h: 1.1, altText: g[1], objectName: `${g[0]} sample ${k + 1}` });
    if (D.noisy[g[0]][k]) tb(s, "flipped", { x, y: y + 0.84, w: 1.1, h: 0.26, fontSize: 12, bold: true, color: "FFFFFF", align: "center", fill: { color: HEX.amber } });
  }
});
card(s, 5.75, 2.0, 6.98, 4.75, "EEF1F5", "motivation card");
tb(s, [{ text: "Training: the dark square means \"1\" " }, { text: "95%", options: { bold: true, color: C.accent4 } }, { text: " of the time; the digit is right only " }, { text: "75%", options: { bold: true, color: C.accent5 } }, { text: "." }],
  { x: 6.1, y: 2.3, w: 6.3, h: 1.2, fontSize: 24 });
tb(s, "Flip the square at test time:", { x: 6.1, y: 3.6, w: 6.3, h: 0.5, fontSize: 24 });
tb(s, [{ text: "95% → 10%", options: { bold: true, color: C.accent4 } }], { x: 6.1, y: 4.1, w: 6.3, h: 1.1, fontSize: 60 });
tb(s, [{ text: "Question: ", options: { bold: true } }, { text: "can we predict this failure, and how much a fix helps, before training?" }], { x: 6.1, y: 5.45, w: 6.3, h: 1.1, fontSize: 22 });
s.addNotes("(about 50 s) These are real MNIST zeros and ones. We painted a small square in the corner. In training, a dark square means one 95 percent of the time, while the digit only matches 75 percent, because we flipped a quarter of the labels on purpose. A normal CNN takes the easy cue: it reads the square. When the square flips at test time, accuracy falls from 95 to 10 percent. This is shortcut learning. Our question: can we predict this failure, and how much a fix helps, before training anything?");

// 3 method + key math insight
s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
head(s, "SETUP AND KEY MATH", "The optimal model uses the shortcut");
card(s, M, 2.0, 5.9, 1.3, "E3ECFA", "stable card");
tb(s, "Xs = Y + N(0, 1)", { x: M + 0.3, y: 2.12, w: 5.4, h: 0.55, fontSize: 26, bold: true, color: C.accent5, fontFace: "Courier New" });
tb(s, "stable, but noisy", { x: M + 0.3, y: 2.72, w: 5.4, h: 0.45, fontSize: 20, color: C.text2 });
card(s, 6.83, 2.0, 5.9, 1.3, "FBEFDC", "shortcut card");
tb(s, "Xz = A + 0.2·N(0, 1)", { x: 7.13, y: 2.12, w: 5.4, h: 0.55, fontSize: 26, bold: true, color: C.accent4, fontFace: "Courier New" });
tb(s, "A = Y with prob. p, else −Y", { x: 7.13, y: 2.72, w: 5.4, h: 0.45, fontSize: 20, color: C.text2 });
tb(s, "Bayes-optimal log-odds in the training environment:", { x: M, y: 3.6, w: 12, h: 0.5, fontSize: 22, color: C.text2 });
tb(s, [{ text: "2·xs + " }, { text: "log(p/(1−p))", options: { color: C.accent4, bold: true } }, { text: "·sign(xz)" }], { x: M, y: 4.15, w: 12, h: 0.75, fontSize: 36, fontFace: "Courier New" });
[["0.958", "accuracy, train env (p = 0.95)", C.accent5], ["0.394", "when the shortcut reverses", C.accent4], ["no n", "sample size never appears", C.text1]].forEach((st, i) => {
  const x = M + i * 4.1;
  tb(s, st[0], { x, y: 5.15, w: 3.8, h: 0.95, fontSize: 52, bold: true, color: st[2] });
  tb(s, st[1], { x, y: 6.1, w: 3.8, h: 0.5, fontSize: 20, color: C.text2 });
});
s.addNotes("(about 60 s) To make this exact, we use a two-feature model. Xs is stable but noisy. Xz is a nearly noiseless shortcut that agrees with the label with probability p, and p changes between environments. Writing down the Bayes-optimal classifier for training gives weight log p over 1 minus p on the shortcut. So using the shortcut is not a bug: it is optimal for the training data. This gives closed-form accuracy in any test environment: 95.8 percent in training, 39.4 percent when the shortcut reverses. And the sample size n never appears in the formula.");

// 4 result: more data
s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
head(s, "RESULT 1", "16× more data, same failure");
{
  const md = D.moredata.reversed, labels = ["500", "2000", "8000"];
  lineChart(s, [
    { type: pres.charts.LINE, data: [{ name: "ERM", labels, values: md.erm }, { name: "Group balanced", labels, values: md.group_balanced }, { name: "Stable feature only", labels, values: md.stable_only }],
      options: { chartColors: [HEX.erm, HEX.gb, HEX.stable], lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 11 } },
    { type: pres.charts.LINE, data: [{ name: "Theory (ERM)", labels, values: md.theory }], options: { chartColors: [HEX.theory], lineDash: "dash", lineSize: 2.5, lineDataSymbol: "none" } },
  ], { x: M, y: 1.95, w: 7.4, h: 4.9, showTitle: true, title: "Accuracy when the shortcut reverses (p = 0.95)", showLegend: true, legendPos: "b",
    valAxisMinVal: 0.2, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.2, valAxisLabelFormatCode: "0.0", showCatAxisTitle: true, catAxisTitle: "training size n", objectName: "reversed accuracy vs n" });
}
tb(s, "ERM, n = 500 → 8000", { x: 8.5, y: 2.1, w: 4.3, h: 0.5, fontSize: 20, color: C.text2 });
tb(s, "0.37 → 0.39", { x: 8.5, y: 2.6, w: 4.3, h: 0.9, fontSize: 48, bold: true, color: C.accent4 });
tb(s, "theory: 0.394", { x: 8.5, y: 3.5, w: 4.3, h: 0.5, fontSize: 20, color: C.text2 });
tb(s, "0.002", { x: 8.5, y: 4.45, w: 4.3, h: 0.9, fontSize: 48, bold: true, color: C.accent5 });
tb(s, "mean gap to theory over 81 settings (270 models)", { x: 8.5, y: 5.35, w: 4.3, h: 0.9, fontSize: 20, color: C.text2 });
s.addNotes("(about 45 s) We checked this with 270 logistic-regression models. This is the reversed test environment. Going from 500 to 8000 samples, ERM stays near 39 percent, right on the dashed theory line. More data only makes the model more confidently wrong. Group balancing and the stable-feature model stay at 84 percent. Over all 81 settings, theory and experiment differ by 0.2 points on average.");

// 5 main contribution
s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
head(s, "RESULT 2 · OUR MAIN CONTRIBUTION", "Reweighting is a change of environment");
tb(s, "Group weights:", { x: M, y: 2.0, w: 5.2, h: 0.45, fontSize: 20, color: C.text2 });
tb(s, "w = (1−α) + α·n/(4n_g)", { x: M, y: 2.45, w: 5.3, h: 0.55, fontSize: 24, fontFace: "Courier New" });
tb(s, "α = 0: ERM,  α = 1: group balanced", { x: M, y: 3.0, w: 5.3, h: 0.45, fontSize: 18, color: C.text2 });
card(s, M, 3.6, 5.3, 1.0, "E3ECFA", "p alpha formula");
tb(s, "p_α = p − α(p − ½)", { x: M + 0.25, y: 3.78, w: 4.9, h: 0.65, fontSize: 32, bold: true, color: C.accent5, fontFace: "Courier New" });
tb(s, [{ text: "Best for a known test env q:\n" }, { text: "α* = (p−q)/(p−½)", options: { bold: true } }, { text: ", can exceed 1" }], { x: M, y: 4.8, w: 5.3, h: 0.95, fontSize: 21 });
tb(s, [{ text: "Reversed env: α = 1 → 0.84,  α* = 1.89 → " }, { text: "0.93", options: { bold: true, color: C.accent5 } }], { x: M, y: 5.9, w: 5.3, h: 0.9, fontSize: 21, color: C.text2 });
{
  const fr = D.frontier, al = fmtA(fr.alpha);
  lineChart(s, [
    { type: pres.charts.LINE, data: [{ name: "In-distribution", labels: al, values: fr.id }, { name: "Reversed", labels: al, values: fr.reversed }], options: { chartColors: [HEX.erm, HEX.amber], lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 13 } },
    { type: pres.charts.LINE, data: [{ name: "Theory", labels: al, values: fr.id_th }, { name: "Theory ", labels: al, values: fr.reversed_th }], options: { chartColors: [HEX.theory, "C9A46A"], lineDash: "dash", lineSize: 2.5, lineDataSymbol: "none" } },
  ], { x: 6.2, y: 1.95, w: 6.55, h: 4.95, showTitle: true, title: "Dots: experiment · dashes: theory (p = 0.95)", showLegend: true, legendPos: "b",
    valAxisMinVal: 0.4, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0.0", showCatAxisTitle: true, catAxisTitle: "α", objectName: "alpha tradeoff chart" });
}
s.addNotes("(about 75 s) This is our main contribution. The standard fix reweights the four label-attribute groups so they count equally. We interpolate with alpha: zero is ordinary training, one is full balancing. Key observation: the total weight stays one, so the reweighted data is exactly another environment, with correlation p minus alpha times p minus one half, linear in alpha. Plugging this into our accuracy formula gives the whole trade-off curve in closed form; the dots are experiments landing on the dashes. It also gives the best alpha for a known test environment, and it can be larger than one. If you expect the shortcut to reverse, you should over-balance: 93 percent instead of 84.");

// 6 MNIST
s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
head(s, "RESULT 3 · REAL IMAGES", "The formula predicts when a CNN switches");
{
  const mn = D.mnist, ml = fmtA(mn.alpha);
  lineChart(s, [
    { type: pres.charts.LINE, data: [{ name: "In-distribution", labels: ml, values: mn.id }, { name: "Reversed", labels: ml, values: mn.reversed }], options: { chartColors: [HEX.erm, HEX.amber], lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 13 } },
    { type: pres.charts.LINE, data: [{ name: "Predicted", labels: ml, values: mn.id_th }, { name: "Predicted ", labels: ml, values: mn.reversed_th }], options: { chartColors: [HEX.theory, "C9A46A"], lineDash: "dash", lineSize: 2.5, lineDataSymbol: "none" } },
  ], { x: M, y: 1.95, w: 7.3, h: 4.95, showTitle: true, title: "MNIST 0/1, small CNN, mean of 3 seeds", showLegend: true, legendPos: "b",
    valAxisMinVal: 0, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.2, valAxisLabelFormatCode: "0.0", showCatAxisTitle: true, catAxisTitle: "α", objectName: "mnist alpha chart" });
}
tb(s, "Two cues: digit (75%) vs square (p_α). Predicted:", { x: 8.3, y: 2.0, w: 4.45, h: 0.95, fontSize: 20, color: C.text2 });
s.addTable([
  [{ text: "α < 0.44", options: {} }, { text: "square", options: { color: HEX.amber, bold: true } }],
  ["0.44 – 1.56", { text: "digit", options: { color: HEX.navy, bold: true } }],
  ["α > 1.56", { text: "flipped square", options: { color: HEX.amber, bold: true } }],
], { x: 8.3, y: 3.05, w: 4.45, colW: [1.85, 2.6], fontSize: 20, fontFace: "+mn-lt", color: HEX.ink, border: { type: "solid", pt: 0.75, color: HEX.grid }, rowH: 0.55, objectName: "switch table" });
tb(s, "Far from the switch points the CNN matches; near them the change is gradual.", { x: 8.3, y: 5.0, w: 4.45, h: 1.4, fontSize: 20 });
s.addNotes("(about 50 s) Does it carry over to images and neural networks? The CNN reads the digit almost perfectly, so the problem reduces to two cues: the digit, right 75 percent of the time, and the square, right with probability p alpha. The model should follow whichever is more reliable. The same formula predicts it switches to the digit at alpha 0.44 and to the flipped square at 1.56. Far from those points the CNN matches the prediction; near them the switch is gradual, not a sharp jump.");

// 7 takeaways + open questions
s = pres.addSlide({ masterName: "Dark", sectionTitle: "Talk" });
head(s, "TAKEAWAYS", "What we found, and what is open");
["Using the shortcut is optimal for the training data, so more data cannot fix it.",
 "Reweighting = a new environment, p_α = p − α(p − ½): its cost and benefit are predictable.",
 "Surprise: reweight the validation set too, or model selection undoes the reweighting."].forEach((t, i) => {
  const y = 2.0 + i * 1.05;
  s.addShape(pres.shapes.OVAL, { x: M, y: y + 0.12, w: 0.6, h: 0.6, fill: { color: "F0A64A" }, line: { color: "F0A64A" }, objectName: "number " + (i + 1) });
  tb(s, String(i + 1), { x: M, y: y + 0.12, w: 0.6, h: 0.6, fontSize: 22, bold: true, color: C.text1, align: "center", valign: "middle" });
  tb(s, t, { x: M + 0.95, y, w: 11.2, h: 0.85, fontSize: 24, color: C.background1, valign: "middle" });
});
tb(s, "Open questions", { x: M, y: 5.3, w: 6, h: 0.5, fontSize: 22, bold: true, color: "F0A64A" });
tb(s, "Group labels unknown? Non-binary or several shortcuts? Why is the CNN switch gradual?", { x: M, y: 5.8, w: 12, h: 0.6, fontSize: 22, color: "BCC6D6" });
tb(s, "Thank you, questions and suggestions welcome", { x: M, y: 6.6, w: 9, h: 0.45, fontSize: 18, color: "8A96AB" });
s.addNotes("(about 40 s) Three takeaways. Relying on a reliable shortcut is optimal for the training data, so more data cannot fix it. Reweighting works because it creates a new environment, so its cost and benefit can be computed in advance. And one surprise: if you reweight training but pick hyperparameters on an unweighted validation set, model selection quietly undoes the reweighting. Open questions: what if group labels are unknown, what about several or non-binary shortcuts, and why the CNN switches gradually. We would love your suggestions. Thank you.");

// ===================== BACKUP (for Q&A) =====================
pres.addSection({ title: "Backup" });
s = pres.addSlide({ masterName: "Dark", sectionTitle: "Backup" });
head(s, "BACKUP · VALIDATION", "Reweight the validation set too");
tb(s, "Choosing the regularization strength on an unweighted validation set picks the strongest penalty for every α > 1, partly undoing the reweighting.", { x: M, y: 2.0, w: 11.5, h: 1.3, fontSize: 24, color: "BCC6D6" });
[["0.059", "largest gap to theory, unweighted validation (n = 8000)", "F0A64A"], ["0.013", "largest gap with the same weights in validation", "8FB8F0"]].forEach((v, i) => {
  const x = M + i * 6.0;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.7, w: 5.6, h: 2.8, rectRadius: 0.12, fill: { color: "1F2E52" }, line: { color: "1F2E52" }, objectName: "stat card " + (i + 1) });
  tb(s, v[0], { x: x + 0.4, y: 3.95, w: 4.8, h: 1.4, fontSize: 80, bold: true, color: v[2] });
  tb(s, v[1], { x: x + 0.4, y: 5.4, w: 4.8, h: 0.9, fontSize: 20, color: "BCC6D6" });
});
s.addNotes("Backup for Q&A: details of the validation finding.");

s = pres.addSlide({ masterName: "Content", sectionTitle: "Backup" });
head(s, "BACKUP · DATA", "What the synthetic data looks like");
function scatter(env, title, x) {
  const pts = D.scatter[env];
  s.addChart(pres.charts.SCATTER, [{ name: "Xs", values: pts.map((p) => p[0]) }, { name: "Y = +1", values: pts.map((p) => (p[2] > 0 ? p[1] : null)) }, { name: "Y = −1", values: pts.map((p) => (p[2] < 0 ? p[1] : null)) }], Object.assign({}, axisFont, {
    x, y: 1.95, w: 5.9, h: 4.95, lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 7, chartColors: [HEX.erm, HEX.gb], showTitle: true, title, showLegend: true, legendPos: "b",
    showCatAxisTitle: true, catAxisTitle: "Xs (stable)", showValAxisTitle: true, valAxisTitle: "Xz (shortcut)", valAxisMinVal: -2, valAxisMaxVal: 2, catAxisMinVal: -4, catAxisMaxVal: 4, catAxisLabelPos: "low", valAxisLabelPos: "low", objectName: "scatter " + env }));
}
scatter("train", "Training env (p = 0.95)", M);
scatter("rev", "Reversed test env (p = 0.1)", 6.83);
s.addNotes("Backup: in training the shortcut Xz separates the classes almost perfectly; in the reversed environment it points the wrong way.");

s = pres.addSlide({ masterName: "Content", sectionTitle: "Backup" });
head(s, "BACKUP · ALL ENVIRONMENTS", "Accuracy vs n in three test environments (p = 0.95)");
[["id", "In-dist. (q = 0.95)"], ["no_corr", "No corr. (q = 0.5)"], ["reversed", "Reversed (q = 0.1)"]].forEach((e, i) => {
  const md = D.moredata[e[0]], labels = ["500", "2000", "8000"];
  lineChart(s, [
    { type: pres.charts.LINE, data: [{ name: "ERM", labels, values: md.erm }, { name: "GB", labels, values: md.group_balanced }, { name: "Stable", labels, values: md.stable_only }], options: { chartColors: [HEX.erm, HEX.gb, HEX.stable], lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 9 } },
    { type: pres.charts.LINE, data: [{ name: "Theory", labels, values: md.theory }], options: { chartColors: [HEX.theory], lineDash: "dash", lineSize: 2.5, lineDataSymbol: "none" } },
  ], { x: M + i * 4.1, y: 1.95, w: 3.95, h: 4.95, showTitle: true, title: e[1], showLegend: true, legendPos: "b",
    valAxisMinVal: 0.3, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0.0", objectName: "accuracy vs n " + e[0] });
});
s.addNotes("Backup: all three test environments; ERM lines are flat in n and sit on the theory lines.");

s = pres.addSlide({ masterName: "Content", sectionTitle: "Backup" });
head(s, "BACKUP · CODE", "Every number is checked against theory");
const box = (x, y, w, h, title, sub, fill, line, name) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: line, width: 1.25 }, objectName: name });
  tb(s, [{ text: title, options: { bold: true, fontFace: "Courier New", fontSize: 15, breakLine: true } }, { text: sub, options: { fontSize: 13, color: HEX.muted } }], { x: x + 0.08, y: y + 0.06, w: w - 0.16, h: h - 0.12, valign: "middle", align: "center" });
};
const arrow = (x1, y1, x2, y2) => s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, flipV: y2 < y1, line: { color: "8A96AB", width: 1.5, endArrowType: "triangle" } });
const B = ["E3ECFA", "2459A8"], A = ["FBEFDC", "B86A0B"], G = ["E1F2E7", "2E7D4F"], N = ["F4F5F7", "8A96AB"];
box(0.6, 2.0, 2.1, 0.95, "data.py", "data generator", ...B, "data.py");
box(0.6, 3.25, 2.1, 0.95, "models.py", "ERM / GB / α", ...B, "models.py");
box(0.6, 4.5, 2.1, 0.95, "metrics.py", "acc, worst group", ...B, "metrics.py");
box(3.2, 3.25, 2.6, 0.95, "run_experiments.py", "E1–E3, 10 seeds", ...B, "run_experiments.py");
box(3.2, 2.0, 2.6, 0.95, "theory.py", "closed form", ...A, "theory.py");
box(3.2, 5.15, 2.6, 0.95, "mnist_shortcut.py", "E4, small CNN", ...A, "mnist_shortcut.py");
box(6.3, 3.25, 2.0, 0.95, "results/*.csv", "per-model rows", ...N, "results csv");
box(6.3, 5.15, 2.0, 0.95, "e4_mnist.csv", "per-model rows", ...N, "e4 csv");
box(8.8, 3.25, 2.0, 0.95, "analysis.py", "summary", ...G, "analysis.py");
box(8.8, 5.15, 2.0, 0.95, "figures/", "fig0 – fig6", ...G, "figures");
arrow(2.7, 2.47, 3.2, 3.5); arrow(2.7, 3.72, 3.2, 3.72); arrow(2.7, 4.97, 3.2, 3.95);
arrow(5.8, 3.72, 6.3, 3.72); arrow(5.8, 5.62, 6.3, 5.62); arrow(8.3, 3.72, 8.8, 3.72); arrow(8.3, 5.62, 8.8, 3.95);
arrow(9.8, 4.2, 9.8, 5.15); arrow(4.5, 2.95, 4.5, 3.25); arrow(5.8, 2.47, 9.3, 3.25);
tb(s, "1,254 models · ~6 min on a laptop CPU · fixed seeds · code on GitHub", { x: M, y: 6.45, w: 12, h: 0.45, fontSize: 18, color: C.text2 });
s.addNotes("Backup: code architecture.");
(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
