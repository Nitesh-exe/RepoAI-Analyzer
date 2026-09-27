import os

import jwt
from jwt import PyJWKClient
from rest_framework.exceptions import AuthenticationFailed


SUPABASE_URL = os.environ.get(
    "SUPABASE_URL"
)

SUPABASE_JWKS_URL = (
    f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
)


def authenticate_supabase_token(request):
    authorization = request.headers.get(
        "Authorization"
    )

    if not authorization:
        raise AuthenticationFailed(
            "Authorization header is required."
        )

    if not authorization.startswith("Bearer "):
        raise AuthenticationFailed(
            "Invalid authorization header."
        )

    token = authorization.split(
        " ",
        1,
    )[1]

    try:
        jwks_client = PyJWKClient(
            SUPABASE_JWKS_URL
        )

        signing_key = jwks_client.get_signing_key_from_jwt(
            token
        )

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="authenticated",
        )

        return payload

    except Exception as exc:
        raise AuthenticationFailed(
            "Invalid or expired authentication token."
        ) from exc