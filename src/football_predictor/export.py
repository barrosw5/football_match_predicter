"""Export the ledger and upcoming forecasts as JSON files for the website."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    COMPETITIONS,
    COMPETITIONS_BY_CODE,
    VALUE_EDGE,
    WEB_BUILD_DATA_DIR,
    WEB_DATA_DIR,
)
from .dataset import match_key
from .predict import FormIndex
from .profiles import build_profiles, players_table, team_slug
from .ranking import build_ranking
from .sources import espn, transfermarkt
from .tracking import scored

WINDOWS = {"7d": 7, "30d": 30, "90d": 90, "all": None}
RESULTS_HISTORY_DAYS = 120


def _num(x, digits: int = 4):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return round(float(x), digits)


def _iso(ts) -> str:
    return pd.Timestamp(ts).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")


_LOGOS: dict[str, str] = {}  # competition code -> logo URL, set by export_site_data


def _competition(code: str) -> dict:
    c = COMPETITIONS_BY_CODE[code]
    return {"code": c.code, "name": c.name, "country": c.country, "logo": _LOGOS.get(code)}


def _odds(row) -> dict | None:
    if any(pd.isna(row[f"odds_{k}"]) for k in ("home", "draw", "away")):
        return None
    return {
        "home": _num(row["odds_home"], 2),
        "draw": _num(row["odds_draw"], 2),
        "away": _num(row["odds_away"], 2),
        "source": row["odds_source"] if isinstance(row["odds_source"], str) else None,
    }


def _value(row) -> dict | None:
    odds = _odds(row)
    if odds is None:
        return None
    best = None
    for key, outcome in (("home", "H"), ("draw", "D"), ("away", "A")):
        edge = row[f"p_{key}"] * odds[key] - 1
        if edge > VALUE_EDGE and (best is None or edge > best["edge"]):
            best = {"outcome": outcome, "odds": odds[key], "edge": _num(edge)}
    return best


def _base(row) -> dict:
    probs = {"home": _num(row["p_home"]), "draw": _num(row["p_draw"]), "away": _num(row["p_away"])}
    pick = max(
        (("H", probs["home"]), ("D", probs["draw"]), ("A", probs["away"])), key=lambda kv: kv[1]
    )[0]
    return {
        "id": row["match_id"],
        "kickoff": _iso(row["kickoff"]),
        "competition": _competition(row["competition"]),
        "probs": probs,
        "xg": {"home": _num(row["xg_home"], 2), "away": _num(row["xg_away"], 2)},
        "pick": pick,
        "odds": _odds(row),
        "value": _value(row),
        "market": _market(row),
        "source": row["source"],
    }


def _market(row) -> dict | None:
    """Bookmakers' view: margin-free probabilities and favourite."""
    odds = _odds(row)
    if odds is None:
        return None
    inv = {k: 1 / odds[k] for k in ("home", "draw", "away")}
    total = sum(inv.values())
    probs = {k: _num(v / total) for k, v in inv.items()}
    pick = max(
        (("H", probs["home"]), ("D", probs["draw"]), ("A", probs["away"])), key=lambda kv: kv[1]
    )[0]
    return {"probs": probs, "pick": pick}


def _team(row, side: str, form: FormIndex | None, values: dict | None = None) -> dict:
    name = (
        row[f"{side}_display"] if isinstance(row[f"{side}_display"], str) else row[f"{side}_team"]
    )
    tid = row.get(f"{side}_espn_id")
    team = {
        "name": name,
        "key": row[f"{side}_team"],
        "elo": _num(row[f"{side}_elo"], 0),
        "logo": str(tid) if isinstance(tid, str) and tid else None,
        "value": (values or {}).get(row[f"{side}_team"], {}).get("value"),
    }
    if form is not None:
        team["form"] = form.last(row[f"{side}_team"], _match_day(row))
    return team


def _match_day(row) -> pd.Timestamp:
    return pd.Timestamp(row["kickoff"]).tz_convert("UTC").tz_localize(None).normalize()


def fixtures_payload(
    ledger: pd.DataFrame, form: FormIndex, now: pd.Timestamp, values: dict | None = None
) -> list[dict]:
    pending = ledger[ledger["status"] == "pending"].sort_values("kickoff")
    out = []
    for _, row in pending.iterrows():
        item = _base(row)
        item["status"] = "upcoming" if row["kickoff"] > now else "awaiting_result"
        item["home"] = _team(row, "home", form, values)
        item["away"] = _team(row, "away", form, values)
        out.append(item)
    return out


def match_stats_payload(
    ledger: pd.DataFrame, sc: pd.DataFrame, form: FormIndex, now: pd.Timestamp
) -> dict:
    """Both teams' last 10 matches with statistics, for every match page (build time only)."""
    rows = [ledger[ledger["status"] == "pending"]]
    if not sc.empty:
        rows.append(sc[sc["kickoff"] >= now - pd.Timedelta(days=RESULTS_HISTORY_DAYS)])
    out = {}
    for frame in rows:
        for _, row in frame.iterrows():
            day = _match_day(row)
            out[row["match_id"]] = {
                "home": form.last(row["home_team"], day, 10, detailed=True),
                "away": form.last(row["away_team"], day, 10, detailed=True),
            }
    return out


def results_payload(sc: pd.DataFrame, now: pd.Timestamp, values: dict | None = None) -> list[dict]:
    recent = sc[sc["kickoff"] >= now - pd.Timedelta(days=RESULTS_HISTORY_DAYS)].sort_values(
        "kickoff", ascending=False
    )
    out = []
    for _, row in recent.iterrows():
        item = _base(row)
        item["home"] = _team(row, "home", None, values)
        item["away"] = _team(row, "away", None, values)
        item.update(
            {
                "score": {"home": int(row["home_goals"]), "away": int(row["away_goals"])},
                "actual": row["actual"],
                "correct": bool(row["correct"]),
                "pActual": _num(row["p_actual"]),
                "brier": _num(row["brier"]),
                "goalError": _num(row["goal_error"], 2),
                "predScore": row["pred_score"],
                "exactScore": bool(row["exact_score"]),
                "marketPick": row["market_pick"] if isinstance(row["market_pick"], str) else None,
                "marketCorrect": bool(row["market_correct"]) if row["has_odds"] else None,
                "valueProfit": _num(row["value_profit"], 3),
            }
        )
        out.append(item)
    return out


def _stats(df: pd.DataFrame) -> dict:
    n = len(df)
    if n == 0:
        return {"n": 0}
    with_odds = df[df["has_odds"]]
    value = df[df["value_pick"].notna()]
    by_outcome = {}
    for o in ("H", "D", "A"):
        picked = df[df["pick"] == o]
        by_outcome[o] = {
            "predicted": int(len(picked)),
            "correct": int(picked["correct"].sum()),
            "actual": int((df["actual"] == o).sum()),
        }
    return {
        "n": n,
        "correct": int(df["correct"].sum()),
        "accuracy": _num(df["correct"].mean()),
        "brier": _num(df["brier"].mean()),
        "logLoss": _num(df["log_loss"].mean()),
        "rps": _num(df["rps"].mean()),
        "goalMae": _num(df["goal_error"].mean() / 2, 3),
        "exactScores": int(df["exact_score"].sum()),
        "avgPActual": _num(df["p_actual"].mean()),
        "market": _market_comparison(with_odds),
        "value": {
            "bets": int(len(value)),
            "won": int((value["value_profit"] > 0).sum()),
            "profit": _num(value["value_profit"].sum(), 2),
            "roi": _num(value["value_profit"].mean()) if len(value) else None,
        },
        "byOutcome": by_outcome,
        "sources": {k: int(v) for k, v in df["source"].value_counts().items()},
    }


def _market_comparison(w: pd.DataFrame) -> dict:
    """Model vs bookmakers on exactly the same matches (those with odds)."""
    if w.empty:
        return {"n": 0, "accuracy": None, "modelAccuracy": None}
    market_correct = w["market_correct"].astype(bool)
    disagree = w[w["pick"] != w["market_pick"]]
    d_model = disagree["correct"].astype(bool)
    d_market = disagree["market_correct"].astype(bool)
    return {
        "n": int(len(w)),
        "accuracy": _num(market_correct.mean()),
        "modelAccuracy": _num(w["correct"].mean()),
        "correct": int(market_correct.sum()),
        "modelCorrect": int(w["correct"].sum()),
        "brier": _num(w["market_brier"].mean()),
        "modelBrier": _num(w["brier"].mean()),
        "pActual": _num(w["market_p_actual"].mean()),
        "modelPActual": _num(w["p_actual"].mean()),
        "agree": int(len(w) - len(disagree)),
        "disagree": {
            "n": int(len(disagree)),
            "model": int(d_model.sum()),
            "market": int(d_market.sum()),
            "neither": int((~d_model & ~d_market).sum()),
        },
    }


def _by_competition(df: pd.DataFrame) -> list[dict]:
    rows = []
    for code, g in df.groupby("competition"):
        rows.append(
            {
                **_competition(code),
                "n": int(len(g)),
                "correct": int(g["correct"].sum()),
                "accuracy": _num(g["correct"].mean()),
                "brier": _num(g["brier"].mean()),
            }
        )
    return sorted(rows, key=lambda r: -r["n"])


def _calibration(df: pd.DataFrame, bins: int = 10) -> list[dict]:
    if df.empty:
        return []
    probs = df[["p_home", "p_draw", "p_away"]].to_numpy(float).ravel()
    actual = np.eye(3)[df["actual"].map({"H": 0, "D": 1, "A": 2}).to_numpy()].ravel()
    idx = np.clip((probs * bins).astype(int), 0, bins - 1)
    out = []
    for b in range(bins):
        m = idx == b
        if m.sum() >= 5:
            out.append(
                {
                    "bin": b / bins,
                    "predicted": _num(probs[m].mean()),
                    "observed": _num(actual[m].mean()),
                    "n": int(m.sum()),
                }
            )
    return out


def performance_payload(sc: pd.DataFrame, now: pd.Timestamp) -> dict:
    windows = {}
    for key, days in WINDOWS.items():
        df = sc if days is None else sc[sc["kickoff"] >= now - pd.Timedelta(days=days)]
        windows[key] = {
            **_stats(df),
            "byCompetition": _by_competition(df) if len(df) else [],
            "calibration": _calibration(df),
        }

    daily = []
    if not sc.empty:
        recent = sc[sc["kickoff"] >= now - pd.Timedelta(days=90)].copy()
        recent["day"] = recent["kickoff"].dt.strftime("%Y-%m-%d")
        for day, g in recent.groupby("day"):
            daily.append(
                {
                    "date": day,
                    "n": int(len(g)),
                    "correct": int(g["correct"].sum()),
                    "brier": _num(g["brier"].mean()),
                }
            )
    return {"windows": windows, "daily": daily}


def ranking_payload(
    matches: pd.DataFrame,
    now: pd.Timestamp,
    display_names: dict[str, str] | None,
    team_ids: dict[str, str] | None,
    values: dict,
) -> list[dict]:
    rows = build_ranking(matches, now, display_names, team_ids)
    for r in rows:
        v = values.get(r["key"])
        r["value"] = v["value"] if v else None
        r["valueChange12m"] = v["change12m"] if v else None
        r["valueHistory"] = [h["value"] for h in v["history"]] if v else []
    return rows


def lineups_payload(
    ledger: pd.DataFrame,
    sc: pd.DataFrame,
    now: pd.Timestamp,
    summaries: dict[str, dict] | None,
    events: pd.DataFrame | None,
) -> dict:
    """Line-ups/events of published results and each team's last starting XI before a fixture."""
    out: dict = {"results": {}, "lastXI": {}}
    if not summaries or events is None or events.empty:
        return out
    ev = events[events["espn_id"].isin(summaries)].copy()
    ev["match_id"] = [
        match_key(d, h, a)
        for d, h, a in zip(ev["date"], ev["home_team"], ev["away_team"], strict=False)
    ]
    by_match = dict(zip(ev["match_id"], ev["espn_id"], strict=False))
    if not sc.empty:
        published = sc[sc["kickoff"] >= now - pd.Timedelta(days=RESULTS_HISTORY_DAYS)]["match_id"]
        out["results"] = {m: summaries[by_match[m]] for m in published if m in by_match}

    team_games: dict[str, list] = {}
    for r in ev.itertuples():
        s = summaries[r.espn_id]
        for side, tid, opp, opp_id in (
            ("home", r.home_espn_id, r.away_espn, r.away_espn_id),
            ("away", r.away_espn_id, r.home_espn, r.home_espn_id),
        ):
            team_games.setdefault(str(tid), []).append((r.kickoff, s, side, opp, opp_id))
    for games in team_games.values():
        games.sort(key=lambda g: g[0])
    for _, row in ledger[ledger["status"] == "pending"].iterrows():
        entry = {}
        for side in ("home", "away"):
            games = [
                g for g in team_games.get(str(row[f"{side}_espn_id"]), []) if g[0] < row["kickoff"]
            ]
            if games:
                kickoff, s, played_as, opponent, opponent_id = games[-1]
                entry[side] = {
                    "date": f"{kickoff:%Y-%m-%d}",
                    "opponent": opponent,
                    "opponentLogo": str(opponent_id) if pd.notna(opponent_id) and opponent_id != "" else None,
                    "formation": s["formations"].get(played_as),
                    "players": [p for p in s["lineups"][played_as] if p["starter"]],
                }
        if entry:
            out["lastXI"][row["match_id"]] = entry
    return out


def export_site_data(
    ledger: pd.DataFrame,
    matches: pd.DataFrame,
    model_meta: dict,
    now: pd.Timestamp,
    out_dir: Path = WEB_DATA_DIR,
    build_dir: Path = WEB_BUILD_DATA_DIR,
    display_names: dict[str, str] | None = None,
    team_ids: dict[str, str] | None = None,
    summaries: dict[str, dict] | None = None,
    espn_events: pd.DataFrame | None = None,
    leaders: dict | None = None,
    rosters: dict[str, list[dict]] | None = None,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    sc = scored(ledger)
    generated = _iso(now)
    form = FormIndex(matches, display_names, team_ids)
    try:
        values = transfermarkt.squad_values(matches)
        player_values = transfermarkt.player_values(matches)
    except Exception:  # optional data
        values, player_values = {}, {}
    try:
        logos = espn.load_competition_logos()
    except Exception:
        logos = {}
    _LOGOS.clear()
    _LOGOS.update(logos)
    value_date = next(iter(values.values()))["date"] if values else None
    fixtures = fixtures_payload(ledger, form, now, values)
    results = results_payload(sc, now, values)
    ranking = ranking_payload(matches, now, display_names, team_ids, values)
    payloads = {
        "fixtures.json": {"generatedAt": generated, "fixtures": fixtures},
        "results.json": {"generatedAt": generated, "results": results},
        "ranking.json": {"generatedAt": generated, "valueDate": value_date, "clubs": ranking},
        "performance.json": {"generatedAt": generated, **performance_payload(sc, now)},
        "meta.json": {
            "generatedAt": generated,
            "model": model_meta,
            "valueEdge": VALUE_EDGE,
            "competitions": [
                {
                    "code": c.code,
                    "name": c.name,
                    "country": c.country,
                    "kind": c.kind,
                    "logo": logos.get(c.code),
                }
                for c in COMPETITIONS
            ],
            "counts": {
                "matchesInDatabase": int(len(matches)),
                "trackedPredictions": int(len(ledger)),
                "settled": int((ledger["status"] == "settled").sum()),
                "upcoming": int(sum(f["status"] == "upcoming" for f in fixtures)),
            },
            "dataRange": {
                "from": str(pd.to_datetime(matches["date"]).min().date()),
                "to": str(pd.to_datetime(matches["date"]).max().date()),
            },
        },
    }
    if leaders:
        payloads["players.json"] = {"generatedAt": generated, "competitions": leaders}
    for name, payload in payloads.items():
        (out_dir / name).write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    # Larger data that only the static build needs: never served to visitors as a whole.
    build_dir.mkdir(parents=True, exist_ok=True)
    (build_dir / "match-stats.json").write_text(
        json.dumps(
            match_stats_payload(ledger, sc, form, now), ensure_ascii=False, separators=(",", ":")
        ),
        encoding="utf-8",
    )
    (build_dir / "lineups.json").write_text(
        json.dumps(
            lineups_payload(ledger, sc, now, summaries, espn_events),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    teams, players = build_profiles(
        matches=matches,
        ledger=ledger,
        scored_rows=sc,
        ranking=ranking,
        values=values,
        rosters=rosters or {},
        summaries=summaries,
        events=espn_events,
        leaders=leaders,
        display_names=display_names or {},
        team_ids=team_ids or {},
        now=now,
        published_ids={f["id"] for f in fixtures} | {r["id"] for r in results},
        player_values=player_values,
    )
    table = players_table(
        summaries, espn_events, now, {r["key"]: team_slug(r["key"]) for r in ranking}, player_values
    )
    (out_dir / "players-table.json").write_text(
        json.dumps({"generatedAt": generated, **table}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (build_dir / "teams.json").write_text(
        json.dumps(teams, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    # One small file per player, fetched by the browser on the player page.
    player_dir = out_dir / "player"
    player_dir.mkdir(exist_ok=True)
    for old in player_dir.glob("*.json"):
        old.unlink()
    for pid, profile in players.items():
        (player_dir / f"{pid}.json").write_text(
            json.dumps(profile, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    stale = out_dir / "form.json"
    if stale.exists():
        stale.unlink()
