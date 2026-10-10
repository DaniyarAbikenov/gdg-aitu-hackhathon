"""A saved vacancy is the shared context of the preparation journey."""

from dataclasses import dataclass

CLOSED_STATUSES = {"offer", "rejected", "archived"}

# Defaults applied when reading records saved by earlier releases.
VACANCY_DEFAULTS = {
    "status": "saved",
    "company_name": "",
    "company_description": "",
    "source_url": "",
    "notes": "",
    "next_action": "",
    "follow_up": "",
    "resume_id": "",
    "skills": [],
    "cover_letter": "",
}


@dataclass(frozen=True)
class NextStep:
    key: str
    text: str


def company_key(name: str) -> str:
    """Company identity ignores case and repeated whitespace."""
    return " ".join(name.casefold().split())


def next_step(
    status: str,
    next_action: str,
    has_resume: bool,
    interviews_started: int,
    interviews_finished: int,
    plans: int,
    rejection_reviewed: bool = True,
) -> NextStep:
    if status == "rejected" and not rejection_reviewed:
        return NextStep(
            "reviewRejection", "Ответьте на три вопроса об отказе и получите следующий шаг."
        )
    if status in CLOSED_STATUSES:
        return NextStep("wrapUp", "Подведите итоги и сохраните полезные выводы.")
    if next_action:
        return NextStep("custom", next_action)
    if not has_resume:
        return NextStep("chooseResume", "Выберите резюме для этой вакансии.")
    if not interviews_started:
        return NextStep("practice", "Пройдите тренировку по требованиям вакансии.")
    if not interviews_finished:
        return NextStep("finish", "Завершите начатую тренировку.")
    if not plans:
        return NextStep("plan", "Составьте план по результатам подготовки.")
    return NextStep("contact", "Запланируйте отклик или следующий контакт.")
