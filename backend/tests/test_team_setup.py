"""Setting up the org chart: naming the organization, and deleting a team
typed by mistake.

Teams are saved the moment they're added (save-as-you-go, ADR-0014), so the
setup list's Remove control is the only way back out of a typo. These cover the
guard that keeps Remove an undo rather than a quiet org-chart change.
"""

import uuid
from types import SimpleNamespace

import pytest

from app.exceptions import CrossOrgAccessDenied
from app.models.organization import Organization
from app.models.team import Team
from app.onboarding import service as onboarding_service
from app.org_chart import service as org_chart_service


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _Session:
    """Answers the two `select`s in `delete_team` in the order they're made:
    memberships first, then child teams."""

    def __init__(self, team, results):
        self._team = team
        self._results = list(results)
        self.deleted = []
        self.committed = False

    def get(self, _model, _id):
        return self._team

    def execute(self, _stmt):
        return _Result(self._results.pop(0))

    def delete(self, obj):
        self.deleted.append(obj)

    def commit(self):
        self.committed = True


@pytest.fixture(autouse=True)
def _no_audit(monkeypatch):
    monkeypatch.setattr(org_chart_service, "record_audit_entry", lambda **kwargs: None)


def _team(org_id):
    return Team(id=uuid.uuid4(), org_id=org_id, name="Design")


def test_empty_team_is_deleted():
    org_id = uuid.uuid4()
    team = _team(org_id)
    db = _Session(team, [[], []])

    org_chart_service.delete_team(org_id, team.id, uuid.uuid4(), db)

    assert db.deleted == [team]
    assert db.committed


def test_team_with_people_is_refused():
    org_id = uuid.uuid4()
    team = _team(org_id)
    db = _Session(team, [["a membership"], []])

    with pytest.raises(ValueError, match="people in it"):
        org_chart_service.delete_team(org_id, team.id, uuid.uuid4(), db)

    assert db.deleted == []
    assert not db.committed


def test_team_with_child_teams_is_refused():
    org_id = uuid.uuid4()
    team = _team(org_id)
    db = _Session(team, [[], ["a child team"]])

    with pytest.raises(ValueError, match="teams under it"):
        org_chart_service.delete_team(org_id, team.id, uuid.uuid4(), db)

    assert db.deleted == []
    assert not db.committed


def test_team_from_another_org_is_refused():
    team = _team(uuid.uuid4())
    db = _Session(team, [[], []])

    with pytest.raises(CrossOrgAccessDenied):
        org_chart_service.delete_team(uuid.uuid4(), team.id, uuid.uuid4(), db)

    assert db.deleted == []


def test_missing_team_is_refused():
    db = _Session(None, [[], []])

    with pytest.raises(ValueError, match="no Team"):
        org_chart_service.delete_team(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), db)


class _OrgSession:
    def __init__(self, org):
        self._org = org
        self.committed = False

    def get(self, _model, _id):
        return self._org

    def commit(self):
        self.committed = True

    def refresh(self, _obj):
        pass


def test_organization_is_renamed_from_its_domain_placeholder():
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="acme.org", observed_domain="acme.org")
    db = _OrgSession(org)

    result = org_chart_service.rename_organization(org_id, "  Acme  ", uuid.uuid4(), db)

    assert result.name == "Acme"
    assert db.committed


def test_blank_organization_name_is_refused():
    org_id = uuid.uuid4()
    db = _OrgSession(Organization(id=org_id, name="acme.org"))

    with pytest.raises(ValueError, match="cannot be empty"):
        org_chart_service.rename_organization(org_id, "   ", uuid.uuid4(), db)

    assert not db.committed


class _SetupSession:
    """Just enough session for the setup-progress helpers."""

    def __init__(self, org, chart_rows=()):
        self._org = org
        self._chart_rows = list(chart_rows)
        self.committed = False

    def get(self, _model, _id):
        return self._org

    def execute(self, _stmt):
        rows = self._chart_rows

        class _R:
            def first(self):
                return rows[0] if rows else None

        return _R()

    def commit(self):
        self.committed = True

    def refresh(self, _obj):
        pass


def test_setup_step_is_recorded_and_completion_is_stamped():
    org = Organization(id=uuid.uuid4(), name="Acme")
    db = _SetupSession(org)

    onboarding_service.record_setup_step(org.id, "teams", db)
    assert org.setup_step == "teams"
    assert org.setup_completed_at is None

    onboarding_service.record_setup_step(org.id, "done", db)
    assert org.setup_step == "done"
    assert org.setup_completed_at is not None


def test_unknown_setup_step_is_refused():
    org = Organization(id=uuid.uuid4(), name="Acme")
    db = _SetupSession(org)

    with pytest.raises(ValueError, match="unknown setup step"):
        onboarding_service.record_setup_step(org.id, "teamz", db)


def test_finished_setup_has_nothing_to_resume(monkeypatch):
    org = Organization(id=uuid.uuid4(), name="Acme")
    org.setup_step = "done"
    member = SimpleNamespace(id=uuid.uuid4(), organization_id=org.id)

    assert onboarding_service.resume_setup_step(member, _SetupSession(org)) is None


def test_only_the_founder_resumes_setup(monkeypatch):
    org = Organization(id=uuid.uuid4(), name="Acme")
    org.setup_step = "teams"
    member = SimpleNamespace(id=uuid.uuid4(), organization_id=org.id)

    monkeypatch.setattr(onboarding_service, "is_founding_member", lambda *a: False)
    assert onboarding_service.resume_setup_step(member, _SetupSession(org)) is None

    monkeypatch.setattr(onboarding_service, "is_founding_member", lambda *a: True)
    assert onboarding_service.resume_setup_step(member, _SetupSession(org)) == "teams"


def test_org_from_before_the_column_resumes_at_the_first_screen(monkeypatch):
    """Answering the owner questions used to be the whole of setup, so these
    orgs have a chart, no recorded step, and never saw the screens after it."""
    org = Organization(id=uuid.uuid4(), name="acme.org")
    member = SimpleNamespace(id=uuid.uuid4(), organization_id=org.id)
    monkeypatch.setattr(onboarding_service, "is_founding_member", lambda *a: True)

    with_chart = _SetupSession(org, chart_rows=[("chart-id",)])
    assert onboarding_service.resume_setup_step(member, with_chart) == "orgName"

    without_chart = _SetupSession(org)
    assert onboarding_service.resume_setup_step(member, without_chart) is None


class _JoinLinkSession:
    def __init__(self, live=()):
        self.live = list(live)
        self.added = []
        self.committed = False

    def execute(self, _stmt):
        rows = self.live
        class _R:
            def scalars(self_inner):
                return rows
        return _R()

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.committed = True

    def refresh(self, _obj):
        pass


@pytest.fixture
def _setup_role(monkeypatch):
    monkeypatch.setattr(onboarding_service, "_require_setup_role", lambda *a, **k: None)
    monkeypatch.setattr(onboarding_service, "record_audit_entry", lambda **kwargs: None)


def _actor():
    return SimpleNamespace(id=uuid.uuid4())


def test_creating_a_join_link_revokes_the_previous_one(_setup_role):
    """One link, singular. A forgotten second link is exactly the leak the
    lifetime and revoke exist to avoid."""
    old = SimpleNamespace(revoked_at=None)
    db = _JoinLinkSession([old])

    link = onboarding_service.create_join_link(uuid.uuid4(), "7d", _actor(), db)

    assert old.revoked_at is not None
    assert link.expires_at is not None
    assert db.committed


def test_no_end_date_link_has_no_expiry(_setup_role):
    link = onboarding_service.create_join_link(uuid.uuid4(), "forever", _actor(), _JoinLinkSession())
    assert link.expires_at is None


def test_unknown_lifetime_is_refused(_setup_role):
    with pytest.raises(ValueError, match="unknown link lifetime"):
        onboarding_service.create_join_link(uuid.uuid4(), "10y", _actor(), _JoinLinkSession())


def test_revoking_kills_every_live_link(_setup_role):
    live = [SimpleNamespace(revoked_at=None), SimpleNamespace(revoked_at=None)]
    db = _JoinLinkSession(live)

    assert onboarding_service.revoke_join_link(uuid.uuid4(), _actor(), db) == 2
    assert all(l.revoked_at is not None for l in live)


def test_join_link_url_uses_the_join_route(_setup_role):
    link = SimpleNamespace(token="abc123")
    assert onboarding_service.join_link_url(link) == "http://localhost:3000/join/abc123"


def test_resolve_join_link_preview(_setup_role):
    org = SimpleNamespace(
        name="Acme",
        observed_domain="acme.org",
        verified_domain=None,
    )
    link = SimpleNamespace(
        organization_id=uuid.uuid4(),
        revoked_at=None,
        expires_at=None,
    )

    class _PreviewSession:
        def execute(self, _stmt):
            return SimpleNamespace(scalar_one_or_none=lambda: link)

        def get(self, _model, _org_id):
            return org

    preview = onboarding_service.resolve_join_link_preview("tok", _PreviewSession())

    assert preview["organization_name"] == "Acme"
    assert preview["organization_domain"] == "acme.org"
    assert preview["valid"] is True
    assert preview["title"] == "Join Acme on Knohow"
