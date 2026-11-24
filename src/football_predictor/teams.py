"""Team-name normalisation across data sources.

football-data.co.uk names (e.g. ``"Man United"``, ``"Ath Madrid"``, ``"Sp Lisbon"``) are the
canonical names used everywhere in the project. ESPN names (``"Manchester United"``,
``"Atlético Madrid"``, ``"Sporting CP"``) are mapped onto them by :class:`TeamMatcher`:

1. an explicit alias table for names that no string-similarity rule can resolve;
2. exact match on a normalised key (accents, punctuation and filler words such as
   ``FC``/``CF``/``Club`` removed);
3. fuzzy match restricted to clubs from the same country, accepted only above a threshold.

Clubs that never appear in a covered domestic league (e.g. Shakhtar, Dinamo Zagreb) keep
their ESPN name and get their own rating history from European matches.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from difflib import SequenceMatcher

# football-data spells a few clubs differently across seasons/files -> unify them.
_FD_ALIASES: dict[str, str] = {
    "Sheffield Weds": "Sheffield Weds",
    "Nott'm Forest": "Nott'm Forest",
    "Nottingham Forest": "Nott'm Forest",
    "Bayern München": "Bayern Munich",
    "Olympiakos Piraeus": "Olympiakos",
    "PSV": "PSV Eindhoven",
    "Bodo Glimt": "Bodo/Glimt",
    "Bodoe/Glimt": "Bodo/Glimt",
    "Waasland-Beveren": "Beveren",  # renamed club, same history
    "Erzurum BB": "Erzurumspor",
}

# ESPN display name -> football-data name (only cases the normaliser cannot solve).
ESPN_ALIASES: dict[str, str] = {
    # England
    "Manchester United": "Man United",
    "Manchester City": "Man City",
    "Nottingham Forest": "Nott'm Forest",
    "Sheffield Wednesday": "Sheffield Weds",
    "Queens Park Rangers": "QPR",
    "West Bromwich Albion": "West Brom",
    "Wolverhampton Wanderers": "Wolves",
    "Brighton & Hove Albion": "Brighton",
    "Tottenham Hotspur": "Tottenham",
    "Peterborough United": "Peterboro",
    "Milton Keynes Dons": "Milton Keynes Dons",
    # Spain
    "Atlético Madrid": "Ath Madrid",
    "Atletico Madrid": "Ath Madrid",
    "Athletic Club": "Ath Bilbao",
    "Athletic Bilbao": "Ath Bilbao",
    "Real Sociedad": "Sociedad",
    "Real Betis": "Betis",
    "Celta Vigo": "Celta",
    "Rayo Vallecano": "Vallecano",
    "Sporting Gijón": "Sp Gijon",
    "Sporting Gijon": "Sp Gijon",
    "Deportivo La Coruña": "La Coruna",
    "Deportivo La Coruna": "La Coruna",
    "Racing Santander": "Santander",
    "Real Sociedad II": "Sociedad B",
    "Real Sociedad B": "Sociedad B",
    "RC Celta Fortuna": "Celta B",
    "Celta Fortuna": "Celta B",
    "Deportivo": "La Coruna",
    "OH Leuven": "Oud-Heverlee Leuven",
    "Austria Lustenau": "A. Lustenau",
    "SV Josko Ried": "Ried",
    "SV Ried": "Ried",
    "Blau-Weiß Linz": "BW Linz",
    "FC Blau-Weiss Linz": "BW Linz",
    "Amed SFK": "Amedspor",
    "Hamarkameratene": "HamKam",
    "Real Oviedo": "Oviedo",
    "Real Zaragoza": "Zaragoza",
    "Real Valladolid": "Valladolid",
    "Real Racing Club": "Santander",
    # Germany
    "Borussia Mönchengladbach": "M'gladbach",
    "Borussia Monchengladbach": "M'gladbach",
    "Eintracht Frankfurt": "Ein Frankfurt",
    "Bayer Leverkusen": "Leverkusen",
    "Borussia Dortmund": "Dortmund",
    "FC Cologne": "FC Koln",
    "1. FC Köln": "FC Koln",
    "Hertha Berlin": "Hertha",
    "Fortuna Düsseldorf": "Fortuna Dusseldorf",
    "Greuther Fürth": "Greuther Furth",
    "SpVgg Greuther Furth": "Greuther Furth",
    "1. FC Nürnberg": "Nurnberg",
    "Nürnberg": "Nurnberg",
    "Hamburg SV": "Hamburg",
    "Hamburger SV": "Hamburg",
    "1. FC Heidenheim 1846": "Heidenheim",
    "FC St. Pauli": "St Pauli",
    "St. Pauli": "St Pauli",
    # Italy
    "Internazionale": "Inter",
    "AC Milan": "Milan",
    "Hellas Verona": "Verona",
    "SPAL": "Spal",
    # France
    "Paris Saint-Germain": "Paris SG",
    "Saint-Étienne": "St Etienne",
    "AS Saint-Étienne": "St Etienne",
    "Stade Rennais": "Rennes",
    "Stade Brestois 29": "Brest",
    "Olympique Lyonnais": "Lyon",
    "Olympique Marseille": "Marseille",
    "Paris FC": "Paris FC",
    # Portugal
    "Sporting CP": "Sp Lisbon",
    "Sporting Lisbon": "Sp Lisbon",
    "SC Braga": "Sp Braga",
    "Braga": "Sp Braga",
    "Vitória de Guimarães": "Guimaraes",
    "Vitoria Guimaraes": "Guimaraes",
    "Vitória Guimarães": "Guimaraes",
    "FC Porto": "Porto",
    "Estrela da Amadora": "Estrela",
    "Paços de Ferreira": "Pacos Ferreira",
    "AVS Futebol SAD": "AVS",
    "AFS": "AVS",
    # Netherlands
    "PSV Eindhoven": "PSV Eindhoven",
    "PSV": "PSV Eindhoven",
    "Ajax Amsterdam": "Ajax",
    "Feyenoord Rotterdam": "Feyenoord",
    "Go Ahead Eagles": "Go Ahead Eagles",
    "NEC Nijmegen": "Nijmegen",
    "Sparta Rotterdam": "Sparta Rotterdam",
    "Fortuna Sittard": "For Sittard",
    "PEC Zwolle": "Zwolle",
    # Belgium
    "Union St.-Gilloise": "St. Gilloise",
    "Union Saint-Gilloise": "St. Gilloise",
    "Royale Union Saint-Gilloise": "St. Gilloise",
    "Royal Antwerp": "Antwerp",
    "KRC Genk": "Genk",
    "Sint-Truiden": "St Truiden",
    "Standard Liege": "Standard",
    "Standard Liège": "Standard",
    "Cercle Brugge KSV": "Cercle Brugge",
    "KV Mechelen": "Mechelen",
    "Oud-Heverlee Leuven": "Oud-Heverlee Leuven",
    # Turkey
    "Istanbul Basaksehir": "Buyuksehyr",
    "İstanbul Başakşehir": "Buyuksehyr",
    "Başakşehir": "Buyuksehyr",
    "Fenerbahçe": "Fenerbahce",
    "Beşiktaş": "Besiktas",
    "Galatasaray": "Galatasaray",
    # Greece
    "Olympiacos": "Olympiakos",
    "PAOK Salonika": "PAOK",
    "PAOK Thessaloniki": "PAOK",
    "AEK Athens": "AEK",
    "Aris Thessaloniki": "Aris",
    # Scotland
    "Heart of Midlothian": "Hearts",
    # Austria / Switzerland / Scandinavia
    "Red Bull Salzburg": "Salzburg",
    "FC Salzburg": "Salzburg",
    "SK Sturm Graz": "Sturm Graz",
    "LASK Linz": "LASK",
    "SK Rapid Wien": "SK Rapid",
    "Rapid Wien": "SK Rapid",
    "Rapid Vienna": "SK Rapid",
    "Austria Wien": "Austria Vienna",
    "Wolfsberger AC": "Wolfsberger AC",
    "BSC Young Boys": "Young Boys",
    "FC Zürich": "Zurich",
    "FC Zurich": "Zurich",
    "FC København": "FC Copenhagen",
    "FC Copenhagen": "FC Copenhagen",
    "København": "FC Copenhagen",
    "Brøndby IF": "Brondby",
    "Bodø/Glimt": "Bodo/Glimt",
    "Bodo/Glimt": "Bodo/Glimt",
    "Malmö FF": "Malmo FF",
    "Malmo FF": "Malmo FF",
    "F.C. København": "FC Copenhagen",
    "AGF": "Aarhus",
    "AGF Aarhus": "Aarhus",
    "AaB": "Aalborg",
    "Odds BK": "Odd",
    "AIK Solna": "AIK",
    "Sint-Truidense": "St Truiden",
    "Waasland-Beveren": "Beveren",
    "Erzurum BB": "Erzurumspor",
}

# Words that carry no identity information in club names.
_FILLER = {
    "fc",
    "cf",
    "afc",
    "sc",
    "ac",
    "as",
    "cd",
    "ud",
    "sd",
    "rc",
    "rcd",
    "ca",
    "sv",
    "vfl",
    "vfb",
    "tsg",
    "fk",
    "sk",
    "if",
    "bk",
    "ff",
    "ss",
    "ssc",
    "us",
    "club",
    "de",
    "da",
    "do",
    "the",
    "calcio",
    "1",
    "04",
    "05",
    "09",
    "1846",
    "1899",
    "1907",
    "1913",
    "kv",
    "krc",
    "kaa",
    "rsc",
    "royal",
    "osc",
    "ogc",
    "fsv",
    "spvgg",
    "bsc",
    "sad",
    "futebol",
    "football",
    "and",
}


def strip_accents(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )


def normalise(name: str) -> str:
    """Lowercase, accent-free key with filler words removed (``"1. FC Köln"`` -> ``"koln"``)."""
    text = strip_accents(name).lower().replace("&", " and ").replace("'", "")
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    tokens = [t for t in text.split() if t not in _FILLER]
    return " ".join(tokens) if tokens else text.strip()


def canonical_team(name: str, competition: str | None = None) -> str:  # noqa: ARG001 - kept for API symmetry
    """Canonical name for a football-data team name."""
    name = str(name).strip()
    return _FD_ALIASES.get(name, name)


class TeamMatcher:
    """Maps names from other sources onto the canonical (football-data) club names."""

    def __init__(self, known_teams: dict[str, str | None], threshold: float = 0.86):
        """``known_teams`` maps canonical team name -> country (or ``None`` if unknown)."""
        self.threshold = threshold
        self.country = dict(known_teams)
        self._by_key: dict[str, str] = {}
        for team in known_teams:
            self._by_key.setdefault(normalise(team), team)
        self._cache: dict[tuple[str, str | None], str] = {}

    @classmethod
    def from_matches(
        cls, teams_with_country: Iterable[tuple[str, str | None]], **kw
    ) -> TeamMatcher:
        return cls(dict(teams_with_country), **kw)

    def match(
        self, name: str, *, alternatives: Iterable[str] = (), country: str | None = None
    ) -> str:
        key = (name, country)
        if key not in self._cache:
            self._cache[key] = self._match(name, list(alternatives), country)
        return self._cache[key]

    def _match(self, name: str, alternatives: list[str], country: str | None) -> str:
        def same_country(team: str) -> bool:
            # "Red Star" (Paris) must not swallow "Red Star Belgrade", nor Scotland's
            # Hibernian Malta's Hibernians: a known country has to agree.
            return country is None or self.country.get(team) in (None, country)

        # 1) the full name: alias table, exact name, normalised key
        alias = ESPN_ALIASES.get(name)
        if alias is not None and (alias in self.country or not self.country):
            return alias
        if name in self.country and same_country(name):
            return name
        hit = self._by_key.get(normalise(name))
        if hit is not None and same_country(hit):
            return hit

        # 2) short names ("Red Star", "Real Sociedad") are ambiguous: only trusted when the
        #    club's country is known, so "Real Sociedad II" cannot become "Sociedad".
        alternatives = [a for a in alternatives if a and a != name]
        if country is None:
            alternatives = []
        for cand in alternatives:
            if cand in self.country and same_country(cand):
                return cand
            hit = self._by_key.get(normalise(cand))
            if hit is not None and same_country(hit):
                return hit
        candidates = [name, *alternatives]

        if country is not None:
            # Fuzzy matching only among clubs of the same country.
            pool = [t for t, c in self.country.items() if c == country]
            hit = self._fuzzy(candidates, pool, self.threshold, allow_containment=True)
        else:
            hit = self._fuzzy(
                candidates, list(self.country), max(self.threshold, 0.93), allow_containment=False
            )
        return hit if hit is not None else name  # unknown club: keep the source name

    @staticmethod
    def _fuzzy(
        candidates: list[str], pool: list[str], threshold: float, *, allow_containment: bool
    ) -> str | None:
        best, best_score = None, 0.0
        for cand in candidates:
            ck = normalise(cand)
            for team in pool:
                tk = normalise(team)
                score = SequenceMatcher(None, ck, tk).ratio()
                # "Wolfsburg" vs "VfL Wolfsburg": whole-word containment is a strong signal
                # (only trusted inside one country, where club names rarely overlap).
                if (
                    allow_containment
                    and min(len(ck), len(tk)) >= 5
                    and (f" {tk} " in f" {ck} " or f" {ck} " in f" {tk} ")
                ):
                    score = max(score, 0.9)
                if score > best_score:
                    best, best_score = team, score
        return best if best_score >= threshold else None
