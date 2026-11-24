"""The prediction ledger: an append-only track record of every forecast the model made.

Rules that keep the track record honest:

* a prediction can be refreshed (new odds, new form data) only **until kick-off**; after
  that it is frozen;
* results are attached later from ESPN (fast) or football-data.co.uk (fallback);
* matches decided in extra time / penalties are marked ``void`` (the 90-minute score is
  unknown), postponed/cancelled matches ``cancelled``; neither counts in the statistics;
* rows produced by :func:`football_predictor.pipeline.backtest` are tagged
  ``source="backtest"`` so the website can tell them apart from live forecasts.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import LEDGER_PATH, VALUE_EDGE

LEDGER_COLUMNS = [
    "match_id",
    "espn_id",
    "competition",
    "kickoff",
    "home_team",
    "away_team",
    "home_display",
    "away_display",
    "home_espn_id",
    "away_espn_id",
    "p_home",
    "p_draw",
    "p_away",
    "xg_home",
    "xg_away",
    "home_elo",
    "away_elo",
    "odds_home",
    "odds_draw",
    "odds_away",
    "odds_source",
    "predicted_at",
    "model_version",
    "source",
    "status",
    "home_goals",
    "away_goals",
    "settled_at",
]
_FLOAT_COLS = [
    "p_home",
    "p_draw",
    "p_away",
    "xg_home",
    "xg_away",
    "home_elo",
    "away_elo",
    "odds_home",
    "odds_draw",
    "odds_away",
    "home_goals",
    "away_goals",
]


def empty_ledger() -> pd.DataFrame:
    return pd.DataFrame(columns=LEDGER_COLUMNS)


def load_ledger(path=LEDGER_PATH) -> pd.DataFrame:
    if not path.exists():
        return empty_ledger()
    df = pd.read_csv(
        path, dtype={"espn_id": str, "match_id": str, "home_espn_id": str, "away_espn_id": str}
    )
    for col in LEDGER_COLUMNS:
        if col not in df.columns:
            df[col] = np.nan
    df["kickoff"] = pd.to_datetime(df["kickoff"], utc=True, format="ISO8601")
    for col in _FLOAT_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df[LEDGER_COLUMNS]


def save_ledger(df: pd.DataFrame, path=LEDGER_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = df[LEDGER_COLUMNS].sort_values(["kickoff", "competition", "home_team"]).copy()
    out["kickoff"] = pd.to_datetime(out["kickoff"], utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    for col in ["p_home", "p_draw", "p_away"]:
        out[col] = out[col].round(4)
    for col in ["xg_home", "xg_away", "odds_home", "odds_draw", "odds_away"]:
        out[col] = out[col].round(3)
    for col in ["home_elo", "away_elo"]:
        out[col] = out[col].round(1)
    out.to_csv(path, index=False)


def upsert_predictions(
    ledger: pd.DataFrame, preds: pd.DataFrame, now: pd.Timestamp, model_version: str
) -> pd.DataFrame:
    """Insert new forecasts and refresh pending ones whose kick-off is still in the future."""
    if preds.empty:
        return ledger
    new = preds.copy()
    new["predicted_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    new["model_version"] = model_version
    new["source"] = "live"
    new["status"] = "pending"
    new["home_goals"] = np.nan
    new["away_goals"] = np.nan
    new["settled_at"] = None
    new = new.reindex(columns=LEDGER_COLUMNS)

    if ledger.empty:
        return new.reset_index(drop=True)
    locked = ledger["kickoff"] <= now
    keep = ledger[locked | ~ledger["match_id"].isin(new["match_id"])]
    # never overwrite a frozen forecast
    new = new[~new["match_id"].isin(keep["match_id"])]
    return pd.concat([keep, new], ignore_index=True)


def settle(
    ledger: pd.DataFrame, events: pd.DataFrame, matches: pd.DataFrame, now: pd.Timestamp
) -> pd.DataFrame:
    """Attach final scores to pending forecasts whose match has finished."""
    if ledger.empty:
        return ledger
    ledger = ledger.copy()
    by_espn = events.set_index("espn_id") if not events.empty else pd.DataFrame()
    by_key = matches.set_index("match_id")
    stamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    pending = ledger.index[
        (ledger["status"] == "pending") & (ledger["kickoff"] < now - pd.Timedelta(hours=2))
    ]

    for idx in pending:
        row = ledger.loc[idx]
        status, hg, ag = None, np.nan, np.nan
        espn_id = row["espn_id"]
        if isinstance(espn_id, str) and espn_id in by_espn.index:
            ev = by_espn.loc[espn_id]
            if ev["status"] in ("played", "void"):
                status, hg, ag = ev["status"], ev["home_goals"], ev["away_goals"]
            elif ev["status"] in ("postponed", "cancelled") and row["kickoff"] < now - pd.Timedelta(
                days=2
            ):
                status = "cancelled"
        if status is None and row["match_id"] in by_key.index:
            m = by_key.loc[row["match_id"]]
            if m["status"] in ("played", "void"):
                status, hg, ag = m["status"], m["home_goals"], m["away_goals"]
        if status is None and row["kickoff"] < now - pd.Timedelta(days=5):
            status = "cancelled"  # never found a result: postponed or abandoned
        if status is not None:
            ledger.loc[idx, ["status", "home_goals", "away_goals", "settled_at"]] = [
                "settled" if status == "played" else status,
                hg,
                ag,
                stamp,
            ]
    return ledger


# ---------------------------------------------------------------------------
# Scoring of settled forecasts
# ---------------------------------------------------------------------------


def scored(ledger: pd.DataFrame) -> pd.DataFrame:
    """Settled rows with per-match evaluation columns added."""
    df = ledger[ledger["status"] == "settled"].copy()
    if df.empty:
        return df
    probs = df[["p_home", "p_draw", "p_away"]].to_numpy(float)
    actual = np.select(
        [df["home_goals"] > df["away_goals"], df["home_goals"] == df["away_goals"]], [0, 1], 2
    )
    pick = probs.argmax(axis=1)
    onehot = np.eye(3)[actual]
    df["actual"] = np.array(["H", "D", "A"])[actual]
    df["pick"] = np.array(["H", "D", "A"])[pick]
    df["correct"] = pick == actual
    df["p_actual"] = probs[np.arange(len(df)), actual]
    df["brier"] = ((probs - onehot) ** 2).sum(axis=1)
    cum_p, cum_o = probs.cumsum(axis=1)[:, :2], onehot.cumsum(axis=1)[:, :2]
    df["rps"] = ((cum_p - cum_o) ** 2).sum(axis=1) / 2
    df["log_loss"] = -np.log(np.clip(df["p_actual"], 1e-12, 1))
    df["goal_error"] = (df["xg_home"] - df["home_goals"]).abs() + (
        df["xg_away"] - df["away_goals"]
    ).abs()
    # Most likely correct score = the mode of each independent Poisson = floor(lambda).
    df["pred_score"] = [
        f"{int(np.floor(h))}-{int(np.floor(a))}"
        for h, a in zip(df["xg_home"], df["xg_away"], strict=False)
    ]
    df["exact_score"] = df["pred_score"] == [
        f"{int(h)}-{int(a)}" for h, a in zip(df["home_goals"], df["away_goals"], strict=False)
    ]

    odds = df[["odds_home", "odds_draw", "odds_away"]].to_numpy(float)
    has_odds = ~np.isnan(odds).any(axis=1)
    df["has_odds"] = has_odds
    df["market_pick"] = np.where(
        has_odds,
        np.array(["H", "D", "A"])[np.nanargmin(np.where(has_odds[:, None], odds, 1.0), axis=1)],
        None,
    )
    df["market_correct"] = np.where(has_odds, df["market_pick"] == df["actual"], np.nan)
    # Bookmaker probabilities (margin removed) scored exactly like the model's.
    inv = 1.0 / odds
    mkt = inv / inv.sum(axis=1, keepdims=True)
    df["market_brier"] = np.where(has_odds, ((mkt - onehot) ** 2).sum(axis=1), np.nan)
    df["market_p_actual"] = np.where(has_odds, mkt[np.arange(len(df)), actual], np.nan)

    ev = probs * odds - 1
    best = np.where(has_odds, np.nanargmax(np.where(has_odds[:, None], ev, -1), axis=1), 0)
    best_ev = ev[np.arange(len(df)), best]
    is_value = has_odds & (best_ev > VALUE_EDGE)
    df["value_pick"] = np.where(is_value, np.array(["H", "D", "A"])[best], None)
    df["value_odds"] = np.where(is_value, odds[np.arange(len(df)), best], np.nan)
    df["value_profit"] = np.where(
        is_value, np.where(best == actual, df["value_odds"] - 1, -1.0), np.nan
    )
    return df
