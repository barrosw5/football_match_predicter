"""Feature engineering.

Every feature of a match is computed **only from information available before kick-off**,
so the same code produces training rows for past matches and inference rows for upcoming
fixtures. Two techniques guarantee this:

* sequential loops (Elo, league tables) record the state *before* applying a result, and
  only apply results of finished matches;
* rolling team statistics are computed as "state after each match" and attached to a
  fixture with ``merge_asof(..., allow_exact_matches=False)`` -> the latest state strictly
  before the fixture's date.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .config import COMPETITIONS_BY_CODE, ELO_HOME_ADVANTAGE, ELO_K, ROLLING_WINDOWS

RESULT_TO_INT = {"H": 0, "D": 1, "A": 2}

# ---------------------------------------------------------------------------
# Elo
# ---------------------------------------------------------------------------


def _goal_multiplier(goal_diff: int) -> float:
    """World-Football-Elo margin-of-victory multiplier."""
    gd = abs(goal_diff)
    if gd <= 1:
        return 1.0
    if gd == 2:
        return 1.5
    return (11 + gd) / 8


def elo_ratings(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    """Pre-match Elo for every row (chronological order required) + final ratings."""
    ratings: dict[str, float] = {}
    home_pre = np.empty(len(df))
    away_pre = np.empty(len(df))
    played = df["status"].eq("played").to_numpy() & df["result"].isin(["H", "D", "A"]).to_numpy()

    for i, (home, away, comp, hg, ag, neutral) in enumerate(
        zip(
            df["home_team"],
            df["away_team"],
            df["competition"],
            df["home_goals"],
            df["away_goals"],
            df["neutral"],
            strict=False,
        )
    ):
        prior = COMPETITIONS_BY_CODE[comp].elo_prior
        rh = ratings.setdefault(home, prior)
        ra = ratings.setdefault(away, prior)
        home_pre[i], away_pre[i] = rh, ra
        if not played[i]:
            continue
        adv = 0.0 if neutral else ELO_HOME_ADVANTAGE
        expected = 1.0 / (1.0 + 10 ** (-(rh + adv - ra) / 400))
        actual = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
        delta = ELO_K * _goal_multiplier(int(hg - ag)) * (actual - expected)
        ratings[home] = rh + delta
        ratings[away] = ra - delta

    out = pd.DataFrame({"home_elo": home_pre, "away_elo": away_pre}, index=df.index)
    adv = np.where(df["neutral"].astype(bool), 0.0, ELO_HOME_ADVANTAGE)
    out["elo_diff"] = out["home_elo"] + adv - out["away_elo"]
    out["elo_p_home"] = 1.0 / (1.0 + 10 ** (-out["elo_diff"] / 400))
    return out, ratings


# ---------------------------------------------------------------------------
# League tables
# ---------------------------------------------------------------------------


def league_table_features(df: pd.DataFrame) -> pd.DataFrame:
    """Pre-match season points-per-game, goal difference per game, games played and table position."""
    cols = ["pos", "ppg_season", "gdpg_season", "games_season"]
    out = pd.DataFrame(
        np.nan, index=df.index, columns=[f"{s}_{c}" for s in ("home", "away") for c in cols]
    )
    tables: dict[tuple[str, int], dict[str, list[float]]] = {}
    is_league = df["competition"].map(lambda c: COMPETITIONS_BY_CODE[c].kind == "league").to_numpy()
    played = df["status"].eq("played").to_numpy()
    values = np.full((len(df), 8), np.nan)

    for i, (home, away, comp, season, hg, ag) in enumerate(
        zip(
            df["home_team"],
            df["away_team"],
            df["competition"],
            df["season"],
            df["home_goals"],
            df["away_goals"],
            strict=False,
        )
    ):
        if not is_league[i]:
            continue
        table = tables.setdefault((comp, int(season)), {})
        th = table.setdefault(home, [0.0, 0.0, 0.0])  # points, goal diff, games
        ta = table.setdefault(away, [0.0, 0.0, 0.0])
        ranking = sorted(table.items(), key=lambda kv: (-kv[1][0], -kv[1][1]))
        rank = {team: r for r, (team, _) in enumerate(ranking)}
        n = max(len(table) - 1, 1)
        for j, (team, t) in enumerate(((home, th), (away, ta))):
            games = t[2]
            values[i, j * 4 : j * 4 + 4] = (
                rank[team] / n,
                t[0] / games if games else np.nan,
                t[1] / games if games else np.nan,
                games,
            )
        if played[i]:
            hp = 3 if hg > ag else 1 if hg == ag else 0
            ap = 3 if ag > hg else 1 if hg == ag else 0
            th[0] += hp
            ta[0] += ap
            th[1] += hg - ag
            ta[1] += ag - hg
            th[2] += 1
            ta[2] += 1
    out.loc[:, :] = values
    return out


# ---------------------------------------------------------------------------
# Rolling team form
# ---------------------------------------------------------------------------

_FORM_STATS = [
    "points",
    "gf",
    "ga",
    "xg_for",
    "xg_against",
    "shots_for",
    "shots_against",
    "sot_for",
    "sot_against",
    "corners_for",
    "cards",
]
_LONG_WINDOW_STATS = ["points", "gf", "ga"]


def _team_long(df: pd.DataFrame) -> pd.DataFrame:
    """One row per (team, played match) with the team's own perspective."""
    played = df[df["status"].eq("played")]
    sides = []
    for side, opp, is_home in (("home", "away", 1), ("away", "home", 0)):
        hg, ag = played[f"{side}_goals"], played[f"{opp}_goals"]
        sides.append(
            pd.DataFrame(
                {
                    "date": played["date"],
                    "team": played[f"{side}_team"],
                    "is_home": is_home,
                    "points": np.select([hg > ag, hg == ag], [3.0, 1.0], 0.0),
                    "gf": hg.astype(float),
                    "ga": ag.astype(float),
                    "xg_for": played[f"{side}_xg"],
                    "xg_against": played[f"{opp}_xg"],
                    "shots_for": played[f"{side}_shots"],
                    "shots_against": played[f"{opp}_shots"],
                    "sot_for": played[f"{side}_sot"],
                    "sot_against": played[f"{opp}_sot"],
                    "corners_for": played[f"{side}_corners"],
                    "cards": played[f"{side}_yellow"] + 2 * played[f"{side}_red"],
                }
            )
        )
    return pd.concat(sides).sort_values(["date"], kind="stable").reset_index(drop=True)


def _rolling_state(
    long: pd.DataFrame, group_cols: list[str], stats: list[str], window: int, suffix: str
) -> pd.DataFrame:
    rolled = (
        long.groupby(group_cols, sort=False)[stats]
        .rolling(window, min_periods=1)
        .mean()
        .reset_index(level=list(range(len(group_cols))), drop=True)
    )
    state = long[["date", *group_cols]].join(rolled.add_suffix(suffix))
    return state.sort_values("date", kind="stable")


def _attach(
    rows: pd.DataFrame,
    state: pd.DataFrame,
    team_col: str,
    prefix: str,
    by_extra: dict | None = None,
) -> pd.DataFrame:
    """For each row, the latest ``state`` of ``team_col`` strictly before the row's date."""
    left = rows[["date", team_col]].rename(columns={team_col: "team"}).reset_index(names="_row")
    right = state
    by = ["team"]
    if by_extra:
        for col, val in by_extra.items():
            left[col] = val
        right = state
        by = ["team", *by_extra]
    merged = (
        pd.merge_asof(
            left.sort_values("date", kind="stable"),
            right,
            on="date",
            by=by,
            allow_exact_matches=False,
            direction="backward",
        )
        .set_index("_row")
        .sort_index()
    )
    value_cols = [c for c in state.columns if c not in ("date", "team", *(by_extra or {}))]
    return merged[value_cols].add_prefix(prefix)


def form_features(df: pd.DataFrame) -> pd.DataFrame:
    long = _team_long(df)
    rows = df[["date", "home_team", "away_team"]]
    parts = []

    for window in ROLLING_WINDOWS:
        stats = _FORM_STATS if window == min(ROLLING_WINDOWS) else _LONG_WINDOW_STATS
        state = _rolling_state(long, ["team"], stats, window, f"_{window}")
        parts.append(_attach(rows, state, "home_team", "home_"))
        parts.append(_attach(rows, state, "away_team", "away_"))

    # Venue-specific form: home side at home, away side away.
    venue = _rolling_state(long, ["team", "is_home"], ["points", "gf", "ga"], 5, "_venue5")
    parts.append(_attach(rows, venue, "home_team", "home_", by_extra={"is_home": 1}))
    parts.append(_attach(rows, venue, "away_team", "away_", by_extra={"is_home": 0}))

    # Fatigue / rust: days since the previous match and matches in the last 14 days. Every
    # competition counts (league, domestic cups, UEFA), so midweek cup games are included.
    last = long[["date", "team"]].assign(last_played=long["date"])
    played_so_far = long[["date", "team"]].assign(n=long.groupby("team").cumcount() + 1.0)
    two_weeks_ago = rows.assign(date=rows["date"] - pd.Timedelta(days=14))
    for side in ("home", "away"):
        prev = _attach(rows, last, f"{side}_team", "")
        now_n = _attach(rows, played_so_far, f"{side}_team", "")["n"].fillna(0)
        then_n = _attach(two_weeks_ago, played_so_far, f"{side}_team", "")["n"].fillna(0)
        parts.append(
            pd.DataFrame(
                {
                    f"{side}_rest": (rows["date"] - prev["last_played"]).dt.days.clip(upper=21),
                    f"{side}_games_14d": now_n - then_n,
                },
                index=rows.index,
            )
        )

    out = pd.concat(parts, axis=1)
    out["ppg_diff_5"] = out["home_points_5"] - out["away_points_5"]
    out["gd_diff_10"] = (out["home_gf_10"] - out["home_ga_10"]) - (
        out["away_gf_10"] - out["away_ga_10"]
    )
    out["xg_diff_5"] = (out["home_xg_for_5"] - out["home_xg_against_5"]) - (
        out["away_xg_for_5"] - out["away_xg_against_5"]
    )
    return out


# ---------------------------------------------------------------------------
# Competition context and market
# ---------------------------------------------------------------------------


def competition_context(df: pd.DataFrame, window: int = 300) -> pd.DataFrame:
    """Recent scoring rate, home-win and draw rates of the competition (pre-match)."""
    played = df[df["status"].eq("played")].copy()
    played["goals"] = played["home_goals"] + played["away_goals"]
    played["hw"] = played["result"].eq("H").astype(float)
    played["dr"] = played["result"].eq("D").astype(float)
    rolled = (
        played.groupby("competition", sort=False)[["goals", "hw", "dr"]]
        .rolling(window, min_periods=30)
        .mean()
        .reset_index(level=0, drop=True)
    )
    state = played[["date", "competition"]].join(rolled).sort_values("date", kind="stable")
    state = state.drop_duplicates(["date", "competition"], keep="last")
    left = df[["date", "competition"]].reset_index(names="_row").sort_values("date", kind="stable")
    merged = (
        pd.merge_asof(left, state, on="date", by="competition", allow_exact_matches=False)
        .set_index("_row")
        .sort_index()
    )
    return merged[["goals", "hw", "dr"]].rename(
        columns={"goals": "comp_avg_goals", "hw": "comp_home_win_rate", "dr": "comp_draw_rate"}
    )


def squad_value_features(df: pd.DataFrame, history: dict[str, list[tuple]] | None) -> pd.DataFrame:
    """Each side's squad market value (log EUR millions) from the last snapshot before kick-off."""
    out = pd.DataFrame(np.nan, index=df.index, columns=["home_value", "away_value", "value_ratio"])
    if not history:
        return out
    snaps = pd.DataFrame(
        [(team, pd.Timestamp(d), float(v)) for team, series in history.items() for d, v in series],
        columns=["team", "date", "value"],
    ).sort_values("date")
    rows = df[["date", "home_team", "away_team"]]
    for side in ("home", "away"):
        attached = _attach(rows, snaps, f"{side}_team", "")
        out[f"{side}_value"] = np.log1p(attached["value"])
    out["value_ratio"] = out["home_value"] - out["away_value"]
    return out


def market_probabilities(df: pd.DataFrame) -> pd.DataFrame:
    """Bookmaker odds -> implied probabilities with the margin removed (proportional method)."""
    inv = 1.0 / df[["odds_home", "odds_draw", "odds_away"]].astype(float)
    total = inv.sum(axis=1, min_count=3)
    out = inv.div(total, axis=0)
    out.columns = ["mkt_p_home", "mkt_p_draw", "mkt_p_away"]
    return out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

BASE_FEATURES = [
    "home_elo",
    "away_elo",
    "elo_diff",
    "elo_p_home",
    "mkt_p_home",
    "mkt_p_draw",
    "mkt_p_away",
    "is_cup",
    "is_uefa",
    "tier",
    "neutral",
    "comp_avg_goals",
    "comp_home_win_rate",
    "comp_draw_rate",
    "home_rest",
    "away_rest",
    "home_games_14d",
    "away_games_14d",
    # home_value / away_value / value_ratio (squad market value) are computed but not used:
    # tested out of sample they did not improve log loss (0.9467 vs 0.9462), as the market
    # odds and Elo already carry that information.
    "home_pos",
    "away_pos",
    "home_ppg_season",
    "away_ppg_season",
    "home_gdpg_season",
    "away_gdpg_season",
    "home_games_season",
    "ppg_diff_5",
    "gd_diff_10",
    "xg_diff_5",
]


def feature_columns(frame: pd.DataFrame) -> list[str]:
    form = [
        c
        for c in frame.columns
        if c.startswith(("home_", "away_")) and c.endswith(("_5", "_10", "_venue5"))
    ]
    return BASE_FEATURES + sorted(set(form) - set(BASE_FEATURES))


def build_features(
    matches: pd.DataFrame,
    fixtures: pd.DataFrame | None = None,
    squad_values: dict[str, list[tuple]] | None = None,
) -> tuple[pd.DataFrame, dict[str, float]]:
    """Return ``(frame, final_elo)``.

    ``frame`` holds the identifying columns, targets and every feature, one row per match
    in ``matches`` and per fixture in ``fixtures`` (rows with ``status == "scheduled"``).
    """
    df = matches.copy()
    if fixtures is not None and not fixtures.empty:
        fx = fixtures.copy()
        fx["status"] = "scheduled"
        df = pd.concat([df, fx], ignore_index=True)
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["neutral"] = df["neutral"].fillna(False).astype(bool)
    df = df.sort_values(["date"], kind="stable").reset_index(drop=True)

    elo, final_elo = elo_ratings(df)
    parts = [
        elo,
        league_table_features(df),
        form_features(df),
        competition_context(df),
        market_probabilities(df),
        squad_value_features(df, squad_values),
    ]
    frame = pd.concat([df, *parts], axis=1)
    frame["is_cup"] = frame["competition"].map(lambda c: int(COMPETITIONS_BY_CODE[c].kind == "cup"))
    frame["is_uefa"] = frame["competition"].map(
        lambda c: int(COMPETITIONS_BY_CODE[c].country == "Europe")
    )
    frame["tier"] = frame["competition"].map(lambda c: COMPETITIONS_BY_CODE[c].tier)
    frame["neutral"] = frame["neutral"].astype(int)
    frame["target"] = frame["result"].map(RESULT_TO_INT)
    return frame, final_elo


def elo_win_probability(diff: float) -> float:
    return 1.0 / (1.0 + math.pow(10, -diff / 400))
