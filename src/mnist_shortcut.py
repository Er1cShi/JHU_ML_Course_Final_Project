"""E4: shortcut learning on MNIST with a corner marker (image-level check of the alpha theory).

Construction (in the spirit of Colored MNIST, Arjovsky et al. 2019):
  * keep digits 0 and 1; digit label D in {-1 (zero), +1 (one)}
  * observed label Y = D, flipped with probability ETA = 0.25, so the digit
    (the stable feature) predicts Y with accuracy Q = 0.75 in every environment
  * shortcut attribute A = Y w.p. p, else -Y; drawn as a 4x4 patch in the
    top-left corner with intensity 0.25 (A=-1) or 0.75 (A=+1)
  * train: p = 0.95 ; test environments: ID (0.95), no correlation (0.5), reversed (0.1)

Prediction. A CNN recognizes 0 vs 1 almost perfectly, so the problem reduces to two
binary cues D and A that are conditionally independent given Y. The Bayes log-odds in an
environment with correlation r is  log(Q/(1-Q)) * D*Y-agreement + log(r/(1-r)) * A,
so the model follows whichever cue has the larger log-odds weight. With the alpha weights
the training distribution becomes the environment p_alpha = p - alpha (p - 1/2)
(see theory.py), hence a sharp switch at p_alpha = Q:
  * p_alpha > Q        : follow the marker  -> accuracy = p_test
  * 1-Q < p_alpha < Q  : follow the digit   -> accuracy = Q in every env
  * p_alpha < 1-Q      : follow -marker     -> accuracy = 1 - p_test

Usage (from the Project folder):
    python src/mnist_shortcut.py            # downloads MNIST (~11 MB) to data/mnist on first run
    python src/mnist_shortcut.py --quick    # 1 seed, 2 alphas, 2 epochs
"""
from __future__ import annotations

import argparse
import gzip
import time
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F

from theory import alpha_for_target, p_alpha

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "mnist"
URL = "https://ossci-datasets.s3.amazonaws.com/mnist/"
FILES = {"train_x": "train-images-idx3-ubyte.gz", "train_y": "train-labels-idx1-ubyte.gz",
         "test_x": "t10k-images-idx3-ubyte.gz", "test_y": "t10k-labels-idx1-ubyte.gz"}

ETA = 0.25          # label noise -> digit predicts Y with accuracy Q
Q = 1 - ETA
P_TRAIN = 0.95
TEST_ENVS = {"id": P_TRAIN, "no_corr": 0.5, "reversed": 0.1}
MARK_LO, MARK_HI, MARK = 0.25, 0.75, 4
VAL_FRAC = 0.1
EPOCHS, BATCH, LR = 10, 128, 1e-3


# ----------------------------------------------------------------------------- data
def _download():
    DATA.mkdir(parents=True, exist_ok=True)
    for f in FILES.values():
        if not (DATA / f).exists():
            print("downloading", f)
            urllib.request.urlretrieve(URL + f, DATA / f)


def _read(name):
    with gzip.open(DATA / FILES[name], "rb") as fh:
        raw = fh.read()
    if name.endswith("_x"):
        return np.frombuffer(raw, np.uint8, offset=16).reshape(-1, 28, 28).astype(np.float32) / 255.0
    return np.frombuffer(raw, np.uint8, offset=8).astype(np.int64)


def load_01():
    _download()
    out = {}
    for split in ("train", "test"):
        x, y = _read(f"{split}_x"), _read(f"{split}_y")
        keep = (y == 0) | (y == 1)
        out[split] = (x[keep], np.where(y[keep] == 1, 1, -1))
    return out


def make_env(x, digit, p, rng):
    """Add label noise and the corner marker. Returns images, Y, A (all numpy)."""
    flip = rng.random(len(digit)) < ETA
    y = np.where(flip, -digit, digit)
    a = np.where(rng.random(len(y)) < p, y, -y)
    img = x.copy()
    img[:, :MARK, :MARK] = np.where(a > 0, MARK_HI, MARK_LO)[:, None, None]
    return img, y, a


def group_weights(y, a, alpha):
    """w(alpha) = (1-alpha) + alpha * n / (4 n_g) over the four (Y, A) groups."""
    g = 2 * (y > 0) + (a > 0)
    counts = np.bincount(g, minlength=4)
    return (1 - alpha) + alpha * len(y) / (4.0 * counts[g])


# ----------------------------------------------------------------------------- model
class SmallCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.c1 = nn.Conv2d(1, 16, 3, padding=1)
        self.c2 = nn.Conv2d(16, 32, 3, padding=1)
        self.fc1 = nn.Linear(32 * 7 * 7, 64)
        self.fc2 = nn.Linear(64, 1)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)
        x = F.max_pool2d(F.relu(self.c2(x)), 2)
        return self.fc2(F.relu(self.fc1(x.flatten(1)))).squeeze(1)


def _t(x):
    return torch.from_numpy(np.ascontiguousarray(x))


def weighted_bce(logit, y01, w):
    return (w * F.binary_cross_entropy_with_logits(logit, y01, reduction="none")).sum() / w.sum()


@torch.no_grad()
def predict_logits(model, x):
    model.eval()
    return torch.cat([model(_t(x[i:i + 2048]).unsqueeze(1)) for i in range(0, len(x), 2048)])


def train(xtr, ytr, wtr, xva, yva, wva, seed, epochs=EPOCHS):
    """Adam; keep the epoch with the lowest alpha-weighted validation log loss."""
    torch.manual_seed(seed)
    model = SmallCNN()
    opt = torch.optim.Adam(model.parameters(), lr=LR)
    ytr01, yva01 = _t((ytr > 0).astype(np.float32)), _t((yva > 0).astype(np.float32))
    wtr_t, wva_t = _t(wtr.astype(np.float32)), _t(wva.astype(np.float32))
    xtr_t = _t(xtr).unsqueeze(1)
    best, best_state, gen = np.inf, None, torch.Generator().manual_seed(seed)
    for _ in range(epochs):
        model.train()
        perm = torch.randperm(len(ytr), generator=gen)
        for i in range(0, len(perm), BATCH):
            b = perm[i:i + BATCH]
            loss = weighted_bce(model(xtr_t[b]), ytr01[b], wtr_t[b])
            opt.zero_grad()
            loss.backward()
            opt.step()
        vl = weighted_bce(predict_logits(model, xva), yva01, wva_t).item()
        if vl < best:
            best, best_state = vl, {k: v.clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    return model, best


# ----------------------------------------------------------------------------- theory
def predicted_acc(pa, p_test, q=Q):
    """Accuracy of the Bayes rule of environment pa when tested in environment p_test.

    The two cues agree with Y independently: digit w.p. q, marker w.p. p_test.
    The rule predicts sign(c_q * d + c_pa * a) with d, a = +-1 agreement indicators.
    """
    cq, ca = np.log(q / (1 - q)), np.log(pa / (1 - pa))
    acc = 0.0
    for d, pd_ in ((1, q), (-1, 1 - q)):
        for a, pa_ in ((1, p_test), (-1, 1 - p_test)):
            s = cq * d + ca * a
            acc += pd_ * pa_ * (1.0 if s > 0 else (0.5 if s == 0 else 0.0))
    return acc


# ----------------------------------------------------------------------------- experiment
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()

    alpha_star = round(alpha_for_target(P_TRAIN, 0.1), 4)
    alphas = [0.0, 1.0] if args.quick else [0.0, 0.25, 0.4, 0.5, 0.75, 1.0, 1.5, alpha_star]
    seeds = [0] if args.quick else [0, 1, 2]
    epochs = 2 if args.quick else EPOCHS
    torch.set_num_threads(max(1, torch.get_num_threads()))

    data = load_01()
    xtr_all, dtr_all = data["train"]
    xte, dte = data["test"]
    rows, t0 = [], time.time()
    for seed in seeds:
        rng = np.random.default_rng([seed, 4])
        perm = rng.permutation(len(dtr_all))
        n_val = int(VAL_FRAC * len(perm))
        va_idx, tr_idx = perm[:n_val], perm[n_val:]
        xtr, ytr, atr = make_env(xtr_all[tr_idx], dtr_all[tr_idx], P_TRAIN, rng)
        xva, yva, ava = make_env(xtr_all[va_idx], dtr_all[va_idx], P_TRAIN, rng)
        tests = {env: make_env(xte, dte, pt, np.random.default_rng([seed, 5, round(pt * 100)]))
                 for env, pt in TEST_ENVS.items()}
        for alpha in alphas:
            model, vl = train(xtr, ytr, group_weights(ytr, atr, alpha),
                              xva, yva, group_weights(yva, ava, alpha), seed, epochs)
            pa = p_alpha(P_TRAIN, alpha)
            for env, (x, y, a) in tests.items():
                pred = np.where(predict_logits(model, x).numpy() > 0, 1, -1)
                correct = pred == y
                g = 2 * (y > 0) + (a > 0)
                wga = min(correct[g == k].mean() for k in range(4))
                agree_marker = np.mean(pred == a)
                rows.append({"seed": seed, "alpha": alpha, "p_alpha": pa, "env": env, "p_test": TEST_ENVS[env],
                             "acc": correct.mean(), "worst_group_acc": wga, "pred_agrees_marker": agree_marker,
                             "val_loss": vl, "theory_acc": predicted_acc(pa, TEST_ENVS[env])})
            print(f"seed {seed} alpha {alpha:.3f} (p_alpha {pa:.3f}) done, {time.time() - t0:.0f}s", flush=True)

    df = pd.DataFrame(rows)
    out = ROOT / "results" / ("e4_mnist_quick.csv" if args.quick else "e4_mnist.csv")
    out.parent.mkdir(exist_ok=True)
    df.to_csv(out, index=False)
    s = df.groupby(["alpha", "env"]).agg(acc=("acc", "mean"), sd=("acc", "std"), theory=("theory_acc", "first"))
    print(s.unstack("env").round(3).to_string())
    print("wrote", out)


if __name__ == "__main__":
    main()
