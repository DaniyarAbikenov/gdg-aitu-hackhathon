"""iCalendar (RFC 5545) export of follow-up dates and learning weeks."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

PRODUCT = "-//A2D Career Studio//EN"


@dataclass(frozen=True)
class CalendarEvent:
    uid: str
    day: date
    summary: str
    description: str = ""
    days: int = 1


def escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line: str) -> list[str]:
    """Lines longer than 75 octets continue on the next line after a space."""
    folded, current = [], ""
    for char in line:
        if len((current + char).encode()) > 75:
            folded.append(current)
            current = " "
        current += char
    return [*folded, current]


def calendar(name: str, events: list[CalendarEvent]) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:" + PRODUCT,
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:" + escape(name),
    ]
    for event in events:
        lines += [
            "BEGIN:VEVENT",
            f"UID:{event.uid}",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{event.day:%Y%m%d}",
            f"DTEND;VALUE=DATE:{event.day + timedelta(days=event.days):%Y%m%d}",
            "SUMMARY:" + escape(event.summary),
        ]
        if event.description:
            lines.append("DESCRIPTION:" + escape(event.description))
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "".join(f"{part}\r\n" for line in lines for part in fold(line))
