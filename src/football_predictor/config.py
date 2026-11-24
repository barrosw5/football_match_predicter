"""Project-wide configuration: paths, competitions and model settings."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT_DIR = Path(os.environ.get("FP_ROOT", Path(__file__).resolve().parents[2]))
DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"  # downloaded source files (git-ignored, cached in CI)
PROCESSED_DIR = DATA_DIR / "processed"  # unified match table (git-ignored)
MODELS_DIR = ROOT_DIR / "models"  # trained model artefacts (git-ignored)
LEDGER_PATH = DATA_DIR / "predictions_ledger.csv"  # committed: the prediction track record
WEB_DATA_DIR = ROOT_DIR / "web" / "public" / "data"  # JSON consumed by the website
WEB_BUILD_DATA_DIR = ROOT_DIR / "web" / "build-data"  # JSON read only while building the site

MATCHES_PATH = PROCESSED_DIR / "matches.parquet"
TEAM_DIRECTORY_PATH = PROCESSED_DIR / "teams.json"  # canonical name -> ESPN name / id
MODEL_PATH = MODELS_DIR / "model.joblib"

# ---------------------------------------------------------------------------
# History window
# ---------------------------------------------------------------------------
FIRST_SEASON = 2014  # first season start year downloaded (2014/15)
WARMUP_SEASONS = 1  # seasons used only to warm up Elo / form, never as training rows

# ---------------------------------------------------------------------------
# Competitions
# ---------------------------------------------------------------------------
Kind = Literal["league", "cup"]


@dataclass(frozen=True)
class Competition:
    code: str  # internal identifier, also used in the website
    name: str
    country: str
    kind: Kind
    tier: int  # 1 = top flight, 2 = second tier, 0 = continental cup
    espn: str  # ESPN slug, used for fixtures / live results
    fd_main: str | None = None  # football-data.co.uk "mmz4281" division code
    fd_extra: str | None = None  # football-data.co.uk "/new/" file code
    elo_prior: float = 1500.0  # starting Elo for a club first seen in this competition


COMPETITIONS: tuple[Competition, ...] = (
    # --- Big five + second tiers -------------------------------------------------
    Competition(
        "E0", "Premier League", "England", "league", 1, "eng.1", fd_main="E0", elo_prior=1560
    ),
    Competition(
        "E1", "Championship", "England", "league", 2, "eng.2", fd_main="E1", elo_prior=1440
    ),
    Competition("SP1", "La Liga", "Spain", "league", 1, "esp.1", fd_main="SP1", elo_prior=1550),
    Competition("SP2", "La Liga 2", "Spain", "league", 2, "esp.2", fd_main="SP2", elo_prior=1420),
    Competition("D1", "Bundesliga", "Germany", "league", 1, "ger.1", fd_main="D1", elo_prior=1540),
    Competition(
        "D2", "2. Bundesliga", "Germany", "league", 2, "ger.2", fd_main="D2", elo_prior=1420
    ),
    Competition("I1", "Serie A", "Italy", "league", 1, "ita.1", fd_main="I1", elo_prior=1540),
    Competition("I2", "Serie B", "Italy", "league", 2, "ita.2", fd_main="I2", elo_prior=1410),
    Competition("F1", "Ligue 1", "France", "league", 1, "fra.1", fd_main="F1", elo_prior=1520),
    Competition("F2", "Ligue 2", "France", "league", 2, "fra.2", fd_main="F2", elo_prior=1400),
    # --- Other first divisions ---------------------------------------------------
    Competition(
        "P1", "Primeira Liga", "Portugal", "league", 1, "por.1", fd_main="P1", elo_prior=1480
    ),
    Competition(
        "N1", "Eredivisie", "Netherlands", "league", 1, "ned.1", fd_main="N1", elo_prior=1480
    ),
    Competition("B1", "Pro League", "Belgium", "league", 1, "bel.1", fd_main="B1", elo_prior=1470),
    Competition("T1", "Süper Lig", "Turkey", "league", 1, "tur.1", fd_main="T1", elo_prior=1460),
    Competition("G1", "Super League", "Greece", "league", 1, "gre.1", fd_main="G1", elo_prior=1430),
    Competition(
        "SC0", "Premiership", "Scotland", "league", 1, "sco.1", fd_main="SC0", elo_prior=1420
    ),
    Competition(
        "AUT", "Bundesliga", "Austria", "league", 1, "aut.1", fd_extra="AUT", elo_prior=1440
    ),
    Competition(
        "SWZ", "Super League", "Switzerland", "league", 1, "sui.1", fd_extra="SWZ", elo_prior=1440
    ),
    Competition(
        "DNK", "Superliga", "Denmark", "league", 1, "den.1", fd_extra="DNK", elo_prior=1440
    ),
    Competition(
        "NOR", "Eliteserien", "Norway", "league", 1, "nor.1", fd_extra="NOR", elo_prior=1410
    ),
    Competition(
        "SWE", "Allsvenskan", "Sweden", "league", 1, "swe.1", fd_extra="SWE", elo_prior=1410
    ),
    # --- UEFA club competitions (from ESPN) -------------------------------------
    Competition("CL", "Champions League", "Europe", "cup", 0, "uefa.champions", elo_prior=1450),
    Competition("EL", "Europa League", "Europe", "cup", 0, "uefa.europa", elo_prior=1430),
    Competition("ECL", "Conference League", "Europe", "cup", 0, "uefa.europa.conf", elo_prior=1400),
    # --- Domestic cups (from ESPN). Clubs first seen here are usually lower-division
    # sides, hence the low starting rating.
    Competition(
        "PTC", "Taça de Portugal", "Portugal", "cup", 0, "por.taca.portugal", elo_prior=1300
    ),
    Competition("FAC", "FA Cup", "England", "cup", 0, "eng.fa", elo_prior=1300),
    Competition("EFLC", "EFL Cup", "England", "cup", 0, "eng.league_cup", elo_prior=1300),
    Competition("CDR", "Copa del Rey", "Spain", "cup", 0, "esp.copa_del_rey", elo_prior=1300),
    Competition("DFBP", "DFB-Pokal", "Germany", "cup", 0, "ger.dfb_pokal", elo_prior=1300),
    Competition("CI", "Coppa Italia", "Italy", "cup", 0, "ita.coppa_italia", elo_prior=1300),
    Competition(
        "CDF", "Coupe de France", "France", "cup", 0, "fra.coupe_de_france", elo_prior=1250
    ),
    Competition("KNVB", "KNVB Cup", "Netherlands", "cup", 0, "ned.cup", elo_prior=1300),
    Competition("SCC", "Scottish Cup", "Scotland", "cup", 0, "sco.tennents", elo_prior=1250),
    Competition("SLC", "Scottish League Cup", "Scotland", "cup", 0, "sco.cis", elo_prior=1250),
)

COMPETITIONS_BY_CODE: dict[str, Competition] = {c.code: c for c in COMPETITIONS}
CUP_CODES = tuple(c.code for c in COMPETITIONS if c.kind == "cup")
UEFA_CODES = tuple(c.code for c in COMPETITIONS if c.kind == "cup" and c.country == "Europe")


def competition(code: str) -> Competition:
    return COMPETITIONS_BY_CODE[code]


# ---------------------------------------------------------------------------
# Model settings
# ---------------------------------------------------------------------------
ELO_K = 20.0
ELO_HOME_ADVANTAGE = 65.0
ROLLING_WINDOWS = (5, 10)
MAX_GOALS = 6  # score matrix is MAX_GOALS x MAX_GOALS (0..5 goals each)

OUTCOME_PARAMS: dict = {
    "n_estimators": 450,
    "learning_rate": 0.03,
    "max_depth": 4,
    "min_child_weight": 10,
    "subsample": 0.8,
    "colsample_bytree": 0.7,
    "reg_lambda": 2.0,
}
GOALS_PARAMS: dict = {
    "n_estimators": 350,
    "learning_rate": 0.03,
    "max_depth": 4,
    "min_child_weight": 10,
    "subsample": 0.8,
    "colsample_bytree": 0.7,
}
# Final 1X2 probabilities = w * classifier + (1 - w) * Poisson score model
BLEND_WEIGHT = 0.7

# A pick is flagged as a "value bet" when model_prob * odds - 1 exceeds this edge. The model
# is close to the market, so small edges are mostly noise plus bookmaker margin.
VALUE_EDGE = 0.10

# ---------------------------------------------------------------------------
# Live pipeline
# ---------------------------------------------------------------------------
FIXTURE_DAYS_AHEAD = 7
RESULT_DAYS_BACK = 4
HTTP_USER_AGENT = "Mozilla/5.0 (compatible; football-predictor/2.0)"
