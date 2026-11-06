"""Synthetic data generator for the shortcut-learning experiments.

Generative model (all environments share the same Y -> Xs mechanism):
    Y  ~ Uniform{-1, +1}
    Xs = Y + eps_s,            eps_s ~ N(0, 1)        (stable feature)
    A  = Y w.p. p, else -Y                            (shortcut attribute)
    Xz = A + 0.2 * eps_z,      eps_z ~ N(0, 1)        (unstable / shortcut feature)

Only the correlation p = P(A = Y) changes across environments.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

SIGMA_S = 1.0
SIGMA_Z = 0.2

P_TRAIN = (0.60, 0.80, 0.95)
N_TRAIN = (500, 2000, 8000)
N_VAL = 2000
N_TEST = 10000
P_TEST_SHIFT = {"no_corr": 0.50, "reversed": 0.10}
SEEDS = tuple(range(10))

# Purpose tags keep the random streams for train / val / test independent.
_TRAIN, _VAL, _TEST = 0, 1, 2


@dataclass
class Dataset:
    X: np.ndarray  # shape (n, 2), columns [Xs, Xz]
    y: np.ndarray  # shape (n,), values in {-1, +1}
    a: np.ndarray  # shape (n,), values in {-1, +1}

    def __len__(self) -> int:
        return len(self.y)

    def subset(self, n: int) -> "Dataset":
        return Dataset(self.X[:n], self.y[:n], self.a[:n])

    @property
    def group(self) -> np.ndarray:
        """Group id in {0,1,2,3} for (Y, A) = (-1,-1), (-1,+1), (+1,-1), (+1,+1)."""
        return 2 * (self.y > 0) + (self.a > 0)


def sample(n: int, p: float, rng: np.random.Generator) -> Dataset:
    """Draw n i.i.d. samples from the environment with P(A = Y) = p."""
    y = rng.choice(np.array([-1, 1]), size=n)
    agree = rng.random(n) < p
    a = np.where(agree, y, -y)
    xs = y + SIGMA_S * rng.standard_normal(n)
    xz = a + SIGMA_Z * rng.standard_normal(n)
    return Dataset(np.column_stack([xs, xz]).astype(float), y, a)


def _rng(seed: int, p: float, purpose: int, attempt: int = 0) -> np.random.Generator:
    return np.random.default_rng([seed, round(p * 100), purpose, attempt])


def group_counts(d: Dataset) -> np.ndarray:
    return np.bincount(d.group, minlength=4)


def make_train_val(p: float, seed: int, n_max: int = max(N_TRAIN), max_attempts: int = 20):
    """Training pool of size n_max plus a validation set from the same environment.

    Smaller training sets are nested prefixes of the pool (pool.subset(n)).
    A draw is rejected if any (Y, A) group is empty in the smallest training
    subset or in the validation set; rejected attempts are returned so they
    can be logged.
    """
    rejected = []
    for attempt in range(max_attempts):
        pool = sample(n_max, p, _rng(seed, p, _TRAIN, attempt))
        val = sample(N_VAL, p, _rng(seed, p, _VAL, attempt))
        if (group_counts(pool.subset(min(N_TRAIN))) > 0).all() and (group_counts(val) > 0).all():
            return pool, val, rejected
        rejected.append(attempt)
    raise RuntimeError(f"empty group after {max_attempts} attempts (p={p}, seed={seed})")


def make_test_envs(p_train: float, seed: int) -> dict[str, Dataset]:
    """Three test environments of N_TEST samples: ID, no correlation, reversed."""
    envs = {"id": p_train, **P_TEST_SHIFT}
    return {name: sample(N_TEST, pt, _rng(seed, pt, _TEST)) for name, pt in envs.items()}
