# Shortcut Learning under Spurious Correlation Shifts

JHU Machine Learning course final project (Fall 2026).

A model trained where a "shortcut" feature is highly correlated with the label can score well
in distribution and fail when that correlation changes. We study this in a synthetic setting
where the optimal predictor is known in closed form, so every experiment can be checked
against a theoretical prediction, and then test the main prediction on images (MNIST).

## Setting

- Label `Y` uniform on {-1, +1}
- Stable feature `Xs = Y + N(0, 1)` (same in every environment)
- Shortcut attribute `A = Y` with probability `p`, else `-Y`; shortcut feature `Xz = A + 0.2 N(0, 1)`
- Train with `p` in {0.60, 0.80, 0.95}, `n` in {500, 2000, 8000}; test at `p_test` = `p` (ID), 0.5, 0.1

Methods: ERM (L2 logistic regression), group-balanced reweighting `n / (4 n_g)` over the four
(Y, A) groups, a stable-feature-only reference, and the interpolation
`w(alpha) = (1 - alpha) + alpha * n / (4 n_g)`.

## Main results

| | Finding |
|---|---|
| E1/E2 | ERM accuracy matches the large-sample theory (mean abs. error 0.0018 over 81 settings). More data does not fix OOD accuracy: at `p = 0.95`, reversed-env accuracy stays at about 0.39 for every `n`. |
| E1 | Group balancing gives about `Phi(1) = 0.841` in every environment, at an ID cost of about 0.117 when `p = 0.95`. |
| E3 | Reweighting by `w(alpha)` turns the training distribution into the environment `p_alpha = p - alpha (p - 1/2)`, so the whole ID/OOD trade-off is closed form; `alpha* = (p - p_test) / (p - 1/2)` is optimal for a known test environment (can exceed 1). C must be selected with the same alpha-weighted validation loss. |
| E4 | On MNIST 0 vs 1 with a corner marker and 25% label noise, a CNN switches from the marker to the digit near the predicted `p_alpha = 0.75` and to the inverted marker near `p_alpha = 0.25`. |

Figures are in `figures/` (PDF for the report, PNG previews).

## Repository layout

```
src/
  data.py             synthetic data generator (nested training sets, fixed seeds)
  theory.py           closed-form / numerical predictions (Bayes, linear optimum, p_alpha)
  check_data.py       sanity checks: generator vs theory by Monte Carlo
  models.py           ERM / group balanced / stable only / alpha weights, C selection
  metrics.py          accuracy, worst-group accuracy, log loss
  run_experiments.py  E1/E2 (default) and E3 (--e3)
  mnist_shortcut.py   E4 (MNIST, needs torch; downloads MNIST to data/mnist)
  analysis.py         summary tables, paired bootstrap CIs, figures 1-6
results/              CSV outputs (results.csv, e3_alpha.csv, e4_mnist.csv, summaries)
figures/              fig1-fig6
```

## Running (macOS / Linux / Windows)

Python 3.10 or newer.

```bash
git clone https://github.com/Er1cShi/JHU_ML_Course_Final_Project.git
cd JHU_ML_Course_Final_Project
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python src/check_data.py           # sanity checks (seconds)
python src/run_experiments.py      # E1/E2 -> results/results.csv (~20 s)
python src/run_experiments.py --e3 # E3 -> results/e3_alpha.csv (~1-2 min)
python src/mnist_shortcut.py       # E4 -> results/e4_mnist.csv (~4 min on CPU)
python src/analysis.py             # tables + figures/ (~40 s)
```

All runs use fixed seeds, so the CSVs and figures are reproduced exactly up to library
differences. Run every command from the repository root.
