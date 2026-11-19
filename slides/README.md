# Slides (in-class presentation, Wed 2026-12-09)

**Main file: `Shortcut_Learning_Presentation.pptx`** (16:9). Slides 1–7 are the 6-minute talk (timing in each speaker note); slides 8–11 are backup for Q&A. Body text is 18 pt or larger so it reads from the back of the room.

Everything in the deck can be edited in PowerPoint / Keynote:

- all text is in normal text boxes (theme fonts: Calibri);
- result plots are native PowerPoint charts: right-click → *Edit Data* to see or change the numbers;
- the code-architecture diagram (backup slide) is built from ordinary shapes and arrows;
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
