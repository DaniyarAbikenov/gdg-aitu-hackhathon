"""Server-only administrative account provisioning (never a public HTTP endpoint)."""

import argparse
import getpass
import sys
from uuid import uuid4

from app.config import Settings
from app.domain.errors import NotFound
from app.infrastructure.career_store import PostgresCareerRepository
from app.infrastructure.passwords import ScryptPasswords
from app.infrastructure.postgres import PostgresRepository


def main():
    parser = argparse.ArgumentParser(description="Create an allowlisted administrator account")
    parser.add_argument("email")
    parser.add_argument("--password-stdin", action="store_true")
    args = parser.parse_args()
    settings = Settings()
    email = args.email.strip().casefold()
    if email not in {e.strip().casefold() for e in settings.admin_emails.split(",") if e.strip()}:
        parser.error("Email must be listed in CAREER_ADMIN_EMAILS")
    repository = PostgresRepository(settings.database_url)
    store = PostgresCareerRepository(repository)
    try:
        try:
            store.account(email)
            print("Account already exists; its password has not been changed.")
            return
        except NotFound:
            pass
        password = (
            sys.stdin.readline().rstrip("\r\n")
            if args.password_stdin
            else getpass.getpass("New administrator password (12–256 characters): ")
        )
        if not 12 <= len(password) <= 256:
            parser.error("Password must contain 12–256 characters")
        if not args.password_stdin and getpass.getpass("Repeat password: ") != password:
            parser.error("Passwords do not match")
        store.register(email, ScryptPasswords().hash(password), str(uuid4()))
        print("Administrator account created.")
    finally:
        repository.close()


if __name__ == "__main__":
    main()
