"""Squad market values from the open *transfermarkt-datasets* project (CC0).

https://github.com/dcaribou/transfermarkt-datasets publishes Transfermarkt data as CSV
files. Squad value = sum of the latest market values of a club's players.

Transfermarkt clubs are linked to the project's clubs through **matches**, not names: a
Transfermarkt game and one of our matches on the same day, in the same country, with the
same score, are almost certainly the same game. Across hundreds of games per club that
vote is unambiguous ("Sport Lisboa e Benfica" -> "Benfica" without any alias table).
"""

from __future__ import annotations

import logging
import time
from collections import Counter

import pandas as pd

from ..config import COMPETITIONS_BY_CODE, RAW_DIR
from .http import cached_download

log = logging.getLogger(__name__)

BASE_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
FILES = ("games", "player_valuations", "competitions")
PLAYER_FILE = "players"
REFRESH_DAYS = 7

_TM_COUNTRY = {"Türkiye": "Turkey"}


def _path(name: str):
    dest = RAW_DIR / "transfermarkt" / f"{name}.csv.gz"
    stale = not dest.exists() or time.time() - dest.stat().st_mtime > REFRESH_DAYS * 86400
    return cached_download(f"{BASE_URL}/{name}.csv.gz", dest, refresh=stale)


def load(name: str) -> pd.DataFrame:
    path = _path(name)
    return pd.read_csv(path) if path is not None else pd.DataFrame()


def club_map(
    matches: pd.DataFrame, games: pd.DataFrame, competitions: pd.DataFrame
) -> dict[int, str]:
    """Transfermarkt club id -> canonical club, voted by matching games."""
    country_of = {
        r.competition_id: _TM_COUNTRY.get(r.country_name, r.country_name)
        for r in competitions.itertuples()
        if isinstance(r.country_name, str)
    }
    g = games[games["competition_type"].isin(["domestic_league", "domestic_cup"])].copy()
    g["date"] = pd.to_datetime(g["date"]).dt.normalize()
    g["country"] = g["competition_id"].map(country_of)
    g = g.dropna(subset=["country", "home_club_goals", "away_club_goals"])

    ours = matches[matches["status"].eq("played")].copy()
    ours["country"] = ours["competition"].map(lambda c: COMPETITIONS_BY_CODE[c].country)
    merged = g.merge(
        ours[["date", "country", "home_goals", "away_goals", "home_team", "away_team"]],
        left_on=["date", "country", "home_club_goals", "away_club_goals"],
        right_on=["date", "country", "home_goals", "away_goals"],
    )
    votes: dict[int, Counter] = {}
    for tm_home, tm_away, home, away in zip(
        merged["home_club_id"],
        merged["away_club_id"],
        merged["home_team"],
        merged["away_team"],
        strict=False,
    ):
        votes.setdefault(int(tm_home), Counter())[home] += 1
        votes.setdefault(int(tm_away), Counter())[away] += 1
    mapping = {}
    for tm_id, counter in votes.items():
        team, n = counter.most_common(1)[0]
        if n >= 5 and n >= 0.6 * sum(counter.values()):
            mapping[tm_id] = team
    return mapping


_SERIES_CACHE: dict = {}


def _club_series(matches: pd.DataFrame, every_months: int = 6, years: int = 10):
    """(canonical club -> [(snapshot date, EUR millions)], last snapshot date)."""
    key = (len(matches), every_months, years)
    if key in _SERIES_CACHE:
        return _SERIES_CACHE[key]
    try:
        games, valuations, competitions = (load(n) for n in FILES)
    except Exception as exc:  # optional data: never break the pipeline
        log.warning("Transfermarkt data unavailable: %s", exc)
        return {}, None
    if valuations.empty or games.empty:
        return {}, None
    mapping = club_map(matches, games, competitions)
    log.info("Transfermarkt: %d clubs linked through matching games", len(mapping))
    valuations["date"] = pd.to_datetime(valuations["date"])
    valuations = valuations[valuations["current_club_id"].isin(mapping)]
    last = valuations["date"].max().normalize()
    snapshots = sorted(
        {last}
        | {
            last - pd.DateOffset(months=every_months * k)
            for k in range(1, years * 12 // every_months + 1)
        }
    )
    per_club: dict[str, list[tuple[pd.Timestamp, float]]] = {}
    for when in snapshots:
        window = valuations[
            (valuations["date"] <= when) & (valuations["date"] > when - pd.Timedelta(days=365))
        ]
        latest = window.sort_values("date").groupby("player_id").last()
        totals = latest.groupby("current_club_id")["market_value_in_eur"].sum() / 1e6
        for club_id, value in totals.items():
            per_club.setdefault(mapping[int(club_id)], []).append((when, float(value)))
    for series in per_club.values():
        series.sort()
    _SERIES_CACHE[key] = (per_club, last)
    return per_club, last


def squad_value_history(matches: pd.DataFrame) -> dict[str, list[tuple]]:
    """Every club's squad value snapshots (used as a model feature, no look-ahead)."""
    per_club, _ = _club_series(matches)
    return per_club


def squad_values(matches: pd.DataFrame) -> dict[str, dict]:
    """Canonical club -> latest squad value and its history (EUR millions), for the website.

    A snapshot at date D sums each player's most recent valuation in the 12 months before D,
    under the club he was at when valued (older valuations = retired / unknown players).
    """
    per_club, last = _club_series(matches)
    out = {}
    for team, series in per_club.items():
        when, value = series[-1]
        if when != last:
            continue  # no current squad: club left the covered leagues
        year_ago = [v for d, v in series if d <= last - pd.DateOffset(months=12)]
        out[team] = {
            "value": round(value, 1),
            "date": f"{last:%Y-%m-%d}",
            "change12m": round(value - year_ago[-1], 1) if year_ago else None,
            "history": [{"date": f"{d:%Y-%m-%d}", "value": round(v, 1)} for d, v in series[-13:]],
        }
    return out


def _name_key(name: str) -> str:
    from ..teams import strip_accents

    return " ".join(strip_accents(str(name)).lower().replace("-", " ").split())


def player_values(matches: pd.DataFrame) -> dict[tuple[str, str], float]:
    """(canonical club, player name key) -> latest market value in EUR millions.

    Also keyed by (club, last name) when that last name is unique in the squad, because
    ESPN and Transfermarkt often spell first names differently.
    """
    try:
        games, competitions, players = load("games"), load("competitions"), load(PLAYER_FILE)
    except Exception as exc:
        log.warning("Transfermarkt players unavailable: %s", exc)
        return {}
    if players.empty:
        return {}
    mapping = club_map(matches, games, competitions)
    players = players[
        players["current_club_id"].isin(mapping) & players["market_value_in_eur"].notna()
    ]
    players = players[players["last_season"] >= players["last_season"].max() - 1]
    out: dict[tuple[str, str], float] = {}
    for club_id, squad in players.groupby("current_club_id"):
        club = mapping[int(club_id)]
        last_names = squad["name"].map(lambda n: _name_key(n).split(" ")[-1])
        unique_last = last_names.value_counts()
        for name, last, value in zip(
            squad["name"], last_names, squad["market_value_in_eur"], strict=False
        ):
            out[(club, _name_key(name))] = round(float(value) / 1e6, 2)
            if unique_last[last] == 1:
                out[(club, "~" + last)] = round(float(value) / 1e6, 2)
    return out


def lookup_player_value(values: dict, club: str, name: str) -> float | None:
    key = _name_key(name)
    if (club, key) in values:
        return values[(club, key)]
    return values.get((club, "~" + key.split(" ")[-1]))
