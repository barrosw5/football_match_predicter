"""Elo ranking of every active club, with movement over the last week and month.

The ratings come from the same Elo used as a model feature (one scale across leagues,
domestic cups and UEFA competitions); here we keep the rating *after* every match so
the table can be reconstructed at any date.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import COMPETITIONS_BY_CODE, ELO_HOME_ADVANTAGE, ELO_K
from .features import _goal_multiplier

ACTIVE_DAYS = 400  # a club must have played a league or UEFA match in this window


def elo_timeline(matches: pd.DataFrame) -> pd.DataFrame:
    """One row per (team, match) with the team's rating after that match."""
    df = matches[matches["status"].eq("played") & matches["result"].isin(["H", "D", "A"])]
    df = df.sort_values("date", kind="stable")
    ratings: dict[str, float] = {}
    rows: list[tuple] = []
    for date, home, away, comp, hg, ag, neutral in zip(
        df["date"],
        df["home_team"],
        df["away_team"],
        df["competition"],
        df["home_goals"],
        df["away_goals"],
        df["neutral"].fillna(False).astype(bool),
        strict=False,
    ):
        prior = COMPETITIONS_BY_CODE[comp].elo_prior
        rh = ratings.setdefault(home, prior)
        ra = ratings.setdefault(away, prior)
        adv = 0.0 if neutral else ELO_HOME_ADVANTAGE
        expected = 1.0 / (1.0 + 10 ** (-(rh + adv - ra) / 400))
        actual = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
        delta = ELO_K * _goal_multiplier(int(hg - ag)) * (actual - expected)
        ratings[home] = rh + delta
        ratings[away] = ra - delta
        rows.append((date, home, ratings[home], comp))
        rows.append((date, away, ratings[away], comp))
    return pd.DataFrame(rows, columns=["date", "team", "elo", "competition"])


def _rating_at(timeline: pd.DataFrame, when: pd.Timestamp) -> pd.Series:
    """Each team's rating after its last match on or before ``when``."""
    past = timeline[timeline["date"] <= when]
    return past.groupby("team")["elo"].last()


def build_ranking(
    matches: pd.DataFrame,
    now: pd.Timestamp,
    display_names: dict[str, str] | None = None,
    team_ids: dict[str, str] | None = None,
    countries: dict[str, str] | None = None,
) -> list[dict]:
    """Ranking rows for the website, best first."""
    display_names = display_names or {}
    team_ids = team_ids or {}
    countries = countries or {}
    timeline = elo_timeline(matches)
    if timeline.empty:
        return []
    today = (
        pd.Timestamp(now).tz_localize(None).normalize()
        if pd.Timestamp(now).tzinfo
        else pd.Timestamp(now)
    )

    # Active clubs: a league or UEFA match recently (amateur clubs seen only in cups are left out).
    kind = timeline["competition"].map(lambda c: COMPETITIONS_BY_CODE[c])
    counts = (
        kind.map(lambda c: c.kind == "league") | kind.map(lambda c: c.country == "Europe")
    ).to_numpy()
    recent = timeline[counts & (timeline["date"] > today - pd.Timedelta(days=ACTIVE_DAYS))]
    active = set(recent["team"])

    league_of = (
        timeline[kind.map(lambda c: c.kind == "league").to_numpy()]
        .groupby("team")["competition"]
        .last()
    )

    def ranks(when: pd.Timestamp) -> tuple[pd.Series, pd.Series]:
        r = _rating_at(timeline, when)
        r = r[r.index.isin(active)]
        return r, r.rank(ascending=False, method="min").astype(int)

    elo_now, rank_now = ranks(today)
    elo_7, rank_7 = ranks(today - pd.Timedelta(days=7))
    elo_30, rank_30 = ranks(today - pd.Timedelta(days=30))

    by_team = {t: g for t, g in timeline[timeline["team"].isin(active)].groupby("team")}
    rows = []
    for team, elo in elo_now.sort_values(ascending=False).items():
        hist = by_team[team]
        last_games = hist.tail(10)
        league = league_of.get(team)
        rows.append(
            {
                "rank": int(rank_now[team]),
                "key": team,
                "name": display_names.get(team, team),
                "logo": team_ids.get(team),
                "country": countries.get(team)
                or (COMPETITIONS_BY_CODE[league].country if isinstance(league, str) else None),
                "league": league if isinstance(league, str) else None,
                "elo": round(float(elo), 1),
                "change7": _delta(rank_7.get(team), rank_now[team]),
                "change30": _delta(rank_30.get(team), rank_now[team]),
                "elo30": round(float(elo - elo_30[team]), 1) if team in elo_30 else None,
                "lastPlayed": f"{hist['date'].iloc[-1]:%Y-%m-%d}",
                "history": [round(float(v), 1) for v in last_games["elo"]],
            }
        )
    return rows


def _delta(before: float | None, now: int) -> int | None:
    """Places gained (positive) or lost (negative); None if the club was not ranked before."""
    if before is None or (isinstance(before, float) and np.isnan(before)):
        return None
    return int(before) - int(now)
