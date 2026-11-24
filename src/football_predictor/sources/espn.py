"""ESPN public scoreboard API: UEFA competitions history, fixtures, live results and odds.

``/apis/site/v2/sports/soccer/{slug}/scoreboard?dates={year}&limit=1000`` returns every match
of a calendar year for a competition - finished and scheduled - including DraftKings
moneyline odds for upcoming games. No API key is required.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import numpy as np
import pandas as pd

from ..config import COMPETITIONS, CUP_CODES, FIRST_SEASON, RAW_DIR, competition
from .http import get

log = logging.getLogger(__name__)

BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer"

EVENT_COLUMNS = [
    "espn_id",
    "competition",
    "kickoff",
    "date",
    "season",
    "status",
    "home_espn",
    "away_espn",
    "home_alt",
    "away_alt",
    "home_espn_id",
    "away_espn_id",
    "venue_country",
    "neutral",
    "home_goals",
    "away_goals",
    "odds_home",
    "odds_draw",
    "odds_away",
]

_VOID_STATUSES = {"STATUS_FINAL_AET", "STATUS_FINAL_PEN"}  # 90-minute score unknown


def american_to_decimal(value) -> float:
    """Convert an American moneyline (``"+175"``, ``-150``, ``"EVEN"``) to decimal odds."""
    if value is None:
        return np.nan
    if isinstance(value, str):
        value = value.strip().upper()
        if value in {"EVEN", "EV"}:
            return 2.0
        try:
            value = float(value.replace("+", ""))
        except ValueError:
            return np.nan
    value = float(value)
    if value == 0:
        return np.nan
    return 1 + value / 100 if value > 0 else 1 + 100 / abs(value)


def _moneyline(odds: dict, side: str) -> float:
    ml = (odds.get("moneyline") or {}).get(side) or {}
    for phase in ("close", "open", "current"):
        price = (ml.get(phase) or {}).get("odds")
        if price is not None:
            return american_to_decimal(price)
    legacy = odds.get(f"{side}TeamOdds" if side != "draw" else "drawOdds") or {}
    return american_to_decimal(legacy.get("moneyLine"))


def _status(event: dict) -> str:
    st = event.get("status", {}).get("type", {})
    state, name = st.get("state"), st.get("name", "")
    if state == "pre":
        return "postponed" if name in {"STATUS_POSTPONED", "STATUS_CANCELED"} else "scheduled"
    if state == "in":
        return "live"
    if st.get("completed"):
        return "void" if name in _VOID_STATUSES else "played"
    return "cancelled"


def parse_events(events: list[dict], comp_code: str) -> pd.DataFrame:
    rows = []
    for ev in events:
        try:
            comp = ev["competitions"][0]
            sides = {c["homeAway"]: c for c in comp["competitors"]}
            home, away = sides["home"], sides["away"]
        except (KeyError, IndexError):
            continue
        status = _status(ev)
        kickoff = pd.Timestamp(ev["date"]).tz_convert("UTC")
        odds = (comp.get("odds") or [{}])[0] or {}
        venue = comp.get("venue") or {}
        played = status in {"played", "void", "live"}
        rows.append(
            {
                "espn_id": str(ev["id"]),
                "competition": comp_code,
                "kickoff": kickoff,
                "date": kickoff.tz_localize(None).normalize(),
                "season": kickoff.year if kickoff.month >= 7 else kickoff.year - 1,
                "status": status,
                "home_espn": home["team"].get("displayName", ""),
                "away_espn": away["team"].get("displayName", ""),
                "home_alt": home["team"].get("shortDisplayName")
                or home["team"].get("location", ""),
                "away_alt": away["team"].get("shortDisplayName")
                or away["team"].get("location", ""),
                "home_espn_id": str(home["team"].get("id", "")),
                "away_espn_id": str(away["team"].get("id", "")),
                "venue_country": (venue.get("address") or {}).get("country"),
                "neutral": bool(comp.get("neutralSite")),
                "home_goals": pd.to_numeric(home.get("score"), errors="coerce")
                if played
                else np.nan,
                "away_goals": pd.to_numeric(away.get("score"), errors="coerce")
                if played
                else np.nan,
                "odds_home": _moneyline(odds, "home") if odds else np.nan,
                "odds_draw": _moneyline(odds, "draw") if odds else np.nan,
                "odds_away": _moneyline(odds, "away") if odds else np.nan,
            }
        )
    df = pd.DataFrame(rows, columns=EVENT_COLUMNS)
    # A 3-way price set is only usable if every leg is present and sane.
    bad = df[["odds_home", "odds_draw", "odds_away"]].isna().any(axis=1) | (
        df[["odds_home", "odds_draw", "odds_away"]] <= 1
    ).any(axis=1)
    df.loc[bad, ["odds_home", "odds_draw", "odds_away"]] = np.nan
    return df


def fetch_year(comp_code: str, year: int) -> pd.DataFrame:
    slug = competition(comp_code).espn
    resp = get(
        f"{BASE_URL}/{slug}/scoreboard", params={"dates": str(year), "limit": 1000}, timeout=60
    )
    return parse_events(resp.json().get("events", []), comp_code)


def _cache_path(comp_code: str, year: int):
    return RAW_DIR / "espn" / comp_code / f"{year}.parquet"


def load_year(comp_code: str, year: int, *, refresh: bool) -> pd.DataFrame:
    path = _cache_path(comp_code, year)
    if path.exists() and not refresh:
        return pd.read_parquet(path)
    try:
        df = fetch_year(comp_code, year)
    except Exception as exc:
        if path.exists():
            log.warning("ESPN %s %s refresh failed (%s); using cache", comp_code, year, exc)
            return pd.read_parquet(path)
        log.warning("ESPN %s %s unavailable: %s", comp_code, year, exc)
        return pd.DataFrame(columns=EVENT_COLUMNS)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)
    return df


def load_cup_history(*, refresh_current: bool = True, today: date | None = None) -> pd.DataFrame:
    """Every UEFA club-competition match since ``FIRST_SEASON`` (cached per calendar year)."""
    today = today or date.today()
    frames = []
    for code in CUP_CODES:
        for year in range(FIRST_SEASON, today.year + 1):
            refresh = refresh_current and (
                year == today.year or (year == today.year - 1 and today.month == 1)
            )
            frames.append(load_year(code, year, refresh=refresh))
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=EVENT_COLUMNS)
    df = pd.concat(frames, ignore_index=True).drop_duplicates("espn_id", keep="last")
    return df[df["season"] >= FIRST_SEASON].reset_index(drop=True)


def load_current(
    today: date, days_back: int, days_ahead: int, *, refresh: bool = True
) -> pd.DataFrame:
    """Every competition's matches for the calendar year(s) covering the live window.

    One request per competition and year; the caller filters the date window it needs
    (the full year is also used to learn ESPN display names for every current club).
    """
    start, end = today - timedelta(days=days_back), today + timedelta(days=days_ahead)
    frames = []
    for comp in COMPETITIONS:
        for year in sorted({start.year, end.year}):
            frames.append(load_year(comp.code, year, refresh=refresh))
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=EVENT_COLUMNS)
    df = pd.concat(frames, ignore_index=True).drop_duplicates("espn_id", keep="last")
    return df.sort_values("kickoff").reset_index(drop=True)
