"""Password recovery and email confirmation, with mail queued on real Redis."""

import re
import socketserver
import threading
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from rq import SimpleWorker
from rq.serializers import JSONSerializer

from app import worker
from app.infrastructure.mail import SmtpMailer
from app.main import create_app
from tests.test_product import member

PASSWORD = "Product-test-password"


@pytest.fixture
def mail_client(client, settings):
    """A second app over the same database and Redis, with email configured."""
    configured = settings.model_copy(
        update={
            "smtp_url": settings.smtp_url.__class__("smtp://127.0.0.1:2525"),
            "public_url": "https://career.example",
        }
    )
    with TestClient(create_app(configured)) as mail_client:
        mail_client.post("/api/session")
        yield mail_client


def outbox(client):
    """Messages queued for the worker, oldest first; reading them empties the queue."""
    queue = client.app.state.container.jobs.mail
    messages = [job.args[0] for job in queue.jobs]
    queue.empty()
    return messages


def token(message):
    return re.search(r"#token=(\S+)", message["text"]).group(1)


def test_registration_sends_a_confirmation_link_that_works_once(mail_client):
    email = member(mail_client)
    [message] = outbox(mail_client)
    assert message["to"] == email
    assert "https://career.example/verify-email#token=" in message["text"]
    assert mail_client.get("/user/me").json()["email_verified"] is False

    link = token(message)
    assert mail_client.post("/auth/email/verify", json={"token": link}).json() == {"verified": True}
    assert mail_client.get("/user/me").json()["email_verified"] is True
    reused = mail_client.post("/auth/email/verify", json={"token": link})
    assert reused.status_code == 422 and reused.json()["code"] == "verify_link_invalid"

    # Nothing more to send once confirmed.
    assert mail_client.post("/account/email/verification", json={}).status_code == 202
    assert outbox(mail_client) == []


def test_password_reset_replaces_the_password_and_signs_out_everywhere(mail_client):
    email = member(mail_client)
    outbox(mail_client)
    signed_in = mail_client.cookies.get("career_session")
    assert signed_in

    unknown = mail_client.post("/auth/password/forgot", json={"email": f"{uuid4()}@example.com"})
    known = mail_client.post("/auth/password/forgot", json={"email": email, "language": "ru"})
    assert unknown.status_code == known.status_code == 202
    assert unknown.json() == known.json()
    [message] = outbox(mail_client)
    assert message["to"] == email and message["subject"] == "Сброс пароля Career Studio"
    assert "https://career.example/reset-password#token=" in message["text"]

    link = token(message)
    short = mail_client.post("/auth/password/reset", json={"token": link, "password": "short"})
    assert short.status_code == 422
    new_password = "Recovered-password-42"
    reset = mail_client.post("/auth/password/reset", json={"token": link, "password": new_password})
    assert reset.status_code == 204
    # The old session was revoked with the password change.
    assert mail_client.get("/user/me").status_code == 401

    old = mail_client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert old.status_code == 401
    login = mail_client.post("/auth/login", json={"email": email, "password": new_password})
    assert login.status_code == 200
    # Receiving the reset email proved the address.
    assert mail_client.get("/user/me").json()["email_verified"] is True

    again = mail_client.post("/auth/password/reset", json={"token": link, "password": new_password})
    assert again.status_code == 422 and again.json()["code"] == "reset_link_invalid"


def test_reset_links_are_limited_per_address(mail_client):
    email = member(mail_client)
    outbox(mail_client)
    codes = [
        mail_client.post("/auth/password/forgot", json={"email": email}).status_code
        for _ in range(4)
    ]
    # Registration already sent one email to this address this hour.
    assert codes == [202, 202, 429, 429]
    assert len(outbox(mail_client)) == 2


def test_google_accounts_get_no_reset_email(mail_client):
    store = mail_client.app.state.container.career_store
    email = f"{uuid4()}@example.com"
    owner = store.google_account(f"google-{uuid4()}", email, str(uuid4()))
    assert store.account_for_owner(owner)["email_verified"] is True
    assert mail_client.post("/auth/password/forgot", json={"email": email}).status_code == 202
    assert outbox(mail_client) == []


def test_without_smtp_recovery_is_reported_unavailable(client):
    assert client.get("/auth/options").json()["email"] is False
    member(client)
    assert client.app.state.container.jobs.mail.count == 0
    response = client.post("/auth/password/forgot", json={"email": "someone@example.com"})
    assert response.status_code == 503 and response.json()["code"] == "email_unavailable"


class SmtpCatcher(socketserver.StreamRequestHandler):
    """Just enough of SMTP to receive one plain message."""

    received: list[bytes] = []

    def handle(self):
        self.wfile.write(b"220 catcher\r\n")
        while line := self.rfile.readline():
            command = line.strip().upper()
            if command == b"DATA":
                self.wfile.write(b"354 go\r\n")
                body = b""
                while (chunk := self.rfile.readline()) != b".\r\n":
                    body += chunk
                self.received.append(body)
                self.wfile.write(b"250 queued\r\n")
            elif command == b"QUIT":
                self.wfile.write(b"221 bye\r\n")
                return
            elif command.startswith(b"EHLO"):
                self.wfile.write(b"250 catcher\r\n")
            else:
                self.wfile.write(b"250 ok\r\n")


def test_worker_delivers_queued_mail_over_smtp(client):
    with socketserver.TCPServer(("127.0.0.1", 0), SmtpCatcher) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        container = client.app.state.container
        mailer = SmtpMailer(
            f"smtp://127.0.0.1:{server.server_address[1]}", "Career Studio <no-reply@example.com>"
        )
        container.jobs.mail.enqueue(
            "app.worker.deliver",
            {"to": "person@example.com", "subject": "Hello", "text": "Link: https://x/#token=a"},
        )
        worker.bind(container.use_cases, mailer)
        SimpleWorker(
            container.jobs.queues, connection=container.jobs.connection, serializer=JSONSerializer
        ).work(burst=True)
        server.shutdown()
    [body] = SmtpCatcher.received
    assert b"To: person@example.com" in body and b"Subject: Hello" in body
    assert b"https://x/#token=a" in body
