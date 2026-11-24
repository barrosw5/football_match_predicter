"""ESPN public scoreboard API: UEFA competitions and domestic cups, fixtures, live results, odds.

``/apis/site/v2/sports/soccer/{slug}/scoreboard?dates={year}&limit=1000`` returns every match
of a calendar year for a competition - finished and scheduled - including DraftKings
moneyline odds for upcoming games. No API key is required.
"""

from __future__ import annotations

import json
import logging
import re
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


LEAGUE_TEAM_COLUMNS = ["competition", "year", "espn_team_id", "name", "alt"]


def load_league_teams(*, refresh_current: bool = True, today: date | None = None) -> pd.DataFrame:
    """ESPN team ids of every club that played in each covered league, per calendar year.

    ESPN uses the same team id in league and cup matches, so these ids let cup fixtures be
    matched to the right club without guessing from names ("Lille Sud" is not Lille). The
    first 60 matches of a year contain every team of the league, so each request is small.
    """
    today = today or date.today()
    frames = []
    for comp in COMPETITIONS:
        if comp.kind != "league":
            continue
        for year in range(FIRST_SEASON, today.year + 1):
            path = RAW_DIR / "espn_teams" / comp.code / f"{year}.parquet"
            if path.exists() and not (refresh_current and year == today.year):
                frames.append(pd.read_parquet(path))
                continue
            try:
                resp = get(
                    f"{BASE_URL}/{comp.espn}/scoreboard",
                    params={"dates": str(year), "limit": 60},
                    timeout=60,
                )
            except Exception as exc:
                log.warning("ESPN teams %s %s unavailable: %s", comp.code, year, exc)
                if path.exists():
                    frames.append(pd.read_parquet(path))
                continue
            rows = {}
            for ev in resp.json().get("events", []):
                for c in (ev.get("competitions") or [{}])[0].get("competitors", []):
                    team = c.get("team") or {}
                    if team.get("id"):
                        rows[str(team["id"])] = (
                            team.get("displayName", ""),
                            team.get("shortDisplayName") or team.get("location", ""),
                        )
            df = pd.DataFrame(
                [(comp.code, year, tid, n, a) for tid, (n, a) in rows.items()],
                columns=LEAGUE_TEAM_COLUMNS,
            )
            path.parent.mkdir(parents=True, exist_ok=True)
            df.to_parquet(path, index=False)
            frames.append(df)
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=LEAGUE_TEAM_COLUMNS)
    return pd.concat(frames, ignore_index=True)


def load_cup_history(*, refresh_current: bool = True, today: date | None = None) -> pd.DataFrame:
    """Every UEFA and domestic cup match since ``FIRST_SEASON`` (cached per calendar year)."""
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


# ---------------------------------------------------------------------------
# Match summaries (line-ups, goals, cards) and player leaders
# ---------------------------------------------------------------------------

# Line-ups are fetched for these competitions only (one request per match).
LINEUP_COMPETITIONS = ("E0", "SP1", "D1", "I1", "F1", "P1", "N1", "CL", "EL", "ECL", "PTC")

SUMMARY_VERSION = 2  # bump to re-download cached summaries after a parser change

_PLAYER_STATS = {
    "goals": "totalGoals",
    "assists": "goalAssists",
    "shots": "totalShots",
    "sot": "shotsOnTarget",
    "fouls": "foulsCommitted",
    "fouled": "foulsSuffered",
    "offsides": "offsides",
    "yellow": "yellowCards",
    "red": "redCards",
    "saves": "saves",
    "conceded": "goalsConceded",
}

_EVENT_TYPES = {
    "Goal": "goal",
    "Goal - Header": "goal",
    "Goal - Free-kick": "goal",
    "Penalty - Scored": "penalty",
    "Own Goal": "own_goal",
    "Yellow Card": "yellow",
    "Red Card": "red",
    "Substitution": "sub",
}


def _parse_summary(data: dict, home_id: str) -> dict:
    lineups, formations = {"home": [], "away": []}, {}
    for roster in data.get("rosters") or []:
        side = roster.get("homeAway")
        if side not in lineups:
            continue
        formations[side] = roster.get("formation")
        for p in roster.get("roster") or []:
            athlete = p.get("athlete") or {}
            raw = {st.get("name"): st.get("value") or 0 for st in p.get("stats") or []}
            lineups[side].append(
                {
                    "id": str(athlete.get("id", "")) or None,
                    "name": athlete.get("displayName", ""),
                    "pos": (p.get("position") or {}).get("abbreviation"),
                    "place": int(p["formationPlace"])
                    if str(p.get("formationPlace", "")).isdigit()
                    else None,
                    "jersey": p.get("jersey"),
                    "starter": bool(p.get("starter")),
                    "subIn": bool(p.get("subbedIn")),
                    "subOut": bool(p.get("subbedOut")),
                    "stats": {k: int(raw[n]) for k, n in _PLAYER_STATS.items() if n in raw},
                }
            )
    events = []
    for e in data.get("keyEvents") or []:
        kind = _EVENT_TYPES.get((e.get("type") or {}).get("text", ""))
        if kind is None:
            continue
        names = [(p.get("athlete") or {}).get("displayName") for p in e.get("participants") or []]
        team_id = str((e.get("team") or {}).get("id", ""))
        events.append(
            {
                "minute": (e.get("clock") or {}).get("displayValue"),
                "type": kind,
                "side": "home" if team_id == home_id else "away",
                "player": names[0] if names else None,
                "other": names[1] if len(names) > 1 else None,  # assist, or player replaced
            }
        )
    return {"v": SUMMARY_VERSION, "formations": formations, "lineups": lineups, "events": events}


def load_summaries(events: pd.DataFrame, *, max_new: int = 150) -> dict[str, dict]:
    """Line-ups and key events of finished matches, cached per ESPN event id.

    Only ``max_new`` uncached matches are downloaded per call, so the cache fills up over a
    few runs instead of hammering the API.
    """
    wanted = events[events["status"].eq("played") & events["competition"].isin(LINEUP_COMPETITIONS)]
    wanted = wanted.sort_values("kickoff", ascending=False)
    cache_dir = RAW_DIR / "espn_summaries"
    cache_dir.mkdir(parents=True, exist_ok=True)
    out, fetched = {}, 0
    for row in wanted.itertuples():
        path = cache_dir / f"{row.espn_id}.json"
        if path.exists():
            cached = json.loads(path.read_text(encoding="utf-8"))
            if cached.get("v") == SUMMARY_VERSION or fetched >= max_new:
                out[row.espn_id] = cached
                continue
        if fetched >= max_new:
            continue
        slug = competition(row.competition).espn
        try:
            data = get(
                f"{BASE_URL}/{slug}/summary", params={"event": row.espn_id}, timeout=60
            ).json()
        except Exception as exc:
            log.warning("ESPN summary %s unavailable: %s", row.espn_id, exc)
            continue
        fetched += 1
        summary = _parse_summary(data, str(row.home_espn_id))
        if not summary["lineups"]["home"]:
            continue  # line-ups not published (yet)
        path.write_text(json.dumps(summary, ensure_ascii=False), encoding="utf-8")
        out[row.espn_id] = summary
    if fetched:
        log.info("Downloaded %d match summaries (line-ups)", fetched)
    return out


def load_leaders(top: int = 20) -> dict[str, dict]:
    """Top scorers and assist providers of the current season, per competition."""
    out = {}
    for comp in COMPETITIONS:
        try:
            data = get(f"{BASE_URL}/{comp.espn}/statistics", timeout=60).json()
        except Exception as exc:
            log.warning("ESPN leaders %s unavailable: %s", comp.code, exc)
            continue
        cats = {c.get("name"): c.get("leaders") or [] for c in data.get("stats") or []}
        entry = {"season": (data.get("season") or {}).get("displayName")}
        for key, cat in (("goals", "goalsLeaders"), ("assists", "assistsLeaders")):
            rows = []
            for leader in cats.get(cat, [])[:top]:
                athlete = leader.get("athlete") or {}
                team = athlete.get("team") or {}
                matches = re.search(r"Matches:\s*(\d+)", leader.get("displayValue") or "")
                rows.append(
                    {
                        "id": str(athlete.get("id")) if athlete.get("id") else None,
                        "name": athlete.get("displayName", ""),
                        "team": team.get("displayName") or team.get("name") or "",
                        "teamLogo": str(team.get("id")) if team.get("id") else None,
                        "matches": int(matches.group(1)) if matches else None,
                        "value": int(leader.get("value") or 0),
                    }
                )
            entry[key] = rows
        if entry.get("goals"):
            out[comp.code] = entry
    return out


# ---------------------------------------------------------------------------
# Squads
# ---------------------------------------------------------------------------

ROSTER_REFRESH_DAYS = 7


def _roster_row(a: dict) -> dict:
    height, weight = a.get("height"), a.get("weight")
    pos = a.get("position") or {}
    return {
        "id": str(a.get("id")),
        "name": a.get("displayName", ""),
        "pos": pos.get("abbreviation"),
        "posName": pos.get("displayName") or pos.get("name"),
        "jersey": a.get("jersey"),
        "age": a.get("age"),
        "birth": (a.get("dateOfBirth") or "")[:10] or None,
        "nationality": a.get("citizenship"),
        "heightCm": round(float(height) * 2.54) if height else None,
        "weightKg": round(float(weight) * 0.4536) if weight else None,
    }


def load_rosters(teams: dict[str, str]) -> dict[str, list[dict]]:
    """Current squads: ESPN team id -> players. ``teams`` maps team id -> competition code.

    Cached per team and refreshed weekly (squads change slowly).
    """
    import time as _time

    out = {}
    cache_dir = RAW_DIR / "espn_rosters"
    cache_dir.mkdir(parents=True, exist_ok=True)
    for team_id, comp_code in teams.items():
        path = cache_dir / f"{team_id}.json"
        if path.exists() and _time.time() - path.stat().st_mtime < ROSTER_REFRESH_DAYS * 86400:
            out[team_id] = json.loads(path.read_text(encoding="utf-8"))
            continue
        slug = competition(comp_code).espn
        try:
            data = get(f"{BASE_URL}/{slug}/teams/{team_id}/roster", timeout=60).json()
        except Exception as exc:
            log.warning("ESPN roster %s unavailable: %s", team_id, exc)
            if path.exists():
                out[team_id] = json.loads(path.read_text(encoding="utf-8"))
            continue
        players = [_roster_row(a) for a in data.get("athletes") or []]
        path.write_text(json.dumps(players, ensure_ascii=False), encoding="utf-8")
        out[team_id] = players
    return out


def load_competition_logos() -> dict[str, str]:
    """Competition code -> logo URL (from each scoreboard's league block), cached for 30 days."""
    import time as _time

    path = RAW_DIR / "espn_logos.json"
    if path.exists() and _time.time() - path.stat().st_mtime < 30 * 86400:
        return json.loads(path.read_text(encoding="utf-8"))
    logos: dict[str, str] = {}
    for comp in COMPETITIONS:
        try:
            data = get(f"{BASE_URL}/{comp.espn}/scoreboard", timeout=60).json()
        except Exception as exc:
            log.warning("ESPN logo %s unavailable: %s", comp.code, exc)
            continue
        league = (data.get("leagues") or [{}])[0]
        hrefs = [lg.get("href") for lg in league.get("logos") or [] if lg.get("href")]
        if not hrefs and league.get("id"):
            hrefs = [f"https://a.espncdn.com/i/leaguelogos/soccer/500/{league['id']}.png"]
        if hrefs:
            logos[comp.code] = hrefs[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(logos), encoding="utf-8")
    return logos
