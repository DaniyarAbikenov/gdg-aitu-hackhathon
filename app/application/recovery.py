"""Password recovery and email verification through single-use emailed links."""

from contextlib import suppress
from typing import Literal

from app.application.ports import EmailMessage, Mailer, SessionStore
from app.domain.career import CareerRepository, PasswordHasher
from app.domain.errors import (
    Conflict,
    InvalidDocument,
    NotFound,
    ProviderUnavailable,
    QuotaExceeded,
    Unauthenticated,
)
from app.domain.models import Session

Language = Literal["en", "ru", "kk"]

RESET_SECONDS = 3600
VERIFY_SECONDS = 24 * 3600

MESSAGES: dict[str, dict[Language, tuple[str, str]]] = {
    "reset": {
        "en": (
            "Reset your Career Studio password",
            "Someone asked to reset the password for this Career Studio account.\n\n"
            "Open this link within an hour to choose a new password:\n{link}\n\n"
            "If it was not you, ignore this email; your password stays the same.",
        ),
        "ru": (
            "Сброс пароля Career Studio",
            "Кто-то запросил сброс пароля для этого аккаунта Career Studio.\n\n"
            "Откройте ссылку в течение часа, чтобы задать новый пароль:\n{link}\n\n"
            "Если это были не вы, просто проигнорируйте письмо: пароль не изменится.",
        ),
        "kk": (
            "Career Studio құпиясөзін қалпына келтіру",
            "Біреу осы Career Studio аккаунтының құпиясөзін қалпына келтіруді сұрады.\n\n"
            "Жаңа құпиясөз орнату үшін сілтемені бір сағат ішінде ашыңыз:\n{link}\n\n"
            "Егер бұл сіз болмасаңыз, хатты елемеңіз: құпиясөз өзгермейді.",
        ),
    },
    "verify": {
        "en": (
            "Confirm your Career Studio email",
            "Confirm that this address belongs to your Career Studio account:\n{link}\n\n"
            "The link works for 24 hours. If you did not create an account, ignore this email.",
        ),
        "ru": (
            "Подтвердите email в Career Studio",
            "Подтвердите, что этот адрес принадлежит вашему аккаунту Career Studio:\n{link}\n\n"
            "Ссылка действует 24 часа. Если вы не создавали аккаунт, проигнорируйте письмо.",
        ),
        "kk": (
            "Career Studio email мекенжайын растаңыз",
            "Бұл мекенжай Career Studio аккаунтыңызға тиесілі екенін растаңыз:\n{link}\n\n"
            "Сілтеме 24 сағат жарамды. Аккаунт ашпаған болсаңыз, хатты елемеңіз.",
        ),
    },
}


class Recovery:
    def __init__(
        self,
        store: CareerRepository,
        sessions: SessionStore,
        passwords: PasswordHasher,
        mailer: Mailer | None,
        public_url: str,
    ):
        self.store, self.sessions, self.passwords = store, sessions, passwords
        self.mailer, self.public_url = mailer, public_url.rstrip("/")

    @property
    def available(self) -> bool:
        return self.mailer is not None

    def request_reset(self, email: str, client_id: str, language: Language) -> None:
        """Same outcome whether or not the account exists, so addresses cannot be probed."""
        mailer = self.require_mail()
        self.sessions.consume_auth(client_id)
        self.sessions.consume_mail(email)
        try:
            account = self.store.account(email)
        except NotFound:
            return
        if not account["password_hash"]:
            return  # Google accounts have no password to reset.
        token = self.sessions.issue_token(
            "reset",
            {"owner": account["owner"], "auth_version": account["auth_version"]},
            RESET_SECONDS,
        )
        mailer.send(self.message("reset", email, "/reset-password", token, language))

    def reset(self, token: str, password: str, client_id: str) -> None:
        """Sets the password and signs out every session; the link works once."""
        self.sessions.consume_auth(client_id)
        try:
            claim = self.sessions.redeem_token("reset", token)
            self.store.change_password(
                claim["owner"], claim["auth_version"], self.passwords.hash(password)
            )
            account = self.store.account_for_owner(claim["owner"])
        except (NotFound, Conflict):
            raise InvalidDocument(
                "This reset link has expired or was already used. Request a new one.",
                code="reset_link_invalid",
            ) from None
        # The emailed link proves the address works.
        self.store.verify_email(account["owner"], account["email"])

    def send_verification(self, session: Session, language: Language) -> None:
        mailer = self.require_mail()
        if not session.persistent:
            raise Unauthenticated("Sign in first.", code="sign_in_required")
        account = self.store.account_for_owner(session.owner)
        if account["email_verified"]:
            return
        self.sessions.consume_mail(account["email"])
        token = self.sessions.issue_token(
            "verify", {"owner": account["owner"], "email": account["email"]}, VERIFY_SECONDS
        )
        mailer.send(self.message("verify", account["email"], "/verify-email", token, language))

    def welcome(self, session: Session, language: Language) -> None:
        """After registration: send a confirmation link when email is configured."""
        if not self.available:
            return
        with suppress(QuotaExceeded):
            # The account exists either way; the link can be requested again from settings.
            self.send_verification(session, language)

    def verify(self, token: str, client_id: str) -> None:
        self.sessions.consume_auth(client_id)
        try:
            claim = self.sessions.redeem_token("verify", token)
        except NotFound:
            raise InvalidDocument(
                "This confirmation link has expired or was already used.",
                code="verify_link_invalid",
            ) from None
        self.store.verify_email(claim["owner"], claim["email"])

    def require_mail(self) -> Mailer:
        if self.mailer is None:
            raise ProviderUnavailable(
                "Email is not configured on this server.", code="email_unavailable"
            )
        return self.mailer

    def message(
        self, kind: str, to: str, path: str, token: str, language: Language
    ) -> EmailMessage:
        subject, body = MESSAGES[kind][language]
        # The token travels in the fragment, so it never reaches server or proxy logs.
        link = f"{self.public_url}{path}#token={token}"
        return EmailMessage(to=to, subject=subject, text=body.format(link=link))
