"""The match model: an outcome classifier blended with a Poisson goals model.

* ``outcome`` - XGBoost multi-class classifier -> P(home), P(draw), P(away).
* ``goals_home`` / ``goals_away`` - XGBoost Poisson regressors -> expected goals (lambda) of
  each side. Treating the two scores as independent Poisson variables gives the full
  correct-score matrix, both-teams-to-score, over/under, and a second estimate of 1X2.
* Final 1X2 = ``blend_weight * classifier + (1 - blend_weight) * Poisson``. The weight is
  chosen by walk-forward validation (``config.BLEND_WEIGHT``, currently 1.0: classifier only);
  differently-biased models improves calibration (see ``notebooks/02_modelling.ipynb``).

Older seasons get exponentially smaller sample weights so the model tracks how football
evolves (e.g. the post-2020 drop in home advantage).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier, XGBRegressor

from .config import (
    BLEND_WEIGHT,
    CUP_CALIBRATION,
    FIRST_SEASON,
    GOALS_PARAMS,
    MAX_GOALS,
    OUTCOME_PARAMS,
    WARMUP_SEASONS,
)
from .features import feature_columns

HALF_LIFE_YEARS = 4.0


def training_rows(frame: pd.DataFrame) -> pd.DataFrame:
    """Finished matches with a 90-minute result, after the Elo/form warm-up period."""
    mask = (
        frame["status"].eq("played")
        & frame["target"].notna()
        & (frame["season"] >= FIRST_SEASON + WARMUP_SEASONS)
    )
    return frame[mask]


def time_decay_weights(
    dates: pd.Series, reference: pd.Timestamp, half_life_years: float
) -> np.ndarray:
    age_years = (reference - pd.to_datetime(dates)).dt.days.to_numpy() / 365.25
    return np.power(0.5, age_years / half_life_years)


def score_matrix(lambda_home: float, lambda_away: float, max_goals: int = MAX_GOALS) -> np.ndarray:
    """P(home scores i, away scores j) for i, j in 0..max_goals-1 (independent Poisson)."""
    goals = np.arange(max_goals)
    return np.outer(poisson.pmf(goals, lambda_home), poisson.pmf(goals, lambda_away))


def poisson_outcome_probs(
    lambda_home: np.ndarray, lambda_away: np.ndarray, max_goals: int = 12
) -> np.ndarray:
    """1X2 probabilities implied by two independent Poisson goal counts (vectorised)."""
    goals = np.arange(max_goals)
    ph = poisson.pmf(goals[None, :], np.asarray(lambda_home)[:, None])  # (n, g)
    pa = poisson.pmf(goals[None, :], np.asarray(lambda_away)[:, None])
    joint = ph[:, :, None] * pa[:, None, :]  # (n, g, g)
    home = np.tril(np.ones((max_goals, max_goals)), -1)  # i > j
    away = np.triu(np.ones((max_goals, max_goals)), 1)  # i < j
    p_home = (joint * home).sum(axis=(1, 2))
    p_away = (joint * away).sum(axis=(1, 2))
    p_draw = np.einsum("nii->n", joint)
    probs = np.stack([p_home, p_draw, p_away], axis=1)
    return probs / probs.sum(axis=1, keepdims=True)


@dataclass
class MatchModel:
    outcome_params: dict = field(default_factory=lambda: dict(OUTCOME_PARAMS))
    goals_params: dict = field(default_factory=lambda: dict(GOALS_PARAMS))
    blend_weight: float = BLEND_WEIGHT
    half_life_years: float = HALF_LIFE_YEARS
    random_state: int = 42

    features: list[str] = field(default_factory=list)
    outcome: XGBClassifier | None = None
    goals_home: XGBRegressor | None = None
    goals_away: XGBRegressor | None = None
    metadata: dict = field(default_factory=dict)
    cup_calibrator: LogisticRegression | None = None

    # ------------------------------------------------------------------ training
    def fit(
        self,
        train: pd.DataFrame,
        features: list[str] | None = None,
        *,
        calibrate: bool = CUP_CALIBRATION,
    ) -> MatchModel:
        self.features = features or feature_columns(train)
        if calibrate:
            self._fit_cup_calibrator(train)
        X = train[self.features].astype(float)
        reference = pd.to_datetime(train["date"]).max()
        w = time_decay_weights(train["date"], reference, self.half_life_years)

        common = {"tree_method": "hist", "n_jobs": -1, "random_state": self.random_state}
        self.outcome = XGBClassifier(
            objective="multi:softprob", eval_metric="mlogloss", **common, **self.outcome_params
        )
        self.outcome.fit(X, train["target"].astype(int), sample_weight=w)

        self.goals_home = XGBRegressor(objective="count:poisson", **common, **self.goals_params)
        self.goals_home.fit(X, train["home_goals"].astype(float), sample_weight=w)
        self.goals_away = XGBRegressor(objective="count:poisson", **common, **self.goals_params)
        self.goals_away.fit(X, train["away_goals"].astype(float), sample_weight=w)

        self.metadata = {
            "trained_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "n_train": len(train),
            "train_start": str(pd.to_datetime(train["date"]).min().date()),
            "train_end": str(reference.date()),
            "n_features": len(self.features),
            "cup_calibration": self.cup_calibrator is not None,
        }
        return self

    def _fit_cup_calibrator(self, train: pd.DataFrame) -> None:
        """Recalibrate domestic-cup probabilities, learned on the most recent year.

        A copy of the model is trained without the last 365 days and its domestic-cup
        forecasts for that year are mapped to what actually happened (multinomial logistic
        regression on log-probabilities). Out of sample (2025/26-2026/27, 10,860 matches): log
        loss 0.9462 -> 0.9443 (cups 0.634 -> 0.618), but Brier 0.5648 -> 0.5652, RPS 0.2004 ->
        0.2007 and accuracy 54.4% -> 54.2%. Not a clear win, so it is off by default
        (``config.CUP_CALIBRATION``).
        """
        self.cup_calibrator = None
        dates = pd.to_datetime(train["date"])
        split = dates.max() - pd.Timedelta(days=365)
        holdout = train[(dates > split) & train["is_cup"].eq(1) & train["is_uefa"].eq(0)]
        if len(holdout) < 300 or holdout["target"].nunique() < 3:
            return
        base = MatchModel(
            self.outcome_params, self.goals_params, self.blend_weight, self.half_life_years
        ).fit(train[dates <= split], self.features, calibrate=False)
        probs = base.predict(holdout)[["p_home", "p_draw", "p_away"]].to_numpy()
        self.cup_calibrator = LogisticRegression(C=1.0, max_iter=2000).fit(
            np.log(np.clip(probs, 1e-6, 1)), holdout["target"].astype(int)
        )

    # ---------------------------------------------------------------- inference
    def predict(self, frame: pd.DataFrame) -> pd.DataFrame:
        if self.outcome is None:
            raise RuntimeError("Model is not trained")
        X = frame[self.features].astype(float)
        cls = self.outcome.predict_proba(X)
        lam_h = np.clip(self.goals_home.predict(X), 0.05, 6.0)
        lam_a = np.clip(self.goals_away.predict(X), 0.05, 6.0)
        pois = poisson_outcome_probs(lam_h, lam_a)
        blend = self.blend_weight * cls + (1 - self.blend_weight) * pois
        blend /= blend.sum(axis=1, keepdims=True)
        if self.cup_calibrator is not None:
            cups = (frame["is_cup"].to_numpy() == 1) & (frame["is_uefa"].to_numpy() == 0)
            if cups.any():
                blend[cups] = self.cup_calibrator.predict_proba(
                    np.log(np.clip(blend[cups], 1e-6, 1))
                )
        return pd.DataFrame(
            {
                "p_home": blend[:, 0],
                "p_draw": blend[:, 1],
                "p_away": blend[:, 2],
                "xg_home": lam_h,
                "xg_away": lam_a,
                "cls_p_home": cls[:, 0],
                "cls_p_draw": cls[:, 1],
                "cls_p_away": cls[:, 2],
                "pois_p_home": pois[:, 0],
                "pois_p_draw": pois[:, 1],
                "pois_p_away": pois[:, 2],
            },
            index=frame.index,
        )

    def feature_importance(self) -> pd.Series:
        imp = self.outcome.get_booster().get_score(importance_type="gain")
        s = pd.Series({f: imp.get(f"f{i}", imp.get(f, 0.0)) for i, f in enumerate(self.features)})
        return (s / s.sum()).sort_values(ascending=False)

    # ------------------------------------------------------------- persistence
    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path, compress=3)

    @staticmethod
    def load(path: Path) -> MatchModel:
        return joblib.load(path)
