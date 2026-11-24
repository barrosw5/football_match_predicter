"""Team and player profiles for the website (one page per club, one per player).

Everything here is assembled from data the pipeline already has: the match table, the
prediction ledger, the Elo timeline, Transfermarkt squad values, ESPN squads, ESPN match
summaries (line-ups and events) and ESPN season leaders.
"""

from __future__ import annotations

import pandas as pd

from .dataset import _slug, match_key
from .ranking import elo_timeline
from .sources.transfermarkt import lookup_player_value


def team_slug(team: str) -> str:
    return _slug(team)


def _text(value, fallback: str) -> str:
    return value if isinstance(value, str) and value else fallback


def _appearances(
    summaries: dict[str, dict], events: pd.DataFrame | None, published_ids: set[str]
) -> dict[str, list[dict]]:
    """ESPN athlete id -> matches played (from cached line-ups), newest first."""
    out: dict[str, list[dict]] = {}
    if not summaries or events is None or events.empty:
        return out
    ev = events[events["espn_id"].isin(summaries)]
    for r in ev.itertuples():
        s = summaries[r.espn_id]
        mid = match_key(r.date, r.home_team, r.away_team)
        for side, opp_side in (("home", "away"), ("away", "home")):
            gf = r.home_goals if side == "home" else r.away_goals
            ga = r.away_goals if side == "home" else r.home_goals
            team_events = [e for e in s.get("events", []) if e.get("side") == side]
            for p in s["lineups"].get(side, []):
                if not p.get("id") or not (p.get("starter") or p.get("subIn")):
                    continue
                name = p.get("name")
                out.setdefault(p["id"], []).append(
                    {
                        "date": f"{r.date:%Y-%m-%d}",
                        "matchId": mid if mid in published_ids else None,
                        "competition": r.competition,
                        "home": side == "home",
                        "opponent": getattr(r, f"{opp_side}_espn"),
                        "opponentLogo": str(getattr(r, f"{opp_side}_espn_id")) or None,
                        "goalsFor": None if pd.isna(gf) else int(gf),
                        "goalsAgainst": None if pd.isna(ga) else int(ga),
                        "started": bool(p.get("starter")),
                        "goals": sum(
                            1
                            for e in team_events
                            if e["type"] in ("goal", "penalty") and e.get("player") == name
                        ),
                        "assists": sum(
                            1
                            for e in team_events
                            if e["type"] in ("goal", "penalty") and e.get("other") == name
                        ),
                        "yellow": any(
                            e["type"] == "yellow" and e.get("player") == name for e in team_events
                        ),
                        "red": any(
                            e["type"] == "red" and e.get("player") == name for e in team_events
                        ),
                        "shots": (p.get("stats") or {}).get("shots"),
                        "sot": (p.get("stats") or {}).get("sot"),
                    }
                )
    for games in out.values():
        games.sort(key=lambda g: g["date"], reverse=True)
    return out


def build_profiles(
    *,
    matches: pd.DataFrame,
    ledger: pd.DataFrame,
    scored_rows: pd.DataFrame,
    ranking: list[dict],
    values: dict[str, dict],
    rosters: dict[str, list[dict]],
    summaries: dict[str, dict] | None,
    events: pd.DataFrame | None,
    leaders: dict | None,
    display_names: dict[str, str],
    team_ids: dict[str, str],
    now: pd.Timestamp,
    published_ids: set[str],
    player_values: dict | None = None,
) -> tuple[dict[str, dict], dict[str, dict]]:
    """Return ``(teams, players)``: team slug -> profile, ESPN athlete id -> profile."""
    ranked = {r["key"]: r for r in ranking}
    slugs = {key: team_slug(key) for key in ranked}
    today = pd.Timestamp(now).tz_convert("UTC").tz_localize(None).normalize()

    timeline = elo_timeline(matches)
    elo_year = timeline[timeline["date"] > today - pd.Timedelta(days=365)]
    elo_by_team = {t: g for t, g in elo_year.groupby("team")}

    played = matches[matches["status"].isin(["played", "void"])].sort_values(
        "date", ascending=False
    )

    season_stats: dict[tuple[str, str], dict] = {}  # (team id, player name) -> goals / assists
    for comp, entry in (leaders or {}).items():
        for kind in ("goals", "assists"):
            for row in entry.get(kind, []):
                key = (row.get("teamLogo") or "", row.get("name"))
                season_stats.setdefault(key, {}).setdefault(kind, {})[comp] = row.get("value")

    appearances = _appearances(summaries or {}, events, published_ids)
    pending = ledger[(ledger["status"] == "pending") & (ledger["kickoff"] > now)]

    teams: dict[str, dict] = {}
    players: dict[str, dict] = {}
    for key, r in ranked.items():
        slug = slugs[key]
        tid = team_ids.get(key)
        own = played[(played["home_team"] == key) | (played["away_team"] == key)]
        history = []
        for m in own.itertuples():
            home = m.home_team == key
            opp = m.away_team if home else m.home_team
            gf, ga = (m.home_goals, m.away_goals) if home else (m.away_goals, m.home_goals)
            history.append(
                [
                    f"{m.date:%Y-%m-%d}",
                    m.competition,
                    1 if home else 0,
                    display_names.get(opp, opp),
                    slugs.get(opp),
                    int(gf),
                    int(ga),
                    m.match_id if m.match_id in published_ids else None,
                    team_ids.get(opp) or None,
                ]
            )

        upcoming = []
        for _, f in pending[
            (pending["home_team"] == key) | (pending["away_team"] == key)
        ].iterrows():
            home = f["home_team"] == key
            opp = f["away_team"] if home else f["home_team"]
            probs = [f["p_home"], f["p_draw"], f["p_away"]]
            upcoming.append(
                {
                    "id": f["match_id"],
                    "kickoff": pd.Timestamp(f["kickoff"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "competition": f["competition"],
                    "home": bool(home),
                    "opponent": _text(f["away_display" if home else "home_display"], opp),
                    "opponentSlug": slugs.get(opp),
                    "opponentLogo": team_ids.get(opp) or None,
                    "win": round(float(probs[0] if home else probs[2]), 4),
                    "draw": round(float(probs[1]), 4),
                    "loss": round(float(probs[2] if home else probs[0]), 4),
                }
            )
        upcoming.sort(key=lambda x: x["kickoff"])

        record = []
        if not scored_rows.empty:
            mine = scored_rows[
                (scored_rows["home_team"] == key) | (scored_rows["away_team"] == key)
            ]
            for _, s in mine.sort_values("kickoff", ascending=False).head(40).iterrows():
                home = s["home_team"] == key
                opp = s["away_team"] if home else s["home_team"]
                record.append(
                    {
                        "id": s["match_id"] if s["match_id"] in published_ids else None,
                        "date": pd.Timestamp(s["kickoff"]).strftime("%Y-%m-%d"),
                        "competition": s["competition"],
                        "home": bool(home),
                        "opponent": display_names.get(opp, opp),
                        "opponentSlug": slugs.get(opp),
                        "opponentLogo": team_ids.get(opp) or None,
                        "goalsFor": int(s["home_goals"] if home else s["away_goals"]),
                        "goalsAgainst": int(s["away_goals"] if home else s["home_goals"]),
                        "pick": s["pick"],
                        "correct": bool(s["correct"]),
                    }
                )

        squad = []
        for p in rosters.get(tid or "", []):
            stats = season_stats.get((tid or "", p["name"]), {})
            goals = sum((stats.get("goals") or {}).values()) or None
            assists = sum((stats.get("assists") or {}).values()) or None
            apps = appearances.get(p["id"], [])
            squad.append({**p, "goals": goals, "assists": assists, "apps": len(apps)})
            players[p["id"]] = {
                **p,
                "value": lookup_player_value(player_values or {}, key, p["name"]),
                "team": {"slug": slug, "name": r["name"], "logo": r["logo"]},
                "season": {
                    "goals": stats.get("goals") or {},
                    "assists": stats.get("assists") or {},
                },
                "appearances": apps[:40],
            }

        elo_pts = elo_by_team.get(key)
        v = values.get(key)
        teams[slug] = {
            **{
                k: r[k]
                for k in (
                    "key",
                    "name",
                    "logo",
                    "country",
                    "league",
                    "rank",
                    "elo",
                    "change7",
                    "change30",
                    "elo30",
                )
            },
            "slug": slug,
            "value": v["value"] if v else None,
            "valueDate": v["date"] if v else None,
            "valueHistory": v["history"] if v else [],
            "eloHistory": []
            if elo_pts is None
            else [
                [f"{d:%Y-%m-%d}", round(float(e), 1)]
                for d, e in zip(elo_pts["date"], elo_pts["elo"], strict=False)
            ],
            "history": history,
            "upcoming": upcoming,
            "record": record,
            "squad": squad,
        }
    return teams, players


STAT_KEYS = (
    "goals",
    "assists",
    "shots",
    "sot",
    "fouls",
    "fouled",
    "offsides",
    "yellow",
    "red",
    "saves",
)


TABLE_EXCLUDED = ("PTC",)


def players_table(
    summaries: dict[str, dict] | None,
    events: pd.DataFrame | None,
    now: pd.Timestamp,
    team_slugs: dict[str, str],
    player_values: dict | None = None,
) -> dict:
    """Season totals per player and competition, from the line-ups of this season's matches."""
    if not summaries or events is None or events.empty:
        return {"season": None, "competitions": {}}
    today = pd.Timestamp(now).tz_convert("UTC").tz_localize(None)
    start = pd.Timestamp(year=today.year if today.month >= 7 else today.year - 1, month=7, day=1)
    # Leagues and UEFA only: ESPN publishes cup line-ups for a handful of matches, so cup
    # totals would be misleading.
    ev = events[
        events["espn_id"].isin(summaries)
        & (events["date"] >= start)
        & ~events["competition"].isin(TABLE_EXCLUDED)
    ]
    table: dict[str, dict[str, dict]] = {}
    for r in ev.itertuples():
        s = summaries[r.espn_id]
        for side in ("home", "away"):
            club = getattr(r, f"{side}_team")
            for p in s["lineups"].get(side, []):
                if not p.get("id") or not (p.get("starter") or p.get("subIn")):
                    continue
                row = table.setdefault(r.competition, {}).setdefault(
                    p["id"],
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "pos": p.get("pos"),
                        "team": getattr(r, f"{side}_espn"),
                        "teamLogo": str(getattr(r, f"{side}_espn_id")) or None,
                        "teamSlug": team_slugs.get(club),
                        "value": lookup_player_value(player_values or {}, club, p["name"]),
                        "apps": 0,
                        "starts": 0,
                        **{k: 0 for k in STAT_KEYS},
                    },
                )
                row["apps"] += 1
                row["starts"] += int(bool(p.get("starter")))
                for k in STAT_KEYS:
                    row[k] += int((p.get("stats") or {}).get(k) or 0)
    return {
        "season": f"{start.year}/{(start.year + 1) % 100:02d}",
        "competitions": {
            comp: sorted(rows.values(), key=lambda x: (-x["goals"], -x["assists"], x["name"]))
            for comp, rows in table.items()
        },
    }
