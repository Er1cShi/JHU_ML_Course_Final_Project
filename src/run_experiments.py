"""Experiments E1/E2: 3 p_train x 3 n x 3 methods x 10 seeds, each evaluated on 3 test envs.

Usage (from the Project folder):
    python src/run_experiments.py --quick        # one setting: p=0.95, n=2000, seed=0
    python src/run_experiments.py                # full grid -> results/results.csv
    python src/run_experiments.py --e3           # alpha interpolation -> results/e3_alpha.csv
"""
from __future__ import annotations

import argparse
import time
from itertools import product
from pathlib import Path

import pandas as pd

from data import N_TRAIN, P_TRAIN, SEEDS, group_counts, make_test_envs, make_train_val
from metrics import evaluate
from models import METHODS, fit_select
from theory import Phi, acc_bayes_exact, acc_linear, linear_population_coef

ENV_P = {"no_corr": 0.5, "reversed": 0.1}
_POP = {}


def theory_acc(method: str, p: float, p_test: float) -> float:
    """Large-sample prediction for each method.

    erm: population linear-logistic minimizer of the training env, evaluated exactly.
    group_balanced / stable_only: reweighting makes A independent of Y, so the
    population optimum ignores xz and the accuracy is Phi(1) in every env.
    """
    if method != "erm":
        return Phi(1.0)
    if p not in _POP:
        _POP[p] = linear_population_coef(p)
    return acc_linear(*_POP[p], p_test)

ROOT = Path(__file__).resolve().parents[1]


def run(p_list, n_list, seeds, methods):
    rows, cand_rows = [], []
    for p in p_list:
        for seed in seeds:
            pool, val, rejected = make_train_val(p, seed)
            tests = make_test_envs(p, seed)
            for n in n_list:
                train = pool.subset(n)
                gc = group_counts(train)
                for method in methods:
                    model, cands = fit_select(method, train, val)
                    for c in cands:
                        cand_rows.append({"p_train": p, "n": n, "seed": seed, "method": method, **c})
                    for env, d in tests.items():
                        rows.append({
                            "p_train": p, "n": n, "seed": seed, "method": method, "env": env,
                            "C": model.C, "converged": model.converged, "n_iter": model.n_iter,
                            "val_log_loss": model.val_log_loss, "rejected_draws": len(rejected),
                            **{f"train_n_g{k}": int(v) for k, v in enumerate(gc)},
                            **model.coef(),
                            **evaluate(model, d),
                            "theory_acc": theory_acc(method, p, ENV_P.get(env, p)),
                            "bayes_trainenv_acc": acc_bayes_exact(p, ENV_P.get(env, p)),
                        })
    return pd.DataFrame(rows), pd.DataFrame(cand_rows)


ALPHAS = (0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5)
N_E3 = (500, 8000)


def run_e3(p_list=P_TRAIN, n_list=N_E3, seeds=SEEDS):
    """E3: interpolated weights w(alpha); alpha grid plus the alpha that targets p_test = 0.1."""
    from theory import alpha_for_target, p_alpha

    rows = []
    for p in p_list:
        alphas = sorted(set(ALPHAS) | {round(alpha_for_target(p, 0.1), 4)})
        for seed in seeds:
            pool, val, _ = make_train_val(p, seed)
            tests = make_test_envs(p, seed)
            for n in n_list:
                train = pool.subset(n)
                for a, wv in product(alphas, (False, True)):
                    model, _ = fit_select("erm", train, val, alpha=a, weighted_val=wv)
                    pa = p_alpha(p, a)
                    if pa not in _POP:
                        _POP[pa] = linear_population_coef(pa)
                    for env, d in tests.items():
                        rows.append({"p_train": p, "n": n, "seed": seed, "alpha": a, "p_alpha": pa, "env": env,
                                     "val_selection": "weighted" if wv else "unweighted",
                                     "C": model.C, "converged": model.converged, **model.coef(),
                                     **evaluate(model, d),
                                     "theory_acc": acc_linear(*_POP[pa], ENV_P.get(env, p))})
    return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="only p=0.95, n=2000, seed=0")
    ap.add_argument("--e3", action="store_true", help="run E3 (alpha interpolation) -> results/e3_alpha.csv")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    t0 = time.time()
    if args.e3:
        df = run_e3()
        out = ROOT / "results" / "e3_alpha.csv"
        out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(out, index=False)
        print(f"wrote {len(df)} rows to {out}; non-converged: {(~df.converged).sum()}")
    elif args.quick:
        df, cands = run([0.95], [2000], [0], METHODS)
        cols = ["method", "env", "C", "acc", "theory_acc", "worst_group_acc", "log_loss", "coef_xs", "coef_xz", "converged"]
        pd.set_option("display.width", 160)
        print(df[cols].round(4).to_string(index=False))
    else:
        df, cands = run(P_TRAIN, N_TRAIN, SEEDS, METHODS)
        out = Path(args.out) if args.out else ROOT / "results" / "results.csv"
        out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(out, index=False)
        cands.to_csv(out.with_name("candidates.csv"), index=False)
        print(f"wrote {len(df)} rows to {out}; non-converged fits: {(~cands.converged).sum()}")
    print(f"elapsed {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
