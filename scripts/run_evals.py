"""Check AI output against fictional cases: grounded facts, no invented numbers, right language.

    CAREER_PROVIDER=local python scripts/run_evals.py           # what CI runs
    python scripts/run_evals.py --report evals/report.md         # with the configured provider

Real providers use the keys from the environment or .env and cost tokens; the report lists them.
Exit code 1 when any check fails.
"""

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.application.ports import AiCall  # noqa: E402
from app.config import Settings  # noqa: E402
from app.domain.letter import candidate_facts, skill_match  # noqa: E402
from app.domain.models import ResumeFields  # noqa: E402
from app.infrastructure.coach import Coach  # noqa: E402

CYRILLIC = re.compile(r"[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]")
LATIN = re.compile(r"[A-Za-z]")
KAZAKH = re.compile(r"[ӘәҒғҚқҢңӨөҰұҮүҺһІі]")
NUMBER = re.compile(r"\d+")


@dataclass
class Result:
    case: str
    task: str
    checks: dict[str, str] = field(default_factory=dict)  # name -> "" when passed, else why
    seconds: float = 0.0

    @property
    def passed(self) -> bool:
        return not any(self.checks.values())


def normalized(text: str) -> str:
    return " ".join(text.casefold().split())


def language_problem(text: str, language: str, evidence: str) -> str:
    """Judged on the letter's own words; names and skills copied from the input are skipped."""
    known = set(re.findall(r"\w+", evidence))
    text = " ".join(w for w in re.findall(r"\w+", text) if w.casefold() not in known)
    letters = len(CYRILLIC.findall(text)) + len(LATIN.findall(text))
    cyrillic = len(CYRILLIC.findall(text)) / max(letters, 1)
    if language == "en" and cyrillic > 0.05:
        return f"{cyrillic:.0%} Cyrillic letters in an English letter"
    if language in {"ru", "kk"} and cyrillic < 0.6:
        return f"only {cyrillic:.0%} Cyrillic letters"
    if language == "kk" and not KAZAKH.search(text):
        return "no Kazakh-specific letters"
    return ""


def invented_numbers(text: str, evidence: str) -> list[str]:
    known = set(NUMBER.findall(evidence))
    return sorted(set(NUMBER.findall(text)) - known)


def check_letter(coach: Coach, case: dict, language: str) -> Result:
    result = Result(case["title"], f"cover letter ({language})")
    facts = candidate_facts(case["profile"], case["resume"])
    matched, missing = skill_match(facts, case["vacancy"])
    started = time.perf_counter()
    letter = coach.cover_letter(facts, case["vacancy"], matched, missing, language)
    result.seconds = time.perf_counter() - started

    evidence = normalized(json.dumps([facts, case["vacancy"]], ensure_ascii=False))
    candidate = normalized(json.dumps(facts, ensure_ascii=False))
    text = letter["text"]
    ungrounded = [
        fact
        for fact in letter["facts_used"]
        if not all(normalized(part) in candidate for part in fact.split(", ") if part.strip())
    ]
    result.checks["facts_used come from the candidate"] = (
        f"not in the profile or resume: {ungrounded}" if ungrounded else ""
    )
    numbers = invented_numbers(text, evidence)
    result.checks["no invented numbers"] = f"numbers not in the input: {numbers}" if numbers else ""
    named = [term for term in case["never_mention"] if normalized(term) in normalized(text)]
    result.checks["no claims outside the facts"] = f"mentions {named}" if named else ""
    claimed = [
        skill
        for skill in missing
        if re.search(
            rf"\b(experienced|expert|proficient) (in|with) {re.escape(skill)}\b", text, re.I
        )
    ]
    result.checks["missing skills are not claimed"] = f"claims {claimed}" if claimed else ""
    result.checks["written in the requested language"] = language_problem(text, language, evidence)
    return result


def check_improvements(coach: Coach, case: dict) -> Result:
    result = Result(case["title"], "resume improvements")
    fields = ResumeFields(**case["resume"]).__dict__
    job = json.dumps(case["vacancy"], ensure_ascii=False)
    started = time.perf_counter()
    improvements = coach.improvements(fields, case["profile"], job)["improvements"]
    result.seconds = time.perf_counter() - started

    evidence = normalized(json.dumps([fields, case["profile"]], ensure_ascii=False))
    known_skills = {normalized(s) for s in fields["skills"]}
    added_skills, numbers = [], []
    for item in improvements:
        if item["section"] == "skills":
            added_skills += [
                s.strip()
                for s in item["after"].split(",")
                if s.strip() and normalized(s) not in known_skills
            ]
        numbers += invented_numbers(item["after"], evidence)
    result.checks["no new skills"] = f"adds {added_skills}" if added_skills else ""
    result.checks["no invented numbers"] = (
        f"numbers not in the resume: {sorted(set(numbers))}" if numbers else ""
    )
    return result


def report(results: list[Result], calls: list[AiCall], provider: str) -> str:
    lines = [f"# AI evaluation ({provider})", ""]
    passed = sum(r.passed for r in results)
    lines.append(f"{passed} of {len(results)} outputs passed every check.")
    if calls:
        sent = sum(c.input_tokens for c in calls)
        received = sum(c.output_tokens for c in calls)
        lines.append(f"{len(calls)} provider calls, {sent} input and {received} output tokens.")
    else:
        lines.append("No provider calls: the rule-based local provider was used.")
    lines += ["", "| Case | Task | Seconds | Result |", "| --- | --- | --- | --- |"]
    for r in results:
        failures = "; ".join(f"{name}: {why}" for name, why in r.checks.items() if why)
        lines.append(
            f"| {r.case} | {r.task} | {r.seconds:.1f} | {'pass' if r.passed else failures} |"
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--cases", type=Path, default=ROOT / "evals" / "cases")
    parser.add_argument("--report", type=Path, help="also write the Markdown report here")
    args = parser.parse_args()

    settings = Settings()
    if settings.provider == "unconfigured":
        parser.error("Set CAREER_PROVIDER (local, openai or gemini).")
    calls: list[AiCall] = []
    coach = Coach(settings, meter=calls.append)
    results = []
    for path in sorted(args.cases.glob("*.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        results += [check_letter(coach, case, language) for language in case["languages"]]
        results.append(check_improvements(coach, case))

    text = report(results, calls, settings.provider)
    print(text)
    if args.report:
        args.report.write_text(text, encoding="utf-8")
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
