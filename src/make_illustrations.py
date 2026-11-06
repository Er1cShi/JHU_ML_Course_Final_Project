"""Illustrations for the report and slides (no experiment results).

  fig0_data_scatter : synthetic data, training env (p=0.95) vs reversed test env (p=0.1)
  fig0_mnist_examples: MNIST 0/1 with the corner marker, one row per (Y, A) group
  fig0_pipeline     : code architecture / experiment pipeline

Usage (from the repository root):  python src/make_illustrations.py
"""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

from analysis import FIG, INK, MUTED, save
from data import sample
from theory import c_p

BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"


def fig_data_scatter():
    fig, axes = plt.subplots(1, 2, figsize=(6.4, 2.9), sharex=True, sharey=True)
    for ax, (p, title) in zip(axes, [(0.95, "training env, $p$=0.95"), (0.1, "reversed test env, $p$=0.1")]):
        d = sample(1500, p, np.random.default_rng(3))
        for yv, col, lab in ((-1, ORANGE, "$Y=-1$"), (1, BLUE, "$Y=+1$")):
            m = d.y == yv
            ax.scatter(d.X[m, 0], d.X[m, 1], s=5, color=col, alpha=0.5, linewidth=0, label=lab)
        # sign-approximate Bayes rule of the training env: 2 xs + c_p sign(xz) = 0
        c = c_p(0.95)
        ax.plot([c / 2, c / 2], [-1.8, 0], color=INK, lw=1.2)
        ax.plot([-c / 2, -c / 2], [0, 1.8], color=INK, lw=1.2)
        ax.plot([-c / 2, c / 2], [0, 0], color=INK, lw=1.2, label="ERM boundary (trained at $p$=0.95)")
        ax.set_title(title)
        ax.set_xlabel("stable feature $x_s$")
        ax.set_xlim(-4, 4); ax.set_ylim(-1.8, 1.8)
    axes[0].set_ylabel("shortcut feature $x_z$")
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h, l, loc="upper center", ncol=3, frameon=False, bbox_to_anchor=(0.5, 1.1), markerscale=3)
    save(fig, "fig0_data_scatter")


def fig_mnist_examples():
    from mnist_shortcut import load_01, make_env

    x, digit = load_01()["train"]
    rng = np.random.default_rng(0)
    img, y, a = make_env(x, digit, 0.95, rng)
    groups = [(1, 1, "label 1, dark marker"), (-1, -1, "label 0, light marker"),
              (1, -1, "label 1, light marker"), (-1, 1, "label 0, dark marker")]
    n_per = 6
    fig, axes = plt.subplots(len(groups), n_per, figsize=(5.2, 3.9))
    for r, (yv, av, name) in enumerate(groups):
        idx = np.flatnonzero((y == yv) & (a == av))
        share = len(idx) / len(y)
        for c in range(n_per):
            ax = axes[r, c]
            ax.imshow(img[idx[c]], cmap="gray_r", vmin=0, vmax=1)
            ax.add_patch(Rectangle((-0.5, -0.5), 4, 4, fill=False, edgecolor=BLUE, lw=1))
            ax.set_xticks([]); ax.set_yticks([])
            for s in ax.spines.values():
                s.set_visible(False)
            # show when the observed label disagrees with the digit (25% label noise)
            if digit[idx[c]] != yv:
                ax.set_xlabel("noisy label", fontsize=6, color=ORANGE, labelpad=1)
        axes[r, 0].set_ylabel(f"{name}\n{share:.1%} of train", fontsize=7, rotation=0, ha="right", va="center")
    fig.text(0.5, 0.01, "4x4 corner marker (blue box): dark if A=+1, light if A=-1. Train: marker agrees with label "
             "95% of the time; 25% of labels flipped.", ha="center", fontsize=6.5, color=MUTED)
    save(fig, "fig0_mnist_examples")


def _box(ax, xy, w, h, text, fc, ec=INK, fs=7.5, bold=False):
    ax.add_patch(FancyBboxPatch(xy, w, h, boxstyle="round,pad=0.02,rounding_size=0.06", fc=fc, ec=ec, lw=0.9))
    ax.text(xy[0] + w / 2, xy[1] + h / 2, text, ha="center", va="center", fontsize=fs,
            fontweight="bold" if bold else "normal", color=INK)
    return (xy[0], xy[1], w, h)


def _arrow(ax, a, b, color=MUTED):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=9, color=color, lw=1))


def fig_pipeline():
    fig, ax = plt.subplots(figsize=(7.4, 3.4))
    ax.set_xlim(0, 10.2); ax.set_ylim(0, 4.6); ax.axis("off")
    code, out, th = "#e3ecfa", "#eef1f5", "#fbefdc"
    fs = 6.8
    # row 1: synthetic pipeline
    _box(ax, (0.1, 3.3), 1.6, 0.8, "data.py\ngenerator, seeds", code, fs=fs)
    _box(ax, (2.0, 3.3), 1.9, 0.8, "models.py\nERM / GB / stable\nw($\\alpha$), select C", code, fs=fs)
    _box(ax, (4.2, 3.3), 1.6, 0.8, "metrics.py\naccuracy,\nworst group", code, fs=fs)
    _box(ax, (6.1, 3.3), 2.1, 0.8, "run_experiments.py\nE1/E2 (default)\nE3 (--e3)", code, fs=fs)
    _box(ax, (8.6, 3.3), 1.5, 0.8, "results.csv\ne3_alpha.csv", out, fs=fs)
    for x0, x1 in ((1.7, 2.0), (3.9, 4.2), (5.8, 6.1), (8.2, 8.6)):
        _arrow(ax, (x0, 3.7), (x1, 3.7))
    # row 2: theory
    _box(ax, (2.0, 1.9), 3.8, 0.8, "theory.py\nBayes rule, linear optimum, $p_\\alpha$, $\\alpha^*$", th, fs=fs)
    _arrow(ax, (5.2, 2.7), (6.6, 3.3))
    _box(ax, (0.1, 1.9), 1.6, 0.8, "check_data.py\nMonte Carlo\ncheck", code, fs=fs)
    _arrow(ax, (1.7, 2.3), (2.0, 2.3))
    # row 3: MNIST
    _box(ax, (0.1, 0.4), 1.6, 0.8, "MNIST 0/1\n(downloaded)", out, fs=fs)
    _box(ax, (2.0, 0.4), 3.8, 0.8, "mnist_shortcut.py\nlabel noise + corner marker, small CNN, w($\\alpha$)", code, fs=fs)
    _box(ax, (6.1, 0.4), 2.1, 0.8, "e4_mnist.csv", out, fs=fs)
    _arrow(ax, (1.7, 0.8), (2.0, 0.8)); _arrow(ax, (5.8, 0.8), (6.1, 0.8))
    _arrow(ax, (3.9, 1.9), (3.9, 1.2))
    # analysis
    _box(ax, (8.6, 1.4), 1.5, 1.3, "analysis.py\ntables,\nbootstrap CIs,\nfigures 1-6", code, fs=fs)
    _arrow(ax, (9.35, 3.3), (9.35, 2.7)); _arrow(ax, (8.2, 0.8), (8.8, 1.4)); _arrow(ax, (5.8, 2.3), (8.6, 2.05))
    ax.text(0.1, 4.4, "code", color=INK, fontsize=7, bbox=dict(fc=code, ec="none"))
    ax.text(0.7, 4.4, "theory", color=INK, fontsize=7, bbox=dict(fc=th, ec="none"))
    ax.text(1.45, 4.4, "data / outputs", color=INK, fontsize=7, bbox=dict(fc=out, ec="none"))
    save(fig, "fig0_pipeline")


if __name__ == "__main__":
    fig_data_scatter()
    fig_mnist_examples()
    fig_pipeline()
    print("wrote", sorted(p.name for p in Path(FIG).glob("fig0_*")))
