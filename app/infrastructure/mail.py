"""SMTP delivery. The URL scheme picks the transport:
smtp:// (plain, for a local catcher), smtp+starttls:// or smtps:// (implicit TLS)."""

import smtplib
import ssl
from email.message import EmailMessage as MimeMessage
from email.utils import make_msgid
from urllib.parse import unquote, urlsplit

from app.application.ports import EmailMessage

SCHEMES = {"smtp": 25, "smtp+starttls": 587, "smtps": 465}


class SmtpMailer:
    def __init__(self, url: str, sender: str, timeout: float = 15):
        parts = urlsplit(url)
        if parts.scheme not in SCHEMES or not parts.hostname:
            raise ValueError("Use an smtp://, smtp+starttls:// or smtps:// URL")
        self.scheme, self.host = parts.scheme, parts.hostname
        self.port = parts.port or SCHEMES[parts.scheme]
        self.username = unquote(parts.username or "")
        self.password = unquote(parts.password or "")
        self.sender, self.timeout = sender, timeout

    def send(self, message: EmailMessage) -> None:
        mime = MimeMessage()
        mime["From"], mime["To"], mime["Subject"] = self.sender, message.to, message.subject
        mime["Message-ID"] = make_msgid()
        mime.set_content(message.text)
        context = ssl.create_default_context()
        if self.scheme == "smtps":
            client: smtplib.SMTP = smtplib.SMTP_SSL(
                self.host, self.port, timeout=self.timeout, context=context
            )
        else:
            client = smtplib.SMTP(self.host, self.port, timeout=self.timeout)
        with client:
            if self.scheme == "smtp+starttls":
                client.starttls(context=context)
            if self.username:
                client.login(self.username, self.password)
            client.send_message(mime)
