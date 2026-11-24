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
