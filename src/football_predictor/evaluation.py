"""Probabilistic forecast metrics for 1X2 football predictions.

All functions take ``probs`` as an ``(n, 3)`` array ordered (home, draw, away) and
``outcomes`` as integer classes 0 = home, 1 = draw, 2 = away.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def _onehot(outcomes: np.ndarray) -> np.ndarray:
    out = np.zeros((len(outcomes), 3))
    out[np.arange(len(outcomes)), outcomes.astype(int)] = 1.0
    return out


def accuracy(probs: np.ndarray, outcomes: np.ndarray) -> float:
    return float(np.mean(np.argmax(probs, axis=1) == outcomes))


def log_loss(probs: np.ndarray, outcomes: np.ndarray, eps: float = 1e-12) -> float:
    p = np.clip(probs[np.arange(len(outcomes)), outcomes.astype(int)], eps, 1.0)
    return float(-np.mean(np.log(p)))


def brier_score(probs: np.ndarray, outcomes: np.ndarray) -> float:
    """Multi-class Brier score (0 = perfect, 2 = worst)."""
    return float(np.mean(np.sum((probs - _onehot(outcomes)) ** 2, axis=1)))


def ranked_probability_score(probs: np.ndarray, outcomes: np.ndarray) -> float:
    """RPS - the standard football forecasting metric; respects the H > D > A ordering."""
    cum_p = np.cumsum(probs, axis=1)[:, :2]
    cum_o = np.cumsum(_onehot(outcomes), axis=1)[:, :2]
    return float(np.mean(np.sum((cum_p - cum_o) ** 2, axis=1) / 2))


def per_match_brier(probs: np.ndarray, outcomes: np.ndarray) -> np.ndarray:
    return np.sum((probs - _onehot(outcomes)) ** 2, axis=1)


def summarise(probs: np.ndarray, outcomes: np.ndarray) -> dict[str, float]:
    return {
        "n": int(len(outcomes)),
        "accuracy": accuracy(probs, outcomes),
        "log_loss": log_loss(probs, outcomes),
        "brier": brier_score(probs, outcomes),
        "rps": ranked_probability_score(probs, outcomes),
    }


def calibration_table(probs: np.ndarray, outcomes: np.ndarray, bins: int = 10) -> pd.DataFrame:
    """Reliability data pooled over the three outcomes: predicted vs observed frequency."""
    flat_p = probs.ravel()
    flat_o = _onehot(outcomes).ravel()
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(flat_p, edges) - 1, 0, bins - 1)
    df = pd.DataFrame({"bin": idx, "p": flat_p, "o": flat_o})
    table = (
        df.groupby("bin")
        .agg(predicted=("p", "mean"), observed=("o", "mean"), count=("p", "size"))
        .reset_index()
    )
    table["bin_start"] = edges[table["bin"]]
    return table


# ---------------------------------------------------------------------------
# Baselines
# ---------------------------------------------------------------------------


def baseline_frequencies(train_outcomes: np.ndarray, n: int) -> np.ndarray:
    """Predict the historical H/D/A frequencies for every match."""
    freq = np.bincount(train_outcomes.astype(int), minlength=3) / len(train_outcomes)
    return np.tile(freq, (n, 1))


def baseline_market(frame: pd.DataFrame) -> np.ndarray:
    """Bookmaker implied probabilities (margin removed)."""
    return frame[["mkt_p_home", "mkt_p_draw", "mkt_p_away"]].to_numpy(dtype=float)
