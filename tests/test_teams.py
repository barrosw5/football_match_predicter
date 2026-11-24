from football_predictor.teams import TeamMatcher, normalise

KNOWN = {
    "Man United": "England",
    "Man City": "England",
    "Ath Madrid": "Spain",
    "Sociedad": "Spain",
    "Sociedad B": "Spain",
    "Red Star": "France",
    "Hibernian": "Scotland",
    "Wolfsburg": "Germany",
    "Sp Lisbon": "Portugal",
    "Paris FC": "France",
    "Paris SG": "France",
}


def matcher() -> TeamMatcher:
    return TeamMatcher(KNOWN)


def test_normalise_strips_accents_and_filler_words():
    assert normalise("1. FC Köln") == "koln"
    assert normalise("VfL Wolfsburg") == "wolfsburg"
    assert normalise("Brighton & Hove Albion") == "brighton hove albion"


def test_alias_table():
    m = matcher()
    assert m.match("Manchester United", country="England") == "Man United"
    assert m.match("Atlético Madrid", country="Spain") == "Ath Madrid"
    assert m.match("Sporting CP") == "Sp Lisbon"


def test_reserve_team_is_not_confused_with_first_team():
    m = matcher()
    assert (
        m.match("Real Sociedad II", alternatives=["Real Sociedad"], country="Spain") == "Sociedad B"
    )


def test_short_names_need_a_matching_country():
    m = matcher()
    # ESPN's short name for Red Star Belgrade is "Red Star" - a different club in France.
    assert (
        m.match("Red Star Belgrade", alternatives=["Red Star"], country="Serbia")
        == "Red Star Belgrade"
    )
    assert (
        m.match("Red Star Belgrade", alternatives=["Red Star"], country=None) == "Red Star Belgrade"
    )
    assert m.match("Hibernians", country="Malta") == "Hibernians"


def test_fuzzy_match_within_country():
    m = matcher()
    assert m.match("VfL Wolfsburg", country="Germany") == "Wolfsburg"


def test_exact_name_wins_over_fuzzy():
    m = matcher()
    assert m.match("Paris FC", country="France") == "Paris FC"


def test_unknown_club_keeps_its_name():
    assert matcher().match("Shakhtar Donetsk", country="Ukraine") == "Shakhtar Donetsk"


def test_espn_spelling_variants_join_the_domestic_history():
    m = TeamMatcher({"FC Copenhagen": "Denmark", "St Truiden": "Belgium"})
    assert m.match("F.C. København", country="Denmark") == "FC Copenhagen"
    assert m.match("Sint-Truidense", country="Belgium") == "St Truiden"


def test_strict_mode_keeps_amateur_clubs_apart():
    m = TeamMatcher({"Lille": "France", "Rangers": "Scotland", "Norwich": "England"})
    assert m.match("Lille Sud", country="France", fuzzy=False) == "Lille Sud"
    assert m.match("Cove Rangers", country="Scotland", fuzzy=False) == "Cove Rangers"
    assert m.match("Northwich Victoria", country="England", fuzzy=False) == "Northwich Victoria"
    assert m.match("Lille", country="France", fuzzy=False) == "Lille"


def test_espn_id_map_wins_over_names():
    m = TeamMatcher({"Luton": "England"})
    m.id_map["301"] = "Luton"
    import pandas as pd

    from football_predictor.dataset import map_espn_names

    events = pd.DataFrame(
        {
            "competition": ["FAC"],
            "home_espn": ["Luton Town"],
            "away_espn": ["Cove Rangers"],
            "home_alt": ["Luton"],
            "away_alt": ["Cove"],
            "home_espn_id": ["301"],
            "away_espn_id": ["999"],
            "venue_country": ["England"],
            "neutral": [False],
        }
    )
    out = map_espn_names(events, m)
    assert out.loc[0, "home_team"] == "Luton"
    assert out.loc[0, "away_team"] == "Cove Rangers"
