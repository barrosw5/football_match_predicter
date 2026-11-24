import numpy as np
import pandas as pd

from football_predictor.tracking import LEDGER_COLUMNS, scored, settle, upsert_predictions

NOW = pd.Timestamp("2026-11-24 12:00", tz="UTC")


def _pred(match_id: str, kickoff: str, p_home: float = 0.5) -> dict:
    return {
        "match_id": match_id,
        "espn_id": match_id,
        "competition": "E0",
        "kickoff": pd.Timestamp(kickoff, tz="UTC"),
        "home_team": "A",
        "away_team": "B",
        "home_display": "A",
        "away_display": "B",
        "p_home": p_home,
        "p_draw": 0.3,
        "p_away": 0.7 - p_home,
        "xg_home": 1.6,
        "xg_away": 0.9,
        "home_elo": 1600.0,
        "away_elo": 1500.0,
        "odds_home": 2.0,
        "odds_draw": 3.4,
        "odds_away": 4.0,
        "odds_source": "test",
    }


def test_forecasts_are_frozen_at_kickoff():
    ledger = upsert_predictions(
        pd.DataFrame(columns=LEDGER_COLUMNS),
        pd.DataFrame([_pred("m1", "2026-11-24 15:00")]),
        NOW,
        "v1",
    )
    later = NOW + pd.Timedelta(hours=4)  # after kick-off
    updated = upsert_predictions(
        ledger, pd.DataFrame([_pred("m1", "2026-11-24 15:00", p_home=0.1)]), later, "v2"
    )
    assert len(updated) == 1
    assert updated.iloc[0]["p_home"] == 0.5
    assert updated.iloc[0]["model_version"] == "v1"


def test_pending_forecasts_are_refreshed_before_kickoff():
    ledger = upsert_predictions(
        pd.DataFrame(columns=LEDGER_COLUMNS),
        pd.DataFrame([_pred("m1", "2026-11-26 15:00")]),
        NOW,
        "v1",
    )
    updated = upsert_predictions(
        ledger,
        pd.DataFrame([_pred("m1", "2026-11-26 15:00", p_home=0.6)]),
        NOW + pd.Timedelta(days=1),
        "v2",
    )
    assert len(updated) == 1
    assert updated.iloc[0]["p_home"] == 0.6


def test_settle_and_score():
    ledger = upsert_predictions(
        pd.DataFrame(columns=LEDGER_COLUMNS),
        pd.DataFrame([_pred("m1", "2026-11-23 15:00")]),
        NOW - pd.Timedelta(days=2),
        "v1",
    )
    events = pd.DataFrame(
        {"espn_id": ["m1"], "status": ["played"], "home_goals": [1.0], "away_goals": [0.0]}
    )
    settled = settle(
        ledger,
        events,
        pd.DataFrame(columns=["match_id", "status", "home_goals", "away_goals"]),
        NOW,
    )
    assert settled.iloc[0]["status"] == "settled"

    sc = scored(settled).iloc[0]
    assert sc["actual"] == "H" and sc["pick"] == "H" and sc["correct"]
    assert sc["pred_score"] == "1-0"  # floor of the expected goals = Poisson mode
    assert sc["exact_score"]
    assert np.isclose(sc["brier"], (0.5 - 1) ** 2 + 0.3**2 + 0.2**2)
    assert sc["market_pick"] == "H"


def test_extra_time_results_are_void():
    ledger = upsert_predictions(
        pd.DataFrame(columns=LEDGER_COLUMNS),
        pd.DataFrame([_pred("m1", "2026-11-23 15:00")]),
        NOW - pd.Timedelta(days=2),
        "v1",
    )
    events = pd.DataFrame(
        {"espn_id": ["m1"], "status": ["void"], "home_goals": [2.0], "away_goals": [1.0]}
    )
    settled = settle(
        ledger,
        events,
        pd.DataFrame(columns=["match_id", "status", "home_goals", "away_goals"]),
        NOW,
    )
    assert settled.iloc[0]["status"] == "void"
    assert scored(settled).empty
