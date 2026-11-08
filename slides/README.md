# Slides (in-class presentation, Wed 2026-12-09)

**Main file: `Shortcut_Learning_Presentation.pptx`** (10 slides, 16:9, speaker notes on every slide).

Everything in the deck can be edited in PowerPoint / Keynote:

- all text is in normal text boxes (theme fonts: Calibri);
- result plots (slides 3, 5, 6, 8) are native PowerPoint charts: right-click → *Edit Data* to see or change the numbers;
- the code-architecture diagram (slide 9) is built from ordinary shapes and arrows;
- each MNIST sample is a separate picture (slides 1–2);
- colors come from the deck theme (Design → Variants → Colors).

## Rebuilding from the results

```bash
# from the repo root
python slides/build/prep.py              # results/*.csv + MNIST -> slides/build/data.json, tiles/
cd slides/build && npm install pptxgenjs # once
node build.js ../Shortcut_Learning_Presentation.pptx
```

`archive_html/` holds the earlier HTML version of the deck and is no longer maintained.
