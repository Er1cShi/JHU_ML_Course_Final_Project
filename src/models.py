"""Model fitting for the three compared methods.

M1 erm            : standardize (Xs, Xz) on training data, L2 logistic regression
M2 group_balanced : same as M1 but sample weights n / (4 n_g) over the four (Y, A) groups
M3 stable_only    : same as M1 but only Xs is used (diagnostic reference)

For each method, C is chosen from C_GRID by unweighted log loss on the
in-distribution validation set; the threshold is fixed at 0.5.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from sklearn.preprocessing import StandardScaler

from data import Dataset, group_counts

METHODS = ("erm", "group_balanced", "stable_only")
C_GRID = (0.01, 0.1, 1.0, 10.0, 100.0)
MAX_ITER = 1000
TOL = 1e-6


def feature_cols(method: str) -> list[int]:
    return [0] if method == "stable_only" else [0, 1]


def group_weights(d: Dataset) -> np.ndarray:
    """w_i = n / (4 n_g(i)); the weights sum to n and each group gets total weight n/4."""
    counts = group_counts(d)
    if (counts == 0).any():
        raise ValueError(f"empty group in training data: {counts}")
    return len(d) / (4.0 * counts[d.group])


def alpha_weights(d: Dataset, alpha: float) -> np.ndarray:
    """Interpolated weights w(alpha) = (1 - alpha) + alpha * n / (4 n_g).

    alpha = 0 is ERM, alpha = 1 is group balanced.
    """
    return (1.0 - alpha) + alpha * group_weights(d)


@dataclass
class Fitted:
    method: str
    C: float
    scaler: StandardScaler
    clf: LogisticRegression
    cols: list[int]
    converged: bool
    n_iter: int
    val_log_loss: float

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """P(Y = +1 | x)."""
        Z = self.scaler.transform(X[:, self.cols])
        return self.clf.predict_proba(Z)[:, 1]

    def coef(self) -> dict[str, float]:
        """Coefficients in standardized coordinates (coef_*) and in raw feature units (raw_*)."""
        out = {"coef_xs": np.nan, "coef_xz": np.nan, "raw_xs": np.nan, "raw_xz": np.nan}
        for j, c in enumerate(self.cols):
            name = "xs" if c == 0 else "xz"
            out[f"coef_{name}"] = float(self.clf.coef_[0, j])
            out[f"raw_{name}"] = float(self.clf.coef_[0, j] / self.scaler.scale_[j])
        return out


def _fit_one(method: str, C: float, train: Dataset, alpha: float | None = None):
    cols = feature_cols(method)
    scaler = StandardScaler().fit(train.X[:, cols])
    Z = scaler.transform(train.X[:, cols])
    if alpha is not None:
        sw = alpha_weights(train, alpha)
    else:
        sw = group_weights(train) if method == "group_balanced" else None
    clf = LogisticRegression(C=C, solver="lbfgs", max_iter=MAX_ITER, tol=TOL)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", ConvergenceWarning)
        clf.fit(Z, train.y, sample_weight=sw)
    converged = not any(issubclass(w.category, ConvergenceWarning) for w in caught)
    return scaler, clf, cols, converged


def fit_select(method: str, train: Dataset, val: Dataset, C_grid=C_GRID, alpha: float | None = None,
               weighted_val: bool = False) -> tuple[Fitted, list[dict]]:
    """Fit every C in the grid, keep the one with the lowest unweighted validation log loss.

    With weighted_val=True (only used with alpha), the validation log loss uses the
    same alpha weights, i.e. it estimates the risk under the reweighted distribution
    that the training objective targets.

    Returns the selected model and one record per candidate (for logging).
    """
    vw = alpha_weights(val, alpha) if (weighted_val and alpha is not None) else None
    best, candidates = None, []
    for C in C_grid:
        scaler, clf, cols, conv = _fit_one(method, C, train, alpha)
        p_val = clf.predict_proba(scaler.transform(val.X[:, cols]))[:, 1]
        ll = log_loss(val.y, p_val, labels=[-1, 1], sample_weight=vw)
        candidates.append({"C": C, "val_log_loss": ll, "converged": conv})
        if best is None or ll < best.val_log_loss:
            best = Fitted(method, C, scaler, clf, cols, conv, int(np.max(clf.n_iter_)), ll)
    return best, candidates
