import hashlib
import json
import secrets
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from redis import Redis

from app.domain.errors import NotFound, QuotaExceeded
from app.domain.models import Session

RATE_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
"""

MAILS_PER_HOUR = 3


class RedisSessions:
    def __init__(self, settings):
        self.client = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_timeout=3,
            socket_connect_timeout=3,
        )
        self.namespace = settings.redis_namespace
        self.seconds = settings.session_hours * 3600
        self.analysis_limit = settings.analysis_per_hour
        self.auth_limit = settings.auth_per_15_minutes
        self.creation_limit = settings.session_creations_per_hour
        self.increment = self.client.register_script(RATE_SCRIPT)

    def key(self, token):
        digest = hashlib.sha256(token.encode()).hexdigest()
        return f"{self.namespace}:session:{digest}"

    def consume_auth(self, client_id):
        key = f"{self.namespace}:auth:{hashlib.sha256(client_id.encode()).hexdigest()}"
        if self.increment(keys=[key], args=[900]) > self.auth_limit:
            raise QuotaExceeded

    def create(self, client_id, owner=None, auth_version=0):
        fingerprint = hashlib.sha256(client_id.encode()).hexdigest()
        key = f"{self.namespace}:new-session:{fingerprint}"
        if self.increment(keys=[key], args=[3600]) > self.creation_limit:
            raise QuotaExceeded
        token = secrets.token_urlsafe(32)
        value = {
            "owner": owner or str(uuid4()),
            "auth_version": auth_version,
            "persistent": owner is not None,
            "expires_at": (datetime.now(UTC) + timedelta(seconds=self.seconds)).isoformat(),
        }
        self.client.set(self.key(token), json.dumps(value), ex=self.seconds)
        return token

    def resolve(self, token):
        if not token or len(token) > 100:
            raise NotFound
        value = self.client.get(self.key(token))
        if value is None:
            raise NotFound
        data = json.loads(value)
        return Session(
            owner=data["owner"],
            expires_at=datetime.fromisoformat(data["expires_at"]),
            persistent=data.get("persistent", False),
            auth_version=data.get("auth_version", 0),
        )

    def delete(self, token):
        self.client.delete(self.key(token))

    def consume_analysis(self, session):
        key = f"{self.namespace}:analysis:{session.owner}"
        if self.increment(keys=[key], args=[3600]) > self.analysis_limit:
            raise QuotaExceeded

    def consume_skill(self, session):
        key = f"{self.namespace}:skills:{session.owner}"
        if self.increment(keys=[key], args=[3600]) > 30:
            raise QuotaExceeded

    @contextmanager
    def exclusive(self, name, seconds):
        lock = self.client.lock(f"{self.namespace}:{name}", timeout=seconds, blocking_timeout=0)
        acquired = lock.acquire()
        try:
            yield acquired
        finally:
            if acquired:
                lock.release()

    def health(self):
        self.client.ping()

    def close(self):
        self.client.close()

    def consume_mail(self, address):
        """At most a few emails per address an hour, whoever asks for them."""
        key = f"{self.namespace}:mail:{hashlib.sha256(address.encode()).hexdigest()}"
        if self.increment(keys=[key], args=[3600]) > MAILS_PER_HOUR:
            raise QuotaExceeded

    def issue_token(self, purpose, value, seconds):
        """Single-use link token; only its hash is stored."""
        token = secrets.token_urlsafe(32)
        self.client.set(self.token_key(purpose, token), json.dumps(value), ex=seconds)
        return token

    def redeem_token(self, purpose, token):
        value = self.client.getdel(self.token_key(purpose, token))
        if not value:
            raise NotFound
        return json.loads(value)

    def token_key(self, purpose, token):
        return f"{self.namespace}:{purpose}:{hashlib.sha256(token.encode()).hexdigest()}"

    def google_nonce(self, owner):
        nonce = secrets.token_urlsafe(32)
        self.client.set(f"{self.namespace}:google:{owner}", nonce, ex=300)
        return nonce

    def consume_google_nonce(self, owner):
        nonce = self.client.getdel(f"{self.namespace}:google:{owner}")
        if not nonce:
            raise NotFound
        return nonce
