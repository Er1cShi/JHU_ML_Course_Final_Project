"""Statistics and figures from results/results.csv.

Usage (from the Project folder):  python src/analysis.py
Outputs: results/summary.csv, results/paired_diffs.csv, figures/*.pdf (+ .png previews)
"""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from data import N_TRAIN, P_TRAIN
from theory import Phi, acc_linear, alpha_for_target, alpha_max, c_p, linear_population_coef, p_alpha

ROOT = Path(__file__).resolve().parents[1]
RES, FIG = ROOT / "results", ROOT / "figures"
ENVS = ["id", "no_corr", "reversed"]
ENV_LABEL = {"id": "In-distribution ($p_{test}=p_{train}$)", "no_corr": "No correlation ($p_{test}=0.5$)",
             "reversed": "Reversed ($p_{test}=0.1$)"}
METHOD_LABEL = {"erm": "ERM", "group_balanced": "Group balanced", "stable_only": "Stable only"}
METHOD_COLOR = {"erm": "#2a78d6", "group_balanced": "#eb6834", "stable_only": "#1baf7a"}
METHOD_MARKER = {"erm": "o", "group_balanced": "s", "stable_only": "^"}
P_COLOR = {0.60: "#9cc3ef", 0.80: "#4f8fdc", 0.95: "#16457f"}  # one hue, light -> dark = weak -> strong shortcut
INK, MUTED = "#0b0b0b", "#52514e"
N_BOOT = 2000

plt.rcParams.update({
    "font.size": 9, "axes.titlesize": 9, "axes.labelsize": 9, "legend.fontsize": 8,
    "axes.spines.top": False, "axes.spines.right": False, "axes.edgecolor": MUTED,
    "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.grid": True, "grid.color": "#e6e5e0", "grid.linewidth": 0.6, "lines.linewidth": 2,
    "savefig.bbox": "tight", "pdf.fonttype": 42,
})


def save(fig, name):
    FIG.mkdir(exist_ok=True)
    fig.savefig(FIG / f"{name}.pdf")
    fig.savefig(FIG / f"{name}.png", dpi=200)
    plt.close(fig)


def bootstrap_ci(x: np.ndarray, rng, n_boot=N_BOOT):
    idx = rng.integers(0, len(x), size=(n_boot, len(x)))
    m = x[idx].mean(axis=1)
    return np.percentile(m, 2.5), np.percentile(m, 97.5)


def tables(df):
    summ = (df.groupby(["p_train", "n", "method", "env"])
              .agg(acc_mean=("acc", "mean"), acc_std=("acc", "std"),
                   wga_mean=("worst_group_acc", "mean"), wga_std=("worst_group_acc", "std"),
                   logloss_mean=("log_loss", "mean"), raw_xz_mean=("raw_xz", "mean"),
                   theory_acc=("theory_acc", "first"))
              .reset_index())
    summ.to_csv(RES / "summary.csv", index=False)

    rng = np.random.default_rng(0)
    key = ["p_train", "n", "seed", "env"]
    base = df[df.method == "erm"].set_index(key)
    rows = []
    for m in ["group_balanced", "stable_only"]:
        other = df[df.method == m].set_index(key)
        for metric in ["acc", "worst_group_acc"]:
            diff = (other[metric] - base[metric]).reset_index()
            for (p, n, env), g in diff.groupby(["p_train", "n", "env"]):
                x = g[metric].to_numpy()
                lo, hi = bootstrap_ci(x, rng)
                rows.append({"comparison": f"{m} - erm", "metric": metric, "p_train": p, "n": n, "env": env,
                             "mean_diff": x.mean(), "sd_diff": x.std(ddof=1), "ci_lo": lo, "ci_hi": hi,
                             "n_seeds": len(x)})
    pd.DataFrame(rows).to_csv(RES / "paired_diffs.csv", index=False)
    return summ


def fig_n_effect(summ):
    """Accuracy vs n: more data does not repair OOD accuracy for ERM."""
    fig, axes = plt.subplots(1, 3, figsize=(7.0, 2.4), sharey=True)
    for ax, env in zip(axes, ENVS):
        for p in P_TRAIN:
            s = summ[(summ.method == "erm") & (summ.env == env) & (summ.p_train == p)].sort_values("n")
            ax.errorbar(s.n, s.acc_mean, yerr=s.acc_std, color=P_COLOR[p], marker="o", ms=4, capsize=2,
                        label=f"ERM, $p_{{train}}$={p:.2f}")
            ax.axhline(s.theory_acc.iloc[0], color=P_COLOR[p], ls="--", lw=1)
        s = summ[(summ.method == "group_balanced") & (summ.env == env) & (summ.p_train == 0.95)].sort_values("n")
        ax.errorbar(s.n, s.acc_mean, yerr=s.acc_std, color=METHOD_COLOR["group_balanced"], marker="s", ms=4,
                    capsize=2, label="Group balanced, $p_{train}$=0.95")
        ax.axhline(Phi(1), color=MUTED, ls=":", lw=1)
        ax.set_xscale("log")
        ax.set_xticks(N_TRAIN, [str(n) for n in N_TRAIN])
        ax.minorticks_off()
        ax.set_title(ENV_LABEL[env])
        ax.set_xlabel("training samples $n$")
    axes[0].set_ylabel("test accuracy")
    axes[0].set_ylim(0.3, 1.0)
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h, l, loc="upper center", ncol=4, frameon=False, bbox_to_anchor=(0.5, 1.12))
    fig.text(0.5, -0.14, "dashed: large-sample theory for ERM;  dotted: $\\Phi(1)=0.841$ (stable-only optimum)",
             ha="center", color=MUTED, fontsize=8)
    save(fig, "fig1_n_effect")


def fig_theory_surface(summ):
    """Left: theoretical ERM accuracy over (p_train, p_test). Right: experiment vs theory."""
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.2, 2.9), gridspec_kw={"width_ratios": [1.25, 1], "wspace": 0.45})
    pt_grid = np.linspace(0.51, 0.99, 49)
    pe_grid = np.linspace(0.0, 1.0, 51)
    Z = np.empty((len(pe_grid), len(pt_grid)))
    for j, p in enumerate(pt_grid):
        b = (0.0, 2.0, c_p(p))  # sign-approximation coefficients; exact linear optimum is within 0.05
        for i, pe in enumerate(pe_grid):
            Z[i, j] = acc_linear(*b, pe)
    im = a1.pcolormesh(pt_grid, pe_grid, Z, cmap="Blues", vmin=0.2, vmax=1.0, shading="auto")
    cs = a1.contour(pt_grid, pe_grid, Z, levels=[Phi(1)], colors=[METHOD_COLOR["group_balanced"]], linewidths=1.5)
    a1.text(0.53, 0.98, "orange: ERM = stable-only (0.841);\nbelow it, group balancing wins", fontsize=7,
            color="white", va="top")
    for p in P_TRAIN:
        for pe in (p, 0.5, 0.1):
            a1.plot(p, pe, "o", ms=5, mfc="white", mec=INK, mew=1)
    a1.set_xlabel("training correlation $p_{train}$")
    a1.set_ylabel("test correlation $p_{test}$")
    a1.set_title("Theory: ERM accuracy (dots = tested settings)")
    a1.grid(False)
    fig.colorbar(im, ax=a1, label="accuracy", shrink=0.9)

    for m in ["erm", "group_balanced", "stable_only"]:
        s = summ[summ.method == m]
        a2.scatter(s.theory_acc, s.acc_mean, s=16, marker=METHOD_MARKER[m], color=METHOD_COLOR[m],
                   edgecolor="white", linewidth=0.6, label=METHOD_LABEL[m], zorder=3)
    lims = [0.3, 1.0]
    a2.plot(lims, lims, color=MUTED, lw=1, ls="--", zorder=1)
    a2.set_xlim(lims); a2.set_ylim(lims)
    a2.set_xlabel("predicted accuracy (theory)")
    a2.set_ylabel("measured accuracy (mean of 10 seeds)")
    a2.set_title("Experiment vs theory (81 settings)")
    a2.legend(frameon=False, loc="upper left")
    save(fig, "fig2_theory_surface")


def fig_tradeoff(summ):
    """Average accuracy vs worst-group accuracy on the ID test set (n = 8000)."""
    fig, ax = plt.subplots(figsize=(3.4, 2.8))
    s = summ[(summ.env == "id") & (summ.n == 8000)]
    for m in ["erm", "group_balanced", "stable_only"]:
        t = s[s.method == m]
        ax.scatter(t.acc_mean, t.wga_mean, s=36, marker=METHOD_MARKER[m], color=METHOD_COLOR[m],
                   edgecolor="white", linewidth=0.8, label=METHOD_LABEL[m], zorder=3)
        if m == "erm":
            for _, r in t.iterrows():
                ax.annotate(f"$p$={r.p_train:.2f}", (r.acc_mean, r.wga_mean), xytext=(4, -10),
                            textcoords="offset points", fontsize=7, color=MUTED)
    ax.set_xlim(0.83, 0.98)
    ax.set_xlabel("average accuracy (ID)")
    ax.set_ylabel("worst-group accuracy (ID)")
    ax.set_title("Average vs worst group, $n$=8000")
    ax.legend(frameon=False, loc="lower left")
    save(fig, "fig3_tradeoff")


def fig_coef(df):
    """Raw-unit shortcut coefficient learned by ERM vs n, against c_p and the population optimum."""
    fig, ax = plt.subplots(figsize=(3.4, 2.6))
    e = df[(df.method == "erm") & (df.env == "id")]
    g = e.groupby(["p_train", "n"]).raw_xz.agg(["mean", "std"]).reset_index()
    for p in P_TRAIN:
        t = g[g.p_train == p]
        ax.errorbar(t.n, t["mean"], yerr=t["std"], color=P_COLOR[p], marker="o", ms=4, capsize=2,
                    label=f"$p_{{train}}$={p:.2f}")
        ax.axhline(c_p(p), color=P_COLOR[p], ls=":", lw=1)
        ax.axhline(linear_population_coef(p)[2], color=P_COLOR[p], ls="--", lw=1)
    ax.set_xscale("log"); ax.set_xticks(N_TRAIN, [str(n) for n in N_TRAIN]); ax.minorticks_off()
    ax.set_xlabel("training samples $n$")
    ax.set_ylabel("ERM weight on $x_z$ (raw units)")
    ax.legend(frameon=False, loc="lower center", ncol=3, bbox_to_anchor=(0.5, 1.08), fontsize=7)
    fig.text(0.5, -0.1, "dotted: Bayes $c_p=\\log\\frac{p}{1-p}$;  dashed: linear population optimum",
             ha="center", color=MUTED, fontsize=7)
    save(fig, "fig4_coef")


def fig_frontier(e3):
    """E3: closed-form ID-vs-reversed frontier traced by alpha, with measured points."""
    fig, axes = plt.subplots(1, 3, figsize=(7.0, 2.6), sharey=True)
    e3 = e3[e3.val_selection == "weighted"]
    for ax, p in zip(axes, P_TRAIN):
        a_grid = np.linspace(0, alpha_max(p) * 0.98, 25)
        coefs = [linear_population_coef(p_alpha(p, a), n_mc=400_000) for a in a_grid]
        ax.plot([acc_linear(*b, p) for b in coefs], [acc_linear(*b, 0.1) for b in coefs], color=MUTED, lw=1.2,
                label="theory (population optimum)", zorder=1)
        for n, col, mk in ((500, "#9cc3ef", "o"), (8000, "#16457f", "o")):
            g = e3[(e3.p_train == p) & (e3.n == n)].pivot_table(index=["alpha", "seed"], columns="env", values="acc")
            m = g.groupby("alpha").mean()
            ax.scatter(m["id"], m["reversed"], s=18, color=col, edgecolor="white", linewidth=0.6, zorder=3,
                       label=f"measured, $n$={n}")
        named = {0.0: "ERM", 1.0: "GB", round(alpha_for_target(p, 0.1), 4): "$\\alpha^*$"}
        for a, lab in named.items():
            b = linear_population_coef(p_alpha(p, a), n_mc=400_000)
            ax.annotate(lab, (acc_linear(*b, p), acc_linear(*b, 0.1)), xytext=(5, 3), textcoords="offset points",
                        fontsize=7, color=INK)
        ax.set_title(f"$p_{{train}}$={p:.2f}")
        ax.set_xlabel("ID accuracy")
    axes[0].set_ylabel("reversed-env accuracy ($p_{test}$=0.1)")
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h, l, loc="upper center", ncol=3, frameon=False, bbox_to_anchor=(0.5, 1.1))
    fig.text(0.5, -0.15, "weights $w(\\alpha)=(1-\\alpha)+\\alpha\\,n/(4n_g)$;  GB: $\\alpha$=1;  "
             "$\\alpha^*=(p-p_{test})/(p-1/2)$ targets $p_{test}$=0.1", ha="center", color=MUTED, fontsize=7)
    save(fig, "fig5_frontier")


def e3_tables(e3):
    g = (e3.groupby(["val_selection", "p_train", "n", "alpha", "env"])
           .agg(acc_mean=("acc", "mean"), acc_std=("acc", "std"), wga_mean=("worst_group_acc", "mean"),
                theory_acc=("theory_acc", "first"), C_median=("C", "median")).reset_index())
    g.to_csv(RES / "e3_summary.csv", index=False)
    err = (g.acc_mean - g.theory_acc).abs()
    print("E3 |measured - theory| by validation rule:")
    print(err.groupby([g.val_selection, g.n]).agg(["mean", "max"]).round(4).to_string())


def fig_mnist(e4):
    """E4: MNIST + corner marker, accuracy vs alpha against the two-cue prediction."""
    from mnist_shortcut import P_TRAIN as P_M, Q, TEST_ENVS, predicted_acc

    env_color = {"id": "#2a78d6", "no_corr": "#eb6834", "reversed": "#1baf7a"}
    fig, ax = plt.subplots(figsize=(5.2, 2.8))
    a_grid = np.linspace(0, alpha_max(P_M) * 0.999, 600)
    g = e4.groupby(["alpha", "env"]).acc.agg(["mean", "std"]).reset_index()
    for env, pt in TEST_ENVS.items():
        ax.plot(a_grid, [predicted_acc(p_alpha(P_M, a), pt) for a in a_grid], color=env_color[env], lw=1,
                ls="--", zorder=1)
        t = g[g.env == env]
        ax.errorbar(t.alpha, t["mean"], yerr=t["std"], color=env_color[env], marker="o", ms=4, lw=0,
                    elinewidth=1, capsize=2, label=ENV_LABEL[env].split(" (")[0] + f" ($p_{{test}}$={pt})", zorder=3)
    for pa in (Q, 1 - Q):
        ax.axvline((P_M - pa) / (P_M - 0.5), color=MUTED, lw=0.8, ls=":")
    ax.set_xlabel("reweighting strength $\\alpha$  (0 = ERM, 1 = group balanced)")
    ax.set_ylabel("test accuracy")
    ax.legend(frameon=False, fontsize=7, loc="lower center", ncol=3, bbox_to_anchor=(0.5, 1.1))
    fig.text(0.5, -0.1, "dashed: predicted switch at $p_\\alpha=0.75$ and $p_\\alpha=0.25$ (dotted lines);  "
             "points: CNN, mean $\\pm$ sd over 3 seeds", ha="center", color=MUTED, fontsize=7)
    save(fig, "fig6_mnist")


def main():
    df = pd.read_csv(RES / "results.csv")
    summ = tables(df)
    fig_n_effect(summ)
    fig_theory_surface(summ)
    fig_tradeoff(summ)
    fig_coef(df)
    if (RES / "e3_alpha.csv").exists():
        e3 = pd.read_csv(RES / "e3_alpha.csv")
        e3_tables(e3)
        fig_frontier(e3)
    if (RES / "e4_mnist.csv").exists():
        fig_mnist(pd.read_csv(RES / "e4_mnist.csv"))
    err = (summ.acc_mean - summ.theory_acc).abs()
    print(f"settings: {len(summ)}; |measured - theory| mean {err.mean():.4f}, max {err.max():.4f}")
    print("wrote results/summary.csv, results/paired_diffs.csv, figures/fig1-4")


if __name__ == "__main__":
    main()
