"""Prepare data.json and MNIST tiles for build.js. Run from the repo root: python slides/build/prep.py"""
import sys, json
from pathlib import Path
import numpy as np, pandas as pd
from PIL import Image
sys.path.insert(0, "src")
import data as D
import mnist_shortcut as M

OUT = Path(__file__).resolve().parent
(OUT / "tiles").mkdir(exist_ok=True)

rng = np.random.default_rng(0)
def pts(p, n=160):
    d = D.sample(n, p, rng)
    return [[float(a), float(b), int(c)] for (a, b), c in zip(d.X[:, :2], d.y)]
out = {"scatter": {"train": pts(0.95), "rev": pts(0.1)}}

s = pd.read_csv("results/summary.csv"); s = s[s.p_train == 0.95]
out["moredata"] = {}
for env in ["id", "no_corr", "reversed"]:
    t = s[s.env == env]
    md = {m: [round(float(v), 4) for v in t[t.method == m].sort_values("n").acc_mean] for m in ["erm", "group_balanced", "stable_only"]}
    md["theory"] = [round(float(v), 4) for v in t[t.method == "erm"].sort_values("n").theory_acc]
    out["moredata"][env] = md

e = pd.read_csv("results/e3_summary.csv"); e = e[(e.val_selection == "weighted") & (e.p_train == 0.95) & (e.n == 8000)]
fr = {"alpha": sorted(e.alpha.unique().tolist())}
for env in ["id", "reversed"]:
    t = e[e.env == env].sort_values("alpha"); fr[env] = [round(v, 4) for v in t.acc_mean]; fr[env + "_th"] = [round(v, 4) for v in t.theory_acc]
out["frontier"] = fr

m = pd.read_csv("results/e4_mnist.csv")
g = m.groupby(["alpha", "env"]).agg(acc=("acc", "mean"), th=("theory_acc", "mean")).reset_index()
mn = {"alpha": sorted(g.alpha.unique().tolist())}
for env in ["id", "no_corr", "reversed"]:
    t = g[g.env == env].sort_values("alpha"); mn[env] = [round(v, 4) for v in t.acc]; mn[env + "_th"] = [round(v, 4) for v in t.th]
out["mnist"] = mn

# MNIST tiles: 3 per (label, marker) group, inverted (dark digit on white, A=+1 marker shows dark)
x, digit = M.load_01()["train"]
img, y, a = M.make_env(x, digit, 0.95, np.random.default_rng(3))
out["noisy"] = {}
for yy in (1, -1):
    for aa in (1, -1):
        key = f"y{yy}_a{aa}"; idx = np.where((y == yy) & (a == aa))[0][:3]
        out["noisy"][key] = [int(digit[i] != y[i]) for i in idx]
        for k, i in enumerate(idx):
            im = (255 - img[i] * 255).astype(np.uint8)
            Image.fromarray(im).resize((224, 224), Image.NEAREST).save(OUT / "tiles" / f"{key}_{k}.png")
json.dump(out, open(OUT / "data.json", "w"))
print("wrote", OUT / "data.json")
