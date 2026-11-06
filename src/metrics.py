"""Evaluation metrics on one test environment."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import log_loss

from data import Dataset

GROUP_NAMES = ("y-1_a-1", "y-1_a+1", "y+1_a-1", "y+1_a+1")


def evaluate(model, d: Dataset) -> dict[str, float]:
    p = model.predict_proba(d.X)
    pred = np.where(p >= 0.5, 1, -1)
    correct = pred == d.y
    out = {
        "acc": float(correct.mean()),
        "log_loss": float(log_loss(d.y, p, labels=[-1, 1])),
        "p_test_empirical": float(np.mean(d.a == d.y)),
    }
    g = d.group
    accs = []
    for k, name in enumerate(GROUP_NAMES):
        mask = g == k
        out[f"n_{name}"] = int(mask.sum())
        a = float(correct[mask].mean()) if mask.any() else np.nan
        out[f"acc_{name}"] = a
        if mask.any():
            accs.append(a)
    out["worst_group_acc"] = float(min(accs))
    return out
