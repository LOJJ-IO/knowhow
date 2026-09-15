import uuid

import pytest

from app.security.jwt import InvalidSessionToken, TokenType, decode_session_token, issue_access_token, issue_refresh_token


def test_access_token_roundtrip():
    member_id, org_id = uuid.uuid4(), uuid.uuid4()
    token = issue_access_token(member_id, org_id)

    payload = decode_session_token(token, expected_type=TokenType.ACCESS)

    assert payload["sub"] == str(member_id)
    assert payload["org_id"] == str(org_id)


def test_refresh_token_rejected_as_access_token():
    member_id, org_id = uuid.uuid4(), uuid.uuid4()
    refresh_token = issue_refresh_token(member_id, org_id)

    with pytest.raises(InvalidSessionToken):
        decode_session_token(refresh_token, expected_type=TokenType.ACCESS)
