"""Resume periods retain month/year precision rather than inventing a day."""

import re
from datetime import date

PRESENT = {
    "present",
    "current",
    "now",
    "по настоящее время",
    "настоящее время",
    "н.в.",
    "н. в.",
    "қазіргі уақыт",
    "қазіргі уақытқа дейін",
}


def normalize_period(value, *, end=False):
    value = value.strip()
    if not value:
        return ""
    if value.casefold() in PRESENT:
        if not end:
            raise ValueError("A start date cannot be present")
        return "present"
    if re.fullmatch(r"\d{4}", value) and 1900 <= int(value) <= 2200:
        return value
    match = re.fullmatch(r"(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?", value)
    if match and 1900 <= int(match[1]) <= 2200:
        if len(value) == 10:
            date.fromisoformat(value)
        return f"{match[1]}-{match[2]}"
    match = re.fullmatch(r"(0?[1-9]|1[0-2])[./](\d{4})", value)
    if match and 1900 <= int(match[2]) <= 2200:
        return f"{match[2]}-{int(match[1]):02d}"
    raise ValueError("Choose a year and optional month (YYYY or YYYY-MM)")


def validate_period(start, end):
    if start and end and end != "present":
        earliest_start = start if len(start) == 7 else start + "-01"
        latest_end = end if len(end) == 7 else end + "-12"
        if latest_end < earliest_start:
            raise ValueError("The end of a period must not precede its start")


def validate_history(fields):
    experience = fields.get("experience", [])
    if isinstance(experience, list):
        for item in experience:
            start = normalize_period(item.get("date_from", ""))
            end = normalize_period(item.get("date_to", ""), end=True)
            validate_period(start, end)
    education = fields.get("education", [])
    if isinstance(education, list):
        for item in education:
            if (
                item.get("year_start")
                and item.get("year_end")
                and item["year_end"] < item["year_start"]
            ):
                raise ValueError("Graduation year must not precede the start year")
