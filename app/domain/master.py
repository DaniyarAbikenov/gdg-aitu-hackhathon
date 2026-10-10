"""The profile is the master record of facts; resumes are linked selections of it.

A resume keeps a link: the profile entries it was built from, as they were at that
moment. Comparing the link, the resume and the current profile tells who changed
what. An entry changed only in the profile is a safe update; an entry changed on
both sides needs the candidate's review; nothing is overwritten silently.
"""

from collections.abc import Iterable, Mapping
from typing import Any
from uuid import uuid4

from app.domain.errors import Conflict
from app.domain.skills import skill_key

LIST_SECTIONS = ("experience", "education", "projects", "awards")
SET_SECTIONS = ("skills", "interests")
TEXT_SECTIONS = ("summary", "certificates", "languages")
CONTACTS = ("full_name", "email", "phone", "location")
SECTIONS = ("summary", *LIST_SECTIONS, *SET_SECTIONS, "certificates", "languages")

FINGERPRINT = {
    "experience": ("company", "role"),
    "education": ("institution", "degree"),
    "projects": ("title",),
    "awards": ("title",),
}


def new_id() -> str:
    return uuid4().hex[:12]


def with_ids(profile: Mapping[str, Any]) -> dict[str, Any]:
    """Every structured profile entry gets a stable id that resumes can refer to."""
    result = dict(profile)
    seen: set[str] = set()
    for section in LIST_SECTIONS:
        value = profile.get(section)
        if not isinstance(value, list):
            continue
        entries = []
        for item in value:
            entry = dict(item)
            if not entry.get("id") or entry["id"] in seen:
                entry["id"] = new_id()
            seen.add(entry["id"])
            entries.append(entry)
        result[section] = entries
    return result


def item_key(section: str, value: str) -> str:
    return skill_key(value) if section == "skills" else " ".join(value.casefold().split())


def fingerprint(section: str, item: Mapping[str, Any]) -> tuple[str, ...]:
    return tuple(" ".join(str(item.get(k) or "").casefold().split()) for k in FINGERPRINT[section])


def content(item: Mapping[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in item.items() if k != "id"}


def entries(value: Any) -> list[dict[str, Any]]:
    return [dict(i) for i in value] if isinstance(value, list) else []


def label(section: str, item: Mapping[str, Any]) -> str:
    parts = [str(item.get(k) or "") for k in FINGERPRINT[section]]
    return " · ".join(p for p in parts if p) or section


def select(
    profile: Mapping[str, Any],
    sections: Iterable[str],
    chosen: Mapping[str, list[str]] | None = None,
) -> dict[str, Any]:
    """Profile facts for a new resume: whole sections, or the chosen entries of each."""
    fields: dict[str, Any] = {k: profile[k] for k in CONTACTS if profile.get(k)}
    for section in sections:
        if section not in SECTIONS or not profile.get(section):
            continue
        value = profile[section]
        picks = None if chosen is None else chosen.get(section)
        if picks is None:
            fields[section] = value
        elif section in LIST_SECTIONS and isinstance(value, list):
            fields[section] = [i for i in value if i.get("id") in set(picks)]
        elif section in SET_SECTIONS:
            wanted = {item_key(section, p) for p in picks}
            fields[section] = [v for v in value if item_key(section, v) in wanted]
        else:
            fields[section] = value
    return fields


def restore_ids(source: Mapping[str, Any], composed: Mapping[str, Any]) -> dict[str, Any]:
    """A rewritten resume keeps its link: entries are matched back to the profile."""
    result = dict(composed)
    for section in LIST_SECTIONS:
        if not isinstance(composed.get(section), list):
            continue
        originals = entries(source.get(section))
        ids = {o["id"] for o in originals if o.get("id")}
        by_print = {fingerprint(section, o): o["id"] for o in originals if o.get("id")}
        restored, used = [], set()
        for item in entries(composed[section]):
            given = item.get("id")
            match = (
                given
                if given in ids and given not in used
                else by_print.get(fingerprint(section, item))
            )
            item["id"] = match if match and match not in used else ""
            used.add(item["id"])
            restored.append(item)
        result[section] = restored
    return result


def known(profile: Mapping[str, Any]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for section in LIST_SECTIONS:
        result[section] = [i["id"] for i in entries(profile.get(section)) if i.get("id")]
    for section in SET_SECTIONS:
        result[section] = [item_key(section, v) for v in profile.get(section) or []]
    return result


def build_link(profile: Mapping[str, Any], revision: int, fields: Mapping[str, Any]) -> dict:
    """What a resume was built from, kept to compare with later profile versions."""
    items: dict[str, dict[str, Any]] = {}
    for section in LIST_SECTIONS:
        used = {i.get("id") for i in entries(fields.get(section))}
        items[section] = {
            i["id"]: content(i) for i in entries(profile.get(section)) if i.get("id") in used
        }
    text = {k: profile.get(k, "") for k in (*TEXT_SECTIONS, *CONTACTS) if fields.get(k)}
    return {"profile_revision": revision, "items": items, "text": text, "known": known(profile)}


def _match(
    section: str, item: Mapping[str, Any], by_id: dict, pool: list[dict], taken: set
) -> dict | None:
    candidate = by_id.get(item.get("id"))
    if candidate and candidate["id"] not in taken:
        return candidate
    if item.get("id") in by_id:
        return None
    printed = fingerprint(section, item)
    return next(
        (p for p in pool if p["id"] not in taken and fingerprint(section, p) == printed), None
    )


def plan(
    profile: Mapping[str, Any],
    fields: Mapping[str, Any],
    link: Mapping[str, Any] | None,
    demand: Mapping[str, int] | None = None,
) -> list[dict[str, Any]]:
    """Differences between the profile and a resume that the candidate can act on.

    kind: update (only the profile changed), review (both changed or the link is
    unknown), new (added to the profile since the resume was linked) and removed
    (deleted from the profile but still in the resume).
    """
    link = link or {}
    basis = link.get("items", {})
    text_basis = link.get("text", {})
    seen = link.get("known")
    demand = demand or {}
    changes: list[dict[str, Any]] = []

    def add(
        kind: str, section: str, key: str, name: str, resume: Any, current: Any, **extra: Any
    ) -> None:
        changes.append(
            {
                "id": f"{kind}:{section}:{key}",
                "kind": kind,
                "section": section,
                "key": key,
                "label": name,
                "resume": resume,
                "profile": current,
                **extra,
            }
        )

    for section in LIST_SECTIONS:
        pool = [p for p in entries(profile.get(section)) if p.get("id")]
        by_id = {p["id"]: p for p in pool}
        section_basis = basis.get(section, {})
        taken: set[str] = set()
        for item in entries(fields.get(section)):
            current = _match(section, item, by_id, pool, taken)
            if current is None:
                gone = item.get("id") and (
                    item["id"] in section_basis or item["id"] in (seen or {}).get(section, [])
                )
                if gone:
                    add("removed", section, item["id"], label(section, item), item, None)
                continue
            taken.add(current["id"])
            if content(current) == content(item):
                continue
            base = section_basis.get(current["id"])
            if base is not None and base == content(current):
                continue  # Only the resume was edited: a deliberate, vacancy-specific choice.
            kind = "update" if base is not None and base == content(item) else "review"
            add(kind, section, current["id"], label(section, current), item, current)
        if seen is not None:
            for current in pool:
                if current["id"] not in taken and current["id"] not in seen.get(section, []):
                    add("new", section, current["id"], label(section, current), None, current)

    for key in (*TEXT_SECTIONS, *CONTACTS):
        wanted, written = profile.get(key) or "", fields.get(key) or ""
        if wanted == written or (not written and key not in text_basis):
            continue
        base = text_basis.get(key)
        if base is not None and base == wanted:
            continue
        kind = "update" if base is not None and base == written else "review"
        add(kind, key, key, key, written, wanted)

    for section in SET_SECTIONS:
        if seen is None and section != "skills":
            continue  # Unlinked resumes only get skill suggestions, not every interest.
        values = list(profile.get(section) or [])
        mine = list(fields.get(section) or [])
        mine_keys = {item_key(section, v) for v in mine}
        profile_keys = {item_key(section, v) for v in values}
        before = set((seen or {}).get(section, []))
        for value in values:
            key = item_key(section, value)
            if key not in mine_keys and key not in before:
                add("new", section, key, value, None, value, demand=demand.get(key, 0))
        for value in mine:
            key = item_key(section, value)
            if key not in profile_keys and key in before:
                add("removed", section, key, value, value, None)

    order = {"review": 0, "update": 1, "removed": 2, "new": 3}
    return sorted(changes, key=lambda c: (order[c["kind"]], -c.get("demand", 0)))


def apply(
    profile: Mapping[str, Any],
    revision: int,
    fields: Mapping[str, Any],
    link: Mapping[str, Any] | None,
    accept: Iterable[str],
    dismiss: Iterable[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Applies accepted changes and remembers dismissed ones; the rest stay pending."""
    accept, dismiss = set(accept), set(dismiss)
    pending = plan(profile, fields, link)
    by_id = {c["id"]: c for c in pending}
    if (accept | dismiss) - set(by_id) or accept & dismiss:
        raise Conflict  # The resume or profile changed since the list was shown.
    result = {
        k: (entries(v) if k in LIST_SECTIONS and isinstance(v, list) else v)
        for k, v in fields.items()
    }
    if link:
        state = {
            "items": {s: dict(v) for s, v in link.get("items", {}).items()},
            "text": dict(link.get("text", {})),
            "known": {s: list(v) for s, v in link.get("known", {}).items()},
        }
    else:
        # First decision on an unlinked resume: everything not offered as new counts as seen.
        offered = {(c["section"], c["key"]) for c in pending if c["kind"] == "new"}
        state = {
            "items": {},
            "text": {},
            "known": {
                s: [k for k in keys if (s, k) not in offered] for s, keys in known(profile).items()
            },
        }
    for change in pending:
        if change["id"] not in accept | dismiss:
            continue
        section, key, kind = change["section"], change["key"], change["kind"]
        take = change["id"] in accept
        if section in LIST_SECTIONS:
            items = result.setdefault(section, [])
            if not isinstance(items, list):
                items = result[section] = []
            if kind == "removed":
                if take:
                    result[section] = [i for i in items if i.get("id") != key]
                state["items"].setdefault(section, {}).pop(key, None)
                forget(state, section, key)
                continue
            current = dict(change["profile"])
            if take and kind == "new":
                items.append(current)
            elif take:
                position = next(
                    (n for n, i in enumerate(items) if content(i) == content(change["resume"])),
                    None,
                )
                if position is not None:
                    items[position] = current
            state["items"].setdefault(section, {})[key] = content(current)
            state["known"].setdefault(section, [])
            if key not in state["known"][section]:
                state["known"][section].append(key)
        elif section in SET_SECTIONS:
            values = list(result.get(section) or [])
            if kind == "new":
                if take:
                    values.append(change["profile"])
                state["known"].setdefault(section, []).append(key)
            else:
                if take:
                    values = [v for v in values if item_key(section, v) != key]
                forget(state, section, key)
            result[section] = values
        else:
            if take:
                result[section] = change["profile"]
            state["text"][section] = change["profile"]
    return result, {"profile_revision": revision, **state}


def forget(state: dict[str, Any], section: str, key: str) -> None:
    """A removed fact is settled either way: it is no longer offered again."""
    state["known"][section] = [k for k in state["known"].get(section, []) if k != key]


def status(changes: list[dict[str, Any]]) -> str:
    if any(c["kind"] == "review" for c in changes):
        return "review"
    if any(c["kind"] in {"update", "removed"} for c in changes):
        return "outdated"
    if changes:
        return "suggestions"
    return "current"
