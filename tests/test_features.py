import numpy as np
import pandas as pd

from football_predictor.features import build_features, elo_ratings

from .conftest import make_matches


def test_first_match_has_prior_ratings_and_no_form(small_league):
    frame, _ = build_features(small_league)
    first = frame.iloc[0]
    assert first["home_elo"] == first["away_elo"] == 1560  # Premier League prior
    assert np.isnan(first["home_points_5"])
    assert np.isnan(first["home_rest"])


def test_features_never_use_the_match_result(small_league):
    """Changing a match's score must not change that match's own features."""
    frame_a, _ = build_features(small_league)
    flipped = small_league.copy()
    flipped.loc[4, ["home_goals", "away_goals", "result"]] = [0, 5, "A"]
    frame_b, _ = build_features(flipped)

    cols = [
        c for c in frame_a.columns if c.startswith(("home_", "away_", "elo", "ppg", "gd_", "comp_"))
    ]
    cols = [c for c in cols if c not in ("home_goals", "away_goals", "home_team", "away_team")]
    row_a = frame_a[frame_a["match_id"] == small_league.loc[4, "match_id"]][cols]
    row_b = frame_b[frame_b["match_id"] == small_league.loc[4, "match_id"]][cols]
    pd.testing.assert_frame_equal(row_a.reset_index(drop=True), row_b.reset_index(drop=True))


def test_rolling_form_uses_only_earlier_matches(small_league):
    frame, _ = build_features(small_league)
    # A: won 2-0 on 08-01 and 2-1 on 08-08 -> 3.0 points per game before 08-15
    row = frame[(frame["home_team"] == "A") & (frame["date"] == "2020-08-15")].iloc[0]
    assert row["home_points_5"] == 3.0
    assert row["home_gf_5"] == 2.0
    assert row["home_rest"] == 7


def test_league_table_is_pre_match(small_league):
    frame, _ = build_features(small_league)
    row = frame[(frame["home_team"] == "A") & (frame["date"] == "2020-08-15")].iloc[0]
    assert row["home_games_season"] == 2
    assert row["home_ppg_season"] == 3.0
    assert row["home_pos"] == 0.0  # top of the table


def test_elo_is_zero_sum_and_rewards_winners(small_league):
    _, ratings = elo_ratings(small_league.sort_values("date").reset_index(drop=True))
    assert abs(sum(ratings.values()) - 4 * 1560) < 1e-6
    assert ratings["A"] > 1560 > ratings["B"]


def test_fixtures_get_features_from_latest_state(small_league):
    fixture = make_matches([("2020-08-22", "A", "B", 0, 0)]).drop(
        columns=["home_goals", "away_goals", "result"]
    )
    frame, ratings = build_features(small_league, fixture)
    row = frame[frame["status"] == "scheduled"].iloc[0]
    assert row["home_elo"] == ratings["A"]
    assert row["home_points_5"] == 3.0  # three wins
    assert np.isnan(row["target"])
