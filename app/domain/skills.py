"""Skill identity preserves meaningful punctuation (C, C++, C# are distinct)."""

import unicodedata


def skill_name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def skill_key(value: str) -> str:
    return skill_name(value).casefold()
