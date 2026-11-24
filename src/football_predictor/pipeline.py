"""End-to-end pipeline used by the CLI and the scheduled GitHub Action.

``run()`` = update data -> retrain -> settle finished forecasts -> forecast upcoming
fixtures -> export JSON for the website.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd

from . import __version__
from .config import (
    COMPETITIONS_BY_CODE,
    FIXTURE_DAYS_AHEAD,
    MODEL_PATH,
    RESULT_DAYS_BACK,
    TEAM_DIRECTORY_PATH,
)
from .dataset import (
    MATCH_COLUMNS,
    build_matcher,
    build_matches,
    load_matches,
    map_espn_names,
    match_key,
)
from .export import export_site_data
from .features import build_features
from .model import MatchModel, training_rows
from .predict import predict_fixtures, prepare_fixtures
from .sources import espn, football_data
from .teams import TeamMatcher
from .tracking import LEDGER_COLUMNS, load_ledger, save_ledger, settle, upsert_predictions

log = logging.getLogger(__name__)


@dataclass
class LiveContext:
    matches: pd.DataFrame
    events: pd.DataFrame  # ESPN events (all competitions, current year[s]) with canonical names
    matcher: TeamMatcher
    display_names: dict[str, str]  # canonical team -> ESPN display name
    team_ids: dict[str, str]  # canonical team -> ESPN team id (used for club crests)


def _is_league(code: str) -> bool:
    return COMPETITIONS_BY_CODE[code].kind == "league"


def supplement_with_espn(
    matches: pd.DataFrame, events: pd.DataFrame, matcher: TeamMatcher
) -> pd.DataFrame:
    """Add domestic results ESPN already has but football-data.co.uk has not published yet.

    Only matches between two *known* clubs are added, so an unresolved team name can never
    create a phantom club with an empty history.
    """
    played = events[events["status"].eq("played") & events["competition"].map(_is_league)].copy()
    if played.empty:
        return matches
    played["match_id"] = [
        match_key(d, h, a)
        for d, h, a in zip(played["date"], played["home_team"], played["away_team"], strict=False)
    ]
    known = set(matcher.country)
    fresh = played[
        ~played["match_id"].isin(matches["match_id"])
        & played["home_team"].isin(known)
        & played["away_team"].isin(known)
        & (played["date"] > matches["date"].max() - pd.Timedelta(days=14))
    ].copy()
    if fresh.empty:
        return matches
    fresh["result"] = np.select(
        [fresh["home_goals"] > fresh["away_goals"], fresh["home_goals"] < fresh["away_goals"]],
        ["H", "A"],
        "D",
    )
    fresh["source"] = "espn"
    for col in MATCH_COLUMNS:
        if col not in fresh.columns:
            fresh[col] = np.nan
    log.info("Added %d recent results from ESPN not yet on football-data.co.uk", len(fresh))
    out = pd.concat([matches, fresh[MATCH_COLUMNS]], ignore_index=True)
    return out.sort_values(["date", "competition", "home_team"], kind="stable").reset_index(
        drop=True
    )


def load_live_context(today: date, *, refresh: bool = True) -> LiveContext:
    matches = build_matches(refresh=refresh, today=today)
    matcher = build_matcher(matches[matches["competition"].map(_is_league)])
    raw_events = espn.load_current(today, RESULT_DAYS_BACK, FIXTURE_DAYS_AHEAD, refresh=refresh)
    events = map_espn_names(raw_events, matcher)
    matches = supplement_with_espn(matches, events, matcher)

    # Display names and ESPN ids: UEFA history first, so current-season data wins.
    cups = map_espn_names(espn.load_cup_history(refresh_current=False, today=today), matcher)
    display: dict[str, str] = {}
    team_ids: dict[str, str] = {}
    for frame in (cups, events):
        for side in ("home", "away"):
            for team, name, tid in zip(
                frame[f"{side}_team"], frame[f"{side}_espn"], frame[f"{side}_espn_id"], strict=False
            ):
                display[team] = name
                if tid:
                    team_ids[team] = str(tid)
    return LiveContext(
        matches=matches, events=events, matcher=matcher, display_names=display, team_ids=team_ids
    )


def train_model(matches: pd.DataFrame) -> MatchModel:
    frame, _ = build_features(matches)
    train = training_rows(frame)
    log.info("Training on %d matches", len(train))
    model = MatchModel().fit(train)
    model.metadata["version"] = f"{__version__}+{pd.Timestamp(model.metadata['trained_at']):%Y%m%d}"
    model.save(MODEL_PATH)
    return model


def backtest(
    matches: pd.DataFrame,
    days: int,
    now: pd.Timestamp,
    display: dict[str, str],
    team_ids: dict[str, str] | None = None,
    step_days: int = 7,
) -> pd.DataFrame:
    """Walk-forward forecasts for the last ``days`` days, refitting every ``step_days``.

    Each block is predicted by a model trained only on matches played before the block
    starts, exactly as the live pipeline would have done.
    """
    frame, _ = build_features(matches)
    rows = training_rows(frame)
    start = (now - pd.Timedelta(days=days)).tz_localize(None).normalize()
    end = now.tz_localize(None).normalize()
    out = []
    block = start
    while block < end:
        block_end = min(block + pd.Timedelta(days=step_days), end)
        test = rows[(rows["date"] >= block) & (rows["date"] < block_end)]
        if not test.empty:
            model = MatchModel().fit(rows[rows["date"] < block])
            preds = model.predict(test)
            out.append(test.join(preds))
            log.info("Backtest %s -> %s: %d matches", block.date(), block_end.date(), len(test))
        block = block_end
    if not out:
        return pd.DataFrame(columns=LEDGER_COLUMNS)
    df = pd.concat(out)
    has_odds = df[["odds_home", "odds_draw", "odds_away"]].notna().all(axis=1)
    ledger = pd.DataFrame(
        {
            "match_id": df["match_id"],
            "espn_id": None,
            "competition": df["competition"],
            "kickoff": (df["date"] + pd.Timedelta(hours=15)).dt.tz_localize("UTC"),
            "home_team": df["home_team"],
            "away_team": df["away_team"],
            "home_display": df["home_team"].map(lambda t: display.get(t, t)),
            "away_display": df["away_team"].map(lambda t: display.get(t, t)),
            "home_espn_id": df["home_team"].map(team_ids or {}),
            "away_espn_id": df["away_team"].map(team_ids or {}),
            "p_home": df["p_home"],
            "p_draw": df["p_draw"],
            "p_away": df["p_away"],
            "xg_home": df["xg_home"],
            "xg_away": df["xg_away"],
            "home_elo": df["home_elo"],
            "away_elo": df["away_elo"],
            "odds_home": df["odds_home"],
            "odds_draw": df["odds_draw"],
            "odds_away": df["odds_away"],
            "odds_source": np.where(has_odds, "Market average", None),
            "predicted_at": None,
            "model_version": f"{__version__}-backtest",
            "source": "backtest",
            "status": "settled",
            "home_goals": df["home_goals"],
            "away_goals": df["away_goals"],
            "settled_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    )
    return ledger[LEDGER_COLUMNS].reset_index(drop=True)


def run(*, today: date | None = None, refresh: bool = True, backtest_days: int = 0) -> None:
    now = pd.Timestamp.now(tz="UTC").floor("min")
    today = today or now.date()
    ctx = load_live_context(today, refresh=refresh)

    model = train_model(ctx.matches)
    model_version = model.metadata["version"]

    ledger = load_ledger()
    window = ctx.events[
        (ctx.events["date"] >= pd.Timestamp(today) - pd.Timedelta(days=RESULT_DAYS_BACK))
        & (ctx.events["date"] <= pd.Timestamp(today) + pd.Timedelta(days=FIXTURE_DAYS_AHEAD))
    ]
    ledger = settle(ledger, window, ctx.matches, now)

    fixtures = prepare_fixtures(window, ctx.matcher, football_data.load_fixture_odds(), now)
    log.info("%d upcoming fixtures in the next %d days", len(fixtures), FIXTURE_DAYS_AHEAD)
    preds = predict_fixtures(model, ctx.matches, fixtures)
    ledger = upsert_predictions(ledger, preds, now, model_version)

    if backtest_days > 0:
        bt = backtest(ctx.matches, backtest_days, now, ctx.display_names, ctx.team_ids)
        first_live = ledger.loc[ledger["source"] == "live", "kickoff"].min()
        if pd.notna(first_live):
            bt = bt[bt["kickoff"] < first_live.normalize()]
        # A re-run replaces the previous backtest; live forecasts always take precedence.
        kept = ledger[ledger["source"] != "backtest"]
        bt = bt[~bt["match_id"].isin(kept["match_id"])]
        log.info("Adding %d backtest forecasts to the ledger", len(bt))
        ledger = pd.concat([kept, bt], ignore_index=True)

    save_ledger(ledger)
    save_team_directory(ctx.display_names, ctx.team_ids)
    export_site_data(
        load_ledger(),
        ctx.matches,
        model.metadata,
        now,
        display_names=ctx.display_names,
        team_ids=ctx.team_ids,
    )
    log.info("Done: ledger has %d forecasts", len(ledger))


def export_only() -> None:
    """Re-export website JSON from the saved ledger (no downloads, no training)."""
    now = pd.Timestamp.now(tz="UTC").floor("min")
    meta = MatchModel.load(MODEL_PATH).metadata if MODEL_PATH.exists() else {}
    display, ids = load_team_directory()
    export_site_data(load_ledger(), load_matches(), meta, now, display_names=display, team_ids=ids)


def save_team_directory(display: dict[str, str], ids: dict[str, str]) -> None:
    """Canonical team -> ESPN display name / id, so `export` can also run offline."""
    TEAM_DIRECTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"display": display, "ids": ids}
    TEAM_DIRECTORY_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def load_team_directory() -> tuple[dict[str, str], dict[str, str]]:
    if not TEAM_DIRECTORY_PATH.exists():
        return {}, {}
    data = json.loads(TEAM_DIRECTORY_PATH.read_text(encoding="utf-8"))
    return data.get("display", {}), data.get("ids", {})
