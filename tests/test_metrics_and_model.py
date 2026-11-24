import numpy as np
import pytest

from football_predictor import evaluation as ev
from football_predictor.model import poisson_outcome_probs, score_matrix
from football_predictor.sources.espn import american_to_decimal, parse_events


def test_perfect_and_uniform_forecasts():
    outcomes = np.array([0, 1, 2])
    perfect = np.eye(3)
    uniform = np.full((3, 3), 1 / 3)
    assert ev.accuracy(perfect, outcomes) == 1.0
    assert ev.brier_score(perfect, outcomes) == 0.0
    assert ev.ranked_probability_score(perfect, outcomes) == 0.0
    assert ev.brier_score(uniform, outcomes) == pytest.approx(2 / 3)
    assert ev.log_loss(uniform, outcomes) == pytest.approx(np.log(3))


def test_rps_penalises_distant_misses_more():
    home_win = np.array([0])
    near = np.array([[0.2, 0.6, 0.2]])  # mass on the draw
    far = np.array([[0.2, 0.2, 0.6]])  # mass on the away win
    assert ev.ranked_probability_score(near, home_win) < ev.ranked_probability_score(far, home_win)


def test_poisson_probabilities_are_consistent():
    probs = poisson_outcome_probs(np.array([1.5, 0.8]), np.array([1.0, 2.2]))
    assert probs.sum(axis=1) == pytest.approx([1.0, 1.0])
    assert probs[0, 0] > probs[0, 2]  # stronger home side favoured
    assert probs[1, 2] > probs[1, 0]
    matrix = score_matrix(1.4, 1.1)
    assert matrix.shape == (6, 6)
    assert 0.95 < matrix.sum() <= 1.0


def test_american_odds_conversion():
    assert american_to_decimal("+150") == pytest.approx(2.5)
    assert american_to_decimal(-200) == pytest.approx(1.5)
    assert american_to_decimal("EVEN") == 2.0
    assert np.isnan(american_to_decimal(None))


def _event(status_name: str, state: str, completed: bool, home_score="2", away_score="1"):
    return {
        "id": "1",
        "date": "2026-11-25T20:00Z",
        "status": {"type": {"name": status_name, "state": state, "completed": completed}},
        "competitions": [
            {
                "neutralSite": False,
                "venue": {"address": {"country": "Portugal"}},
                "odds": [
                    {
                        "moneyline": {
                            "home": {"close": {"odds": "+150"}},
                            "draw": {"close": {"odds": "+220"}},
                            "away": {"close": {"odds": "+180"}},
                        }
                    }
                ],
                "competitors": [
                    {
                        "homeAway": "home",
                        "score": home_score,
                        "team": {
                            "id": "10",
                            "displayName": "Sporting CP",
                            "shortDisplayName": "Sporting",
                        },
                    },
                    {
                        "homeAway": "away",
                        "score": away_score,
                        "team": {
                            "id": "20",
                            "displayName": "FC Porto",
                            "shortDisplayName": "Porto",
                        },
                    },
                ],
            }
        ],
    }


def test_espn_parser_statuses_and_odds():
    df = parse_events(
        [
            _event("STATUS_SCHEDULED", "pre", False),
            _event("STATUS_FULL_TIME", "post", True),
            _event("STATUS_FINAL_PEN", "post", True),
        ],
        "P1",
    )
    assert list(df["status"]) == ["scheduled", "played", "void"]
    assert np.isnan(df.loc[0, "home_goals"])  # no score before kick-off
    assert df.loc[1, "home_goals"] == 2
    assert df.loc[0, "odds_home"] == pytest.approx(2.5)
    assert df.loc[0, "season"] == 2026
