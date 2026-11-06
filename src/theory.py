"""Closed-form predictions for the Bayes classifier of the training environment.

The Bayes log-odds in an environment with P(A = Y) = p is
    f_p(x) = 2 xs / sigma_s^2 + g_p(xz),
    g_p(z) = log[ (p phi_+(z) + (1-p) phi_-(z)) / (p phi_-(z) + (1-p) phi_+(z)) ],
where phi_+/phi_- are N(+1, sigma_z^2) / N(-1, sigma_z^2) densities.
Because sigma_z = 0.2, g_p(xz) ~= c_p * sign(xz) with c_p = log(p / (1-p)).
"""
from __future__ import annotations

from math import erf, log, sqrt

import numpy as np

from data import SIGMA_S, SIGMA_Z

# np.trapezoid is numpy>=2.0; fall back to np.trapz on numpy 1.x
_trapz = getattr(np, "trapezoid", None) or np.trapz


def Phi(x: float) -> float:
    return 0.5 * (1.0 + erf(x / sqrt(2.0)))


def c_p(p: float) -> float:
    return log(p / (1.0 - p))


def acc_sign_approx(p_train: float, p_test: float) -> float:
    """Accuracy of sign(2 xs + c_p sign(xz)) in the test environment (sigma_s = 1)."""
    c = c_p(p_train)
    return p_test * Phi(1 + c / 2) + (1 - p_test) * Phi(1 - c / 2)


def g(z: np.ndarray, p: float) -> np.ndarray:
    lp = -((z - 1) ** 2) / (2 * SIGMA_Z**2)
    lm = -((z + 1) ** 2) / (2 * SIGMA_Z**2)
    num = np.logaddexp(np.log(p) + lp, np.log(1 - p) + lm)
    den = np.logaddexp(np.log(p) + lm, np.log(1 - p) + lp)
    return num - den


def acc_bayes_exact(p_train: float, p_test: float, grid: int = 4001) -> float:
    """Exact test accuracy of the training-environment Bayes classifier.

    By symmetry condition on Y = +1. Given A and Xz = z, the prediction is
    correct iff Xs > -sigma_s^2 g(z) / 2, i.e. with prob Phi(1/sigma_s + sigma_s g(z) / 2).
    Integrate over z ~ N(A, sigma_z^2) numerically.
    """
    total = 0.0
    for a_val, w in ((1.0, p_test), (-1.0, 1 - p_test)):
        z = np.linspace(a_val - 8 * SIGMA_Z, a_val + 8 * SIGMA_Z, grid)
        dens = np.exp(-((z - a_val) ** 2) / (2 * SIGMA_Z**2)) / (sqrt(2 * np.pi) * SIGMA_Z)
        thr = 1 / SIGMA_S + SIGMA_S * g(z, p_train) / 2
        inner = 0.5 * (1 + np.vectorize(erf)(thr / sqrt(2)))
        total += w * _trapz(dens * inner, z)
    return total


if __name__ == "__main__":
    from data import P_TRAIN

    print(f"{'p_train':>7} {'c_p':>6} | {'env':>8} {'approx':>7} {'exact':>7}")
    for p in P_TRAIN:
        for name, pt in (("id", p), ("no_corr", 0.5), ("reversed", 0.1)):
            print(f"{p:7.2f} {c_p(p):6.3f} | {name:>8} {acc_sign_approx(p, pt):7.4f} {acc_bayes_exact(p, pt):7.4f}")
    print(f"stable-only Bayes accuracy Phi(1) = {Phi(1):.4f}")


# ---------------------------------------------------------------------------
# Population minimizer of the *linear* logistic model (what ERM converges to).
# The Bayes log-odds is a step function of xz, so a linear model cannot match
# it exactly; its population optimum puts less weight on xz than c_p.
# ---------------------------------------------------------------------------

def acc_linear(b0: float, bs: float, bz: float, p_test: float) -> float:
    """Exact accuracy of sign(b0 + bs*xs + bz*xz) in an environment with P(A=Y)=p_test.

    Given Y=y and A=a, the score is Gaussian with mean b0 + y*bs + a*bz and
    variance bs^2 sigma_s^2 + bz^2 sigma_z^2. Average over y = +-1 and a.
    """
    sd = sqrt(bs**2 * SIGMA_S**2 + bz**2 * SIGMA_Z**2)
    acc = 0.0
    for y in (1, -1):
        for agree, w in ((1, p_test), (-1, 1 - p_test)):
            a = agree * y
            mean = b0 + y * bs + a * bz
            acc += 0.5 * w * Phi(y * mean / sd)
    return acc


def linear_population_coef(p: float, n_mc: int = 2_000_000, seed: int = 12345) -> tuple[float, float, float]:
    """(b0, bs, bz) minimizing the population logistic risk in raw feature units.

    Approximated by an essentially unregularized fit on a very large sample.
    """
    from sklearn.linear_model import LogisticRegression

    from data import sample

    d = sample(n_mc, p, np.random.default_rng(seed))
    clf = LogisticRegression(C=1e6, solver="lbfgs", max_iter=1000, tol=1e-8).fit(d.X, d.y)
    return float(clf.intercept_[0]), float(clf.coef_[0, 0]), float(clf.coef_[0, 1])


# ---------------------------------------------------------------------------
# Interpolated reweighting w(alpha) = (1-alpha) + alpha * n/(4 n_g).
# Reweighting only rescales the four (Y, A) groups, and by symmetry keeps
# P(Y=1) = 1/2, so the reweighted training distribution is exactly the
# environment with correlation p_alpha below. Hence the population optimum of
# alpha-weighted ERM equals the ERM optimum at p_alpha.
# ---------------------------------------------------------------------------

def p_alpha(p: float, alpha: float) -> float:
    """Effective correlation after reweighting.

    w_maj = (1-alpha) + alpha/(2p) on the A = Y groups (mass p),
    w_min = (1-alpha) + alpha/(2(1-p)) on the A = -Y groups (mass 1-p).
    The total mass p*w_maj + (1-p)*w_min = 1 for every alpha, so
        p_alpha = p * w_maj = p - alpha * (p - 1/2),
    linear in alpha. Weights stay non-negative for 0 <= alpha <= 2p/(2p-1),
    which sweeps p_alpha over [0, p].
    """
    return p - alpha * (p - 0.5)


def alpha_max(p: float) -> float:
    return 2 * p / (2 * p - 1)


def alpha_for_target(p: float, q: float) -> float:
    """alpha with p_alpha = q. Matching the test correlation makes the reweighted
    training distribution equal the test distribution, so this alpha is optimal
    for that test environment (importance weighting)."""
    return (p - q) / (p - 0.5)


def acc_alpha_sign(p: float, alpha: float, p_test: float) -> float:
    """Sign-approximation accuracy of alpha-weighted ERM in env p_test."""
    c = c_p(p_alpha(p, alpha))
    return p_test * Phi(1 + c / 2) + (1 - p_test) * Phi(1 - c / 2)


def worst_group_alpha_sign(p: float, alpha: float) -> float:
    """Worst (Y, A) group accuracy: the minority groups, Phi(1 - c/2) (for c >= 0)."""
    c = c_p(p_alpha(p, alpha))
    return min(Phi(1 + c / 2), Phi(1 - c / 2))
