"""Salted scrypt hashes; the database never stores plaintext passwords."""

import hashlib
import hmac
import secrets


class ScryptPasswords:
    def hash(self, password):
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(
            password.encode(), salt=salt, n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024
        )
        return f"scrypt${salt.hex()}${digest.hex()}"

    def verify(self, password, encoded):
        try:
            algorithm, salt, expected = encoded.split("$")
            if algorithm != "scrypt":
                return False
            digest = hashlib.scrypt(
                password.encode(),
                salt=bytes.fromhex(salt),
                n=2**17,
                r=8,
                p=1,
                maxmem=256 * 1024 * 1024,
            )
            return hmac.compare_digest(digest.hex(), expected)
        except (ValueError, TypeError, AttributeError):
            return False
