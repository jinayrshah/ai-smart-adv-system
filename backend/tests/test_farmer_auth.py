"""
Tests for Farmer API Authentication & Ownership Enforcement (app/core/auth.py).
Architecture_Advisory.md §6, Security item #2.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4
import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)

TEST_SECRET = "super-secret-supabase-jwt-key-for-testing-123456"


def _make_jwt(sub: str, secret: str = TEST_SECRET, expired: bool = False) -> str:
    now = datetime.now(timezone.utc)
    exp = now - timedelta(hours=1) if expired else now + timedelta(hours=1)
    payload = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "role": "authenticated",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_auth_bypassed_when_secret_unset(monkeypatch):
    """When SUPABASE_JWT_SECRET is empty, all routes allow unauthenticated access (dev mode)."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", "")
    farmer_id = str(uuid4())
    res = client.post("/api/farmer/profile", json={"id": farmer_id, "full_name": "Dev Farmer"})
    assert res.status_code == 201


def test_auth_missing_header_returns_401(monkeypatch):
    """When SUPABASE_JWT_SECRET is set, requests without Authorization header are rejected."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_SECRET)
    farmer_id = str(uuid4())
    res = client.get(f"/api/farmer/profile/{farmer_id}")
    assert res.status_code == 401
    assert "Authorization header missing" in res.json()["detail"]


def test_auth_invalid_token_returns_401(monkeypatch):
    """When token is malformed or signed with wrong secret, return 401."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_SECRET)
    farmer_id = str(uuid4())
    bad_token = _make_jwt(farmer_id, secret="wrong-secret")
    res = client.get(
        f"/api/farmer/profile/{farmer_id}",
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert res.status_code == 401
    assert "Invalid token" in res.json()["detail"]


def test_auth_expired_token_returns_401(monkeypatch):
    """Expired tokens must return 401."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_SECRET)
    farmer_id = str(uuid4())
    expired_token = _make_jwt(farmer_id, expired=True)
    res = client.get(
        f"/api/farmer/profile/{farmer_id}",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_auth_cross_user_access_forbidden(monkeypatch):
    """Caller A cannot read or mutate Farmer B's profile (403 Forbidden)."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_SECRET)
    user_a = str(uuid4())
    user_b = str(uuid4())

    token_a = _make_jwt(user_a)

    # User A tries to read User B's profile
    res = client.get(
        f"/api/farmer/profile/{user_b}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]

    # User A tries to update User B's profile
    res_patch = client.patch(
        f"/api/farmer/profile/{user_b}",
        json={"full_name": "Hacked Name"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_patch.status_code == 403


def test_auth_owner_access_allowed(monkeypatch):
    """Caller A accessing Farmer A's profile succeeds."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_SECRET)
    user_a = str(uuid4())
    token_a = _make_jwt(user_a)

    # Create profile
    res_post = client.post(
        "/api/farmer/profile",
        json={"id": user_a, "full_name": "Legit User A"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_post.status_code == 201

    # Read profile
    res_get = client.get(
        f"/api/farmer/profile/{user_a}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_get.status_code == 200
    assert res_get.json()["full_name"] == "Legit User A"
