"""Build the unified match table that every other module works from.

One row per match, all sources merged into the same schema with canonical team names::

    match_id, date, season, competition, home_team, away_team, home_goals, away_goals,
    result, home_xg, away_xg, home_shots, away_shots, home_sot, away_sot, home_corners,
    away_corners, home_fouls, away_fouls, home_yellow, away_yellow, home_red, away_red,
    odds_home, odds_draw, odds_away, neutral, status, source
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import date

import numpy as np
import pandas as pd

from .config import COMPETITIONS_BY_CODE, MATCHES_PATH, PROCESSED_DIR
from .sources import espn, football_data
from .teams import TeamMatcher, strip_accents

log = logging.getLogger(__name__)

STAT_COLUMNS = [
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
]
ODDS_COLUMNS = ["odds_home", "odds_draw", "odds_away"]
MATCH_COLUMNS = [
    "match_id",
    "date",
    "season",
    "competition",
    "home_team",
    "away_team",
    "home_goals",
    "away_goals",
    "result",
    *STAT_COLUMNS,
    *ODDS_COLUMNS,
    "neutral",
    "status",
    "source",
]

# ESPN venue countries -> the country names used in config.COMPETITIONS
_COUNTRY_ALIASES = {"Türkiye": "Turkey", "Turkiye": "Turkey", "Monaco": "France"}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", strip_accents(str(text)).lower()).strip("-")


def match_key(day, home: str, away: str) -> str:
    """Stable identifier of a fixture, independent of the data source."""
    return f"{pd.Timestamp(day):%Y%m%d}-{_slug(home)}-{_slug(away)}"


def team_countries(matches: pd.DataFrame) -> dict[str, str]:
    """Canonical team -> country of the domestic league it appears in most often."""
    counts: dict[str, Counter] = {}
    domestic = matches[
        matches["competition"].map(lambda c: COMPETITIONS_BY_CODE[c].kind == "league")
    ]
    for side in ("home_team", "away_team"):
        for team, comp in zip(domestic[side], domestic["competition"], strict=False):
            counts.setdefault(team, Counter())[COMPETITIONS_BY_CODE[comp].country] += 1
    return {team: c.most_common(1)[0][0] for team, c in counts.items()}


def build_matcher(domestic: pd.DataFrame, league_teams: pd.DataFrame | None = None) -> TeamMatcher:
    """Name matcher for canonical clubs, plus an ESPN-id map learned from league rosters."""
    matcher = TeamMatcher(team_countries(domestic))
    if league_teams is not None and not league_teams.empty:
        known = set(matcher.country)
        for r in league_teams.sort_values("year").itertuples():
            country = COMPETITIONS_BY_CODE[r.competition].country
            team = matcher.match(r.name, alternatives=[r.alt], country=country)
            if team in known:
                matcher.id_map[str(r.espn_team_id)] = team
    return matcher


def map_espn_names(events: pd.DataFrame, matcher: TeamMatcher) -> pd.DataFrame:
    """Add canonical ``home_team`` / ``away_team`` columns to ESPN events."""
    events = events.copy()
    if events.empty:
        events["home_team"] = pd.Series(dtype=str)
        events["away_team"] = pd.Series(dtype=str)
        return events

    # A club's country = the country its home (non-neutral) games are played in.
    home_games = events[~events["neutral"].astype(bool)]
    country_by_id = (
        home_games.assign(c=home_games["venue_country"].map(lambda c: _COUNTRY_ALIASES.get(c, c)))
        .dropna(subset=["c"])
        .groupby("home_espn_id")["c"]
        .agg(lambda s: s.value_counts().index[0])
        .to_dict()
    )
    for side in ("home", "away"):
        names = []
        for name, alt, tid, comp in zip(
            events[f"{side}_espn"],
            events[f"{side}_alt"],
            events[f"{side}_espn_id"],
            events["competition"],
            strict=False,
        ):
            known_id = matcher.id_map.get(str(tid))
            if known_id is not None:
                names.append(known_id)
                continue
            cfg = COMPETITIONS_BY_CODE[comp]
            # Domestic competitions know their country; UEFA clubs get it from their stadium.
            country = cfg.country if cfg.country != "Europe" else country_by_id.get(tid)
            domestic_cup = cfg.kind == "cup" and cfg.country != "Europe"
            names.append(
                matcher.match(name, alternatives=[alt], country=country, fuzzy=not domestic_cup)
            )
        events[f"{side}_team"] = names
    return events


def _espn_to_matches(events: pd.DataFrame) -> pd.DataFrame:
    df = events[events["status"].isin(["played", "void"])].copy()
    df["home_goals"] = df["home_goals"].astype(float)
    df["away_goals"] = df["away_goals"].astype(float)
    df["result"] = np.select(
        [df["home_goals"] > df["away_goals"], df["home_goals"] < df["away_goals"]], ["H", "A"], "D"
    )
    df.loc[df["status"] == "void", "result"] = None  # decided in extra time / penalties
    for col in STAT_COLUMNS:
        df[col] = np.nan
    df["source"] = "espn"
    return df


def build_matches(
    *, refresh: bool = True, today: date | None = None, save: bool = True
) -> pd.DataFrame:
    """Download (or read cached) sources and return the unified, chronologically sorted table."""
    log.info("Loading football-data.co.uk leagues ...")
    domestic = football_data.load_all(refresh_current=refresh, today=today)
    log.info("  %d domestic matches", len(domestic))

    log.info("Loading UEFA competitions and domestic cups from ESPN ...")
    cups_raw = espn.load_cup_history(refresh_current=refresh, today=today)
    league_teams = espn.load_league_teams(refresh_current=refresh, today=today)
    matcher = build_matcher(domestic, league_teams)
    log.info("  %d ESPN team ids mapped to clubs", len(matcher.id_map))
    cups = _espn_to_matches(map_espn_names(cups_raw, matcher))
    log.info(
        "  %d cup matches (%d unique clubs)",
        len(cups),
        pd.concat([cups["home_team"], cups["away_team"]]).nunique(),
    )

    df = pd.concat([domestic, cups], ignore_index=True)
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["match_id"] = [
        match_key(d, h, a)
        for d, h, a in zip(df["date"], df["home_team"], df["away_team"], strict=False)
    ]
    df = df.drop_duplicates("match_id", keep="first")
    df = df.sort_values(["date", "competition", "home_team"], kind="stable").reset_index(drop=True)
    df = df[MATCH_COLUMNS]

    if save:
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        df.to_parquet(MATCHES_PATH, index=False)
        log.info("Saved %d matches -> %s", len(df), MATCHES_PATH)
    return df


def load_matches() -> pd.DataFrame:
    if not MATCHES_PATH.exists():
        return build_matches()
    return pd.read_parquet(MATCHES_PATH)
