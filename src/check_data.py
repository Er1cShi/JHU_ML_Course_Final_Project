"""Sanity checks for data.py and theory.py (Monte Carlo vs closed form)."""
import numpy as np

from data import P_TRAIN, SEEDS, group_counts, make_test_envs, make_train_val
from theory import acc_bayes_exact, g

for p in P_TRAIN:
    pool, val, rej = make_train_val(p, seed=0)
    emp_p = np.mean(pool.a == pool.y)
    print(f"p={p:.2f}: empirical P(A=Y)={emp_p:.3f}, groups(n=500)={group_counts(pool.subset(500))}, rejected={rej}")
    for name, d in make_test_envs(p, seed=0).items():
        pred = np.sign(2 * d.X[:, 0] + g(d.X[:, 1], p))
        mc = np.mean(pred == d.y)
        print(f"   {name:>8}: Bayes MC acc={mc:.4f}  exact={acc_bayes_exact(p, np.mean(d.a == d.y)):.4f}")

n_rej = sum(len(make_train_val(p, s)[2]) for p in P_TRAIN for s in SEEDS)
print("total rejected draws over all (p, seed):", n_rej)
