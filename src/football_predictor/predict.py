"""Turn upcoming fixtures into model predictions."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .dataset import map_espn_names, match_key
from .features import build_features
from .model import MatchModel
from .teams import TeamMatcher

FIXTURE_COLUMNS = [
    "match_id",
    "espn_id",
    "kickoff",
    "date",
    "season",
    "competition",
    "home_team",
    "away_team",
    "home_display",
    "away_display",
    "home_espn_id",
    "away_espn_id",
    "neutral",
    "odds_home",
    "odds_draw",
    "odds_away",
    "odds_source",
]


def prepare_fixtures(
    events: pd.DataFrame, matcher: TeamMatcher, fd_odds: pd.DataFrame, now: pd.Timestamp
) -> pd.DataFrame:
    """Scheduled ESPN events (kick-off in the future) in the match schema, with the best odds available.

    football-data.co.uk market-average odds are preferred (they match the odds the model was
    trained on); DraftKings odds from ESPN are the fallback.
    """
    upcoming = events[(events["status"] == "scheduled") & (events["kickoff"] > now)]
    if upcoming.empty:
        return pd.DataFrame(columns=FIXTURE_COLUMNS)
    # Names are normally mapped beforehand on the full-year event list, where every club's
    # home venue (-> country) is known; mapping a handful of fixtures alone loses that context.
    fx = upcoming.copy() if "home_team" in upcoming.columns else map_espn_names(upcoming, matcher)
    fx["match_id"] = [
        match_key(d, h, a)
        for d, h, a in zip(fx["date"], fx["home_team"], fx["away_team"], strict=False)
    ]
    fx["home_display"] = fx["home_espn"]
    fx["away_display"] = fx["away_espn"]
    fx["odds_source"] = np.where(fx["odds_home"].notna(), "DraftKings", None)

    if not fd_odds.empty:
        lookup = {
            (r.competition, r.home_team, r.away_team): (
                r.date,
                r.odds_home,
                r.odds_draw,
                r.odds_away,
            )
            for r in fd_odds.itertuples()
        }
        for idx, row in fx.iterrows():
            hit = lookup.get((row["competition"], row["home_team"], row["away_team"]))
            if hit is not None and abs((hit[0] - row["date"]).days) <= 1:
                fx.loc[idx, ["odds_home", "odds_draw", "odds_away"]] = hit[1:]
                fx.loc[idx, "odds_source"] = "Market average"
    return fx[FIXTURE_COLUMNS].drop_duplicates("match_id").reset_index(drop=True)


def predict_fixtures(
    model: MatchModel, matches: pd.DataFrame, fixtures: pd.DataFrame
) -> pd.DataFrame:
    """Predictions for ``fixtures`` using features built from all of ``matches``."""
    if fixtures.empty:
        return pd.DataFrame()
    fx = fixtures.copy()
    fx["result"] = None
    frame, _ = build_features(
        matches,
        fx.drop(
            columns=[
                "espn_id",
                "kickoff",
                "home_display",
                "away_display",
                "home_espn_id",
                "away_espn_id",
                "odds_source",
            ]
        ),
    )
    frame = frame[frame["status"].eq("scheduled")].set_index("match_id")
    preds = model.predict(frame)
    out = fx.set_index("match_id").join(preds).join(frame[["home_elo", "away_elo"]])
    return out.reset_index()


class FormIndex:
    """Fast "last N matches before a date" lookups for every team (used by the website).

    Each entry is one played match from the team's point of view, oldest first.
    """

    def __init__(
        self,
        matches: pd.DataFrame,
        display_names: dict[str, str] | None = None,
        team_ids: dict[str, str] | None = None,
    ):
        self.display = display_names or {}
        self.ids = team_ids or {}
        played = matches[matches["status"].eq("played")]
        sides = []
        for side, opp, is_home in (("home", "away", True), ("away", "home", False)):
            sides.append(
                pd.DataFrame(
                    {
                        "team": played[f"{side}_team"].to_numpy(),
                        "date": pd.to_datetime(played["date"]).to_numpy(),
                        "opponent": played[f"{opp}_team"].to_numpy(),
                        "home": is_home,
                        "gf": played[f"{side}_goals"].astype(int).to_numpy(),
                        "ga": played[f"{opp}_goals"].astype(int).to_numpy(),
                        "competition": played["competition"].to_numpy(),
                    }
                )
            )
        long = pd.concat(sides, ignore_index=True).sort_values(["team", "date"], kind="stable")
        self._by_team = {
            team: g.reset_index(drop=True) for team, g in long.groupby("team", sort=False)
        }

    def last(self, team: str, before: pd.Timestamp, n: int = 5) -> list[dict]:
        """The team's last ``n`` matches strictly before ``before`` (oldest first)."""
        games = self._by_team.get(team)
        if games is None:
            return []
        end = int(games["date"].searchsorted(pd.Timestamp(before), side="left"))
        out = []
        for g in games.iloc[max(0, end - n) : end].itertuples():
            out.append(
                {
                    "date": g.date.strftime("%Y-%m-%d"),
                    "result": "W" if g.gf > g.ga else "D" if g.gf == g.ga else "L",
                    "goalsFor": int(g.gf),
                    "goalsAgainst": int(g.ga),
                    "home": bool(g.home),
                    "opponent": self.display.get(g.opponent, g.opponent),
                    "opponentLogo": self.ids.get(g.opponent),
                    "competition": g.competition,
                }
            )
        return out
