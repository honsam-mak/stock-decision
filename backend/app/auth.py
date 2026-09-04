"""Supabase JWT authentication and owner authorization."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str = ""


def _issuer() -> str:
    return settings.supabase_jwt_issuer.rstrip("/") or (
        f"{settings.supabase_url.rstrip('/')}/auth/v1"
        if settings.supabase_url
        else ""
    )


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is required when authentication is enabled")
    url = (
        f"{settings.supabase_url.rstrip('/')}"
        "/auth/v1/.well-known/jwks.json"
    )
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=300)


def _decode_token(token: str) -> dict[str, Any]:
    issuer = _issuer()
    if not issuer:
        raise RuntimeError(
            "SUPABASE_URL or SUPABASE_JWT_ISSUER is required when authentication is enabled"
        )
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    options = {"require": ["exp", "iat", "sub"], "verify_aud": bool(settings.supabase_jwt_audience)}
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256", "ES256"],
        audience=settings.supabase_jwt_audience or None,
        issuer=issuer,
        options=options,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> AuthUser:
    if settings.auth_disabled:
        return AuthUser(id=settings.local_user_id)
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = _decode_token(credentials.credentials)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    user_id = str(claims.get("sub") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no subject",
        )
    return AuthUser(id=user_id, email=str(claims.get("email") or ""))


def require_owner(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if settings.auth_disabled:
        return user
    owner_ids = {
        value
        for value in (settings.owner_user_id, settings.owner_email.lower())
        if value
    }
    if not owner_ids:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Owner identity is not configured",
        )
    if user.id == settings.owner_user_id:
        return user
    if user.email and user.email.lower() == settings.owner_email.lower():
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Owner access required",
    )
