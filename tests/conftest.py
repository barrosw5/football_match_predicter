import numpy as np
import pandas as pd
import pytest


def make_matches(
    results: list[tuple[str, str, str, int, int]], competition: str = "E0", season: int = 2020
) -> pd.DataFrame:
    """Build a minimal match table from (date, home, away, home_goals, away_goals) tuples."""
    rows = []
    for day, home, away, hg, ag in results:
        rows.append(
            {
                "match_id": f"{day}-{home}-{away}",
                "date": pd.Timestamp(day),
                "season": season,
                "competition": competition,
                "home_team": home,
                "away_team": away,
                "home_goals": hg,
                "away_goals": ag,
                "result": "H" if hg > ag else "A" if hg < ag else "D",
                "odds_home": 2.0,
                "odds_draw": 3.4,
                "odds_away": 3.8,
                "neutral": False,
                "status": "played",
                "source": "test",
            }
        )
    df = pd.DataFrame(rows)
    for col in [
        "home_xg",
        "away_xg",
        "home_shots",
        "away_shots",
        "home_sot",
        "away_sot",
        "home_corners",
        "away_corners",
        "home_fouls",
        "away_fouls",
        "home_yellow",
        "away_yellow",
        "home_red",
        "away_red",
    ]:
        df[col] = np.nan
    return df


@pytest.fixture
def small_league() -> pd.DataFrame:
    return make_matches(
        [
            ("2020-08-01", "A", "B", 2, 0),
            ("2020-08-01", "C", "D", 1, 1),
            ("2020-08-08", "B", "C", 0, 3),
            ("2020-08-08", "D", "A", 1, 2),
            ("2020-08-15", "A", "C", 1, 0),
            ("2020-08-15", "B", "D", 2, 2),
        ]
    )
