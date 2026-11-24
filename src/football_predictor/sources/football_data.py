"""football-data.co.uk: historical results, match statistics, xG and bookmaker odds.

Two file families are used:

* ``/mmz4281/{season}/{div}.csv`` - one file per season for the main European divisions,
  with shots, corners, cards, xG (from 2026/27) and pre-match odds.
* ``/new/{code}.csv`` - one file per country for the "extra" leagues, all seasons, with
  results and closing odds only.

Plus ``fixtures.csv`` / ``new_league_fixtures.csv`` with odds for the next few days.
"""

from __future__ import annotations

import io
import logging
from datetime import date

import numpy as np
import pandas as pd

from ..config import COMPETITIONS, FIRST_SEASON, RAW_DIR
from ..teams import canonical_team
from .http import cached_download, get

log = logging.getLogger(__name__)

BASE_URL = "https://football-data.co.uk"

# Column mapping main files -> unified schema
_STAT_COLUMNS = {
    "HxG": "home_xg",
    "AxG": "away_xg",
    "HS": "home_shots",
    "AS": "away_shots",
    "HST": "home_sot",
    "AST": "away_sot",
    "HC": "home_corners",
    "AC": "away_corners",
    "HF": "home_fouls",
    "AF": "away_fouls",
    "HY": "home_yellow",
    "AY": "away_yellow",
    "HR": "home_red",
    "AR": "away_red",
}

# Odds columns in order of preference (pre-match market average first, closing last).
_ODDS_PREFIXES_MAIN = ("Avg", "BbAv", "B365", "PS", "WH", "AvgC", "PSC", "B365C", "Max")
_ODDS_PREFIXES_EXTRA = ("AvgC", "PSC", "B365C", "MaxC", "Avg", "PS", "B365")

_EXTRA_LEAGUE_NAMES = {  # (Country, League) as written in new_league_fixtures.csv
    ("Austria", "Bundesliga"): "AUT",
    ("Switzerland", "Super League"): "SWZ",
    ("Denmark", "Superliga"): "DNK",
    ("Norway", "Eliteserien"): "NOR",
    ("Sweden", "Allsvenskan"): "SWE",
}


def current_season(today: date | None = None) -> int:
    """Start year of the European season in progress (July -> June)."""
    today = today or date.today()
    return today.year if today.month >= 7 else today.year - 1


def _season_code(start_year: int) -> str:
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def _read_csv(raw: bytes) -> pd.DataFrame:
    # Most files are Latin-1, some newer ones UTF-8 ("Preußen Münster"): try UTF-8 first.
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    text = text.lstrip("﻿").lstrip("ï»¿")
    df = pd.read_csv(io.StringIO(text), on_bad_lines="skip", low_memory=False)
    df.columns = [str(c).strip() for c in df.columns]
    return df.dropna(axis=1, how="all")


def _pick_odds(df: pd.DataFrame, prefixes: tuple[str, ...]) -> pd.DataFrame:
    """Return odds_home/draw/away using the first bookmaker column set that has a value."""
    out = pd.DataFrame(index=df.index, columns=["odds_home", "odds_draw", "odds_away"], dtype=float)
    for prefix in prefixes:
        cols = [f"{prefix}H", f"{prefix}D", f"{prefix}A"]
        if not all(c in df.columns for c in cols):
            continue
        block = df[cols].apply(pd.to_numeric, errors="coerce")
        valid = (block > 1.0).all(axis=1) & out["odds_home"].isna()
        out.loc[valid, ["odds_home", "odds_draw", "odds_away"]] = block.loc[valid].to_numpy()
    return out


def _parse_dates(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, dayfirst=True, format="mixed", errors="coerce").dt.normalize()


def _finalise(df: pd.DataFrame, competition: str) -> pd.DataFrame:
    df["competition"] = competition
    df["home_team"] = df["home_team"].map(lambda n: canonical_team(n, competition))
    df["away_team"] = df["away_team"].map(lambda n: canonical_team(n, competition))
    df["neutral"] = False
    df["source"] = "football-data"
    df["status"] = "played"
    df = df.dropna(subset=["date", "home_team", "away_team", "home_goals", "away_goals"])
    df["home_goals"] = df["home_goals"].astype(int)
    df["away_goals"] = df["away_goals"].astype(int)
    df["result"] = np.select(
        [df["home_goals"] > df["away_goals"], df["home_goals"] < df["away_goals"]], ["H", "A"], "D"
    )
    return df


def load_main_division(div: str, season: int, *, refresh: bool) -> pd.DataFrame:
    code = _season_code(season)
    path = cached_download(
        f"{BASE_URL}/mmz4281/{code}/{div}.csv",
        RAW_DIR / "football_data" / code / f"{div}.csv",
        refresh=refresh,
    )
    if path is None:
        return pd.DataFrame()
    raw = _read_csv(path.read_bytes())
    if raw.empty or "HomeTeam" not in raw.columns:
        return pd.DataFrame()

    df = pd.DataFrame(
        {
            "date": _parse_dates(raw["Date"]),
            "season": season,
            "home_team": raw["HomeTeam"].astype(str).str.strip(),
            "away_team": raw["AwayTeam"].astype(str).str.strip(),
            "home_goals": pd.to_numeric(raw.get("FTHG"), errors="coerce"),
            "away_goals": pd.to_numeric(raw.get("FTAG"), errors="coerce"),
        }
    )
    for src, dst in _STAT_COLUMNS.items():
        df[dst] = pd.to_numeric(raw[src], errors="coerce") if src in raw.columns else np.nan
    df = pd.concat([df, _pick_odds(raw, _ODDS_PREFIXES_MAIN)], axis=1)
    return _finalise(df, div)


def load_extra_league(code: str, *, refresh: bool) -> pd.DataFrame:
    path = cached_download(
        f"{BASE_URL}/new/{code}.csv",
        RAW_DIR / "football_data" / "extra" / f"{code}.csv",
        refresh=refresh,
    )
    if path is None:
        return pd.DataFrame()
    raw = _read_csv(path.read_bytes())
    season = pd.to_numeric(raw["Season"].astype(str).str[:4], errors="coerce")
    df = pd.DataFrame(
        {
            "date": _parse_dates(raw["Date"]),
            "season": season,
            "home_team": raw["Home"].astype(str).str.strip(),
            "away_team": raw["Away"].astype(str).str.strip(),
            "home_goals": pd.to_numeric(raw["HG"], errors="coerce"),
            "away_goals": pd.to_numeric(raw["AG"], errors="coerce"),
        }
    )
    for dst in _STAT_COLUMNS.values():
        df[dst] = np.nan
    df = pd.concat([df, _pick_odds(raw, _ODDS_PREFIXES_EXTRA)], axis=1)
    df = df[df["season"] >= FIRST_SEASON]
    df["season"] = df["season"].astype(int)
    return _finalise(df, code)


def load_all(*, refresh_current: bool = True, today: date | None = None) -> pd.DataFrame:
    """Load every domestic league configured in :mod:`config` into the unified schema."""
    cur = current_season(today)
    month = (today or date.today()).month
    frames: list[pd.DataFrame] = []
    for comp in COMPETITIONS:
        if comp.fd_main:
            for season in range(FIRST_SEASON, cur + 1):
                # Current season is always refreshed; last season too during the summer break.
                refresh = refresh_current and (
                    season == cur or (season == cur - 1 and month in (6, 7, 8))
                )
                try:
                    frames.append(load_main_division(comp.fd_main, season, refresh=refresh))
                except Exception as exc:  # one broken file must not break the whole pipeline
                    log.warning("football-data %s %s failed: %s", comp.fd_main, season, exc)
        elif comp.fd_extra:
            try:
                frames.append(load_extra_league(comp.fd_extra, refresh=refresh_current))
            except Exception as exc:
                log.warning("football-data extra %s failed: %s", comp.fd_extra, exc)
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def load_fixture_odds() -> pd.DataFrame:
    """Odds for upcoming fixtures (published twice a week by football-data.co.uk)."""
    rows: list[pd.DataFrame] = []
    try:
        raw = _read_csv(get(f"{BASE_URL}/fixtures.csv").content)
        known = {c.fd_main for c in COMPETITIONS if c.fd_main}
        raw = raw[raw["Div"].isin(known)]
        df = pd.DataFrame(
            {
                "competition": raw["Div"],
                "date": _parse_dates(raw["Date"]),
                "home_team": raw["HomeTeam"].astype(str).str.strip(),
                "away_team": raw["AwayTeam"].astype(str).str.strip(),
            }
        )
        rows.append(pd.concat([df, _pick_odds(raw, _ODDS_PREFIXES_MAIN)], axis=1))
    except Exception as exc:
        log.warning("football-data fixtures.csv unavailable: %s", exc)
    try:
        raw = _read_csv(get(f"{BASE_URL}/new_league_fixtures.csv").content)
        comp = [
            _EXTRA_LEAGUE_NAMES.get((c, lg))
            for c, lg in zip(raw["Country"], raw["League"], strict=False)
        ]
        raw["competition"] = comp
        raw = raw[raw["competition"].notna()]
        df = pd.DataFrame(
            {
                "competition": raw["competition"],
                "date": _parse_dates(raw["Date"]),
                "home_team": raw["Home"].astype(str).str.strip(),
                "away_team": raw["Away"].astype(str).str.strip(),
            }
        )
        rows.append(pd.concat([df, _pick_odds(raw, _ODDS_PREFIXES_MAIN)], axis=1))
    except Exception as exc:
        log.warning("football-data new_league_fixtures.csv unavailable: %s", exc)
    if not rows:
        return pd.DataFrame(
            columns=[
                "competition",
                "date",
                "home_team",
                "away_team",
                "odds_home",
                "odds_draw",
                "odds_away",
            ]
        )
    out = pd.concat(rows, ignore_index=True)
    out["home_team"] = [
        canonical_team(n, c) for n, c in zip(out["home_team"], out["competition"], strict=False)
    ]
    out["away_team"] = [
        canonical_team(n, c) for n, c in zip(out["away_team"], out["competition"], strict=False)
    ]
    return out.dropna(subset=["odds_home"])
