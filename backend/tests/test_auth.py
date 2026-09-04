import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import auth
from app.main import app


def test_auth_disabled_returns_local_owner(monkeypatch):
    monkeypatch.setattr(auth.settings, "auth_disabled", True)
    monkeypatch.setattr(auth.settings, "local_user_id", "local-test-user")

    user = auth.get_current_user(None)

    assert user == auth.AuthUser(id="local-test-user")
    assert auth.require_owner(user) == user


def test_configured_owner_is_allowed(monkeypatch):
    monkeypatch.setattr(auth.settings, "auth_disabled", False)
    monkeypatch.setattr(auth.settings, "owner_user_id", "owner-123")
    monkeypatch.setattr(auth.settings, "owner_email", "")
    monkeypatch.setattr(
        auth,
        "_decode_token",
        lambda _: {"sub": "owner-123", "email": "owner@example.com"},
    )
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="signed-token"
    )

    user = auth.get_current_user(credentials)

    assert auth.require_owner(user) == user


def test_non_owner_is_rejected(monkeypatch):
    monkeypatch.setattr(auth.settings, "auth_disabled", False)
    monkeypatch.setattr(auth.settings, "owner_user_id", "owner-123")
    monkeypatch.setattr(auth.settings, "owner_email", "owner@example.com")

    with pytest.raises(HTTPException) as error:
        auth.require_owner(auth.AuthUser(id="someone-else", email="x@example.com"))

    assert error.value.status_code == 403


def test_every_non_health_api_route_requires_owner():
    unprotected = []
    for route in app.routes:
        if not route.path.startswith("/api/") or route.path == "/api/health":
            continue
        dependency_calls = {dependency.call for dependency in route.dependant.dependencies}
        if auth.require_owner not in dependency_calls:
            unprotected.append(route.path)

    assert unprotected == []
