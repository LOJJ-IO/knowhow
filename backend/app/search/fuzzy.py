"""Typo-tolerant title matching for DeepSearch.

Drive's `fullText contains` is exact about words: "Test4" never finds
"Test 4", and "Meating agenda" never finds "Meeting agenda" (cofounder,
2026-10-13). This scores a title against a query after normalising both, so
spacing, case, punctuation and a slip of a letter or two don't matter. It only
ever sees titles Knohow already holds (FileIndex); nothing is fetched or
stored for it.
"""

import re
from difflib import SequenceMatcher

# Letters and digits are separate words: "test4" → "test", "4", so it lines
# up with "Test 4", "test-4" and "Test_4".
_TOKEN = re.compile(r"[a-z]+|[0-9]+")

# How alike two words must be to count as the same word with a typo.
_WORD_RATIO = 0.8


def _tokens(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def _squash(text: str) -> str:
    return "".join(_tokens(text))


def _word_matches(word: str, title_words: list[str]) -> float:
    """Best match for one query word among the title's words: 1.0 for the same
    word or a prefix of one ("meet" → "meeting"), less for a near-miss, 0
    when nothing is close."""
    best = 0.0
    for candidate in title_words:
        if candidate == word or (len(word) >= 2 and candidate.startswith(word)):
            return 1.0
        # Numbers are exact: "Q3" must not find "Q4".
        if word.isdigit() or candidate.isdigit() or len(word) < 4:
            continue
        ratio = SequenceMatcher(None, word, candidate).ratio()
        if ratio >= _WORD_RATIO:
            best = max(best, ratio)
    return best


def title_score(query: str, title: str) -> float | None:
    """How well `title` answers `query`, from 0 to 1, or None for no match.

    1.0 when the query, with spacing and punctuation ignored, sits inside the
    title ("Test4" in "Test 4 notes"). Otherwise every word of the query has
    to find its word in the title, exactly, as a prefix, or within a typo;
    the score is their average."""
    query_words = _tokens(query)
    if not query_words:
        return None
    if _squash(query) in _squash(title):
        return 1.0
    title_words = _tokens(title)
    scores = [_word_matches(word, title_words) for word in query_words]
    if not all(scores):
        return None
    return sum(scores) / len(scores) * 0.95
