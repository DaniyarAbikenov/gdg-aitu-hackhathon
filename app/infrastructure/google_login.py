"""Google Identity Services token verification using Google's maintained verifier."""

import hmac

from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from app.domain.errors import NotFound, ProviderUnavailable


class GoogleLogin:
    def __init__(self, client_id):
        self.client_id = client_id

    def verify(self, credential, nonce):
        if not self.client_id:
            raise ProviderUnavailable
        try:
            claims = id_token.verify_oauth2_token(credential, Request(), self.client_id)
            if (
                not claims.get("email_verified")
                or not claims.get("sub")
                or not hmac.compare_digest(str(claims.get("nonce", "")), nonce)
            ):
                raise NotFound
            return {"subject": claims["sub"], "email": claims["email"].casefold()}
        except (ValueError, KeyError, GoogleAuthError) as exc:
            raise NotFound from exc
