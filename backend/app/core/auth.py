"""
app/core/auth.py
================
Lightweight ownership guard for /api/farmer/* routes (Security item #2).

Supabase issues JWTs signed with the project's JWT secret (HS256).
When SUPABASE_JWT_SECRET is configured, every farmer route verifies
that the token's ``sub`` (user UUID) matches the ``farmer_id`` being
accessed/edited, preventing one farmer from reading or mutating
another farmer's data.

Dev / CI behaviour
------------------
If ``SUPABASE_JWT_SECRET`` is empty (the default), the dependency
returns ``None`` and routes skip the ownership check.  This preserves
full backward-compatibility with local dev and offline CI.

Usage in routes (example)
--------------------------
    from app.core.auth import require_self_or_dev
    from uuid import UUID

    @router.get("/profile/{farmer_id}")
    def get_profile(
        farmer_id: UUID,
        caller: UUID | None = Depends(require_self_or_dev),
        repo: FarmerRepository = Depends(get_farmer_repo),
    ):
        if caller is not None and caller != farmer_id:
            raise HTTPException(403, "Access denied: you can only view your own profile")
        ...
"""

import logging
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

try:
    import jwt  # PyJWT >= 2.x
    _JWT_AVAILABLE = True
except ImportError:  # pragma: no cover — not installed in minimal CI
    _JWT_AVAILABLE = False

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


def _decode_supabase_jwt(token: str, secret: str) -> dict:
    """
    Decode and verify a Supabase-issued HS256 JWT.
    Raises HTTPException on any validation failure.
    """
    if not _JWT_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="PyJWT is not installed; cannot verify tokens.",
        )
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_self_or_dev(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> UUID | None:
    """
    FastAPI dependency.

    * If ``SUPABASE_JWT_SECRET`` is not configured → returns ``None``
      (dev / CI mode, routes skip ownership check).
    * If secret is configured but no ``Authorization`` header is present
      → raises 401.
    * If token is present but invalid / expired → raises 401.
    * On success → returns the caller's UUID (``sub`` from the token).

    Routes that use this dependency should compare the returned UUID
    against the ``farmer_id`` path parameter and raise 403 if they differ.
    """
    settings = get_settings()
    secret = settings.SUPABASE_JWT_SECRET.strip()

    if not secret:
        # Dev / CI: auth not configured, skip all checks.
        return None

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_supabase_jwt(credentials.credentials, secret)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing 'sub' claim.",
        )

    try:
        return UUID(sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token 'sub' is not a valid UUID: {sub!r}",
        )
