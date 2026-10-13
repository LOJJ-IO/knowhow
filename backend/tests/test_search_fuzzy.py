from app.search.fuzzy import title_score


def test_spacing_and_case_dont_matter():
    assert title_score("Test4", "Test 4") == 1.0
    assert title_score("test 4", "TEST-4 notes") == 1.0
    assert title_score("meetingagendas", "Meeting Agendas") == 1.0


def test_a_typo_still_matches():
    assert title_score("Meating agenda", "Meeting agendas") is not None
    assert title_score("projcet plan", "Project plan Q4") is not None


def test_prefixes_match():
    assert title_score("meet", "Meeting agendas") == 1.0


def test_numbers_are_exact():
    assert title_score("Q3", "Q4 launch plan") is None
    assert title_score("Test5", "Test 4") is None


def test_unrelated_titles_dont_match():
    assert title_score("budget", "Meeting agendas") is None
    assert title_score("", "Anything") is None
