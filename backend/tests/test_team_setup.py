"""Setting up the org chart: naming the organization, and deleting a team
typed by mistake.

Teams are saved the moment they're added (save-as-you-go, ADR-0014), so the
setup list's Remove control is the only way back out of a typo. These cover the
guard that keeps Remove an undo rather than a quiet org-chart change.
"""

import uuid

import pytest

from app.exceptions import CrossOrgAccessDenied
from app.models.organization import Organization
from app.models.team import Team
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
