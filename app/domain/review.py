import json
import re
from dataclasses import asdict

from app.domain.models import Analysis, ResumeFields, Suggestion

SKILLS = {
    "Python": ["python"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Flask": ["flask"],
    "JavaScript": ["javascript"],
    "TypeScript": ["typescript"],
    "React": ["react", "react.js"],
    "Angular": ["angular"],
    "Vue": ["vue", "vue.js"],
    "Node.js": ["node.js", "nodejs"],
    "Go": ["golang", "go"],
    "Java": ["java"],
    "PHP": ["php"],
    "Laravel": ["laravel"],
    "C++": ["c++"],
    "C#": ["c#"],
    "SQL": ["sql"],
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "MongoDB": ["mongodb"],
    "Redis": ["redis"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws"],
    "Google Cloud": ["gcp", "google cloud"],
    "Azure": ["azure"],
    "Git": ["git"],
    "GitHub Actions": ["github actions"],
    "CI/CD": ["ci/cd", "ci cd"],
    "REST": ["rest", "restful"],
    "GraphQL": ["graphql"],
    "pytest": ["pytest"],
    "Testing": ["testing", "unit tests", "automated tests"],
    "Linux": ["linux"],
    "Terraform": ["terraform"],
    "Figma": ["figma"],
}


def skills_in(text):
    text = text.casefold()
    return [
        skill
        for skill, aliases in SKILLS.items()
        if any(re.search(r"(?<![\w])" + re.escape(a) + r"(?![\w])", text) for a in aliases)
    ]


def extract_fields(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    email = re.search(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", text)
    sections = {
        key: []
        for key in ["summary", "experience", "education", "projects", "certificates", "languages"]
    }
    current = "experience"
    headings = {
        "summary": "summary",
        "profile": "summary",
        "about": "summary",
        "experience": "experience",
        "work experience": "experience",
        "experience & projects": "experience",
        "projects": "projects",
        "certificates": "certificates",
        "languages": "languages",
        "проекты": "projects",
        "сертификаты": "certificates",
        "языки": "languages",
        "education": "education",
        "образование": "education",
        "опыт работы": "experience",
        "о себе": "summary",
        "skills": "skip",
        "technical skills": "skip",
        "навыки": "skip",
    }
    for line in lines[1:]:
        heading = headings.get(line.rstrip(":").casefold())
        if heading:
            current = heading
        elif current != "skip" and not (email and email.group() in line):
            sections[current].append(line)
    return ResumeFields(
        full_name=lines[0][:120] if lines else "",
        email=email.group() if email else "",
        summary="\n".join(sections["summary"])[:3000],
        experience="\n".join(sections["experience"])[:12000],
        education="\n".join(sections["education"])[:3000],
        skills=skills_in(text),
        projects="\n".join(sections["projects"])[:6000],
        certificates="\n".join(sections["certificates"])[:3000],
        languages="\n".join(sections["languages"])[:500],
    )


def compare(fields: ResumeFields, jd_text: str):
    # Only verified resume fields participate; job-description terms never become claimed skills.
    resume_skills = set(skills_in(json.dumps(asdict(fields))))
    requested = skills_in(jd_text)
    matched = [s for s in requested if s in resume_skills]
    missing = [s for s in requested if s not in resume_skills]
    suggestions = []
    if matched:
        suggestions.append(
            Suggestion(
                kind="strength",
                title="Make your relevant experience easy to find",
                detail="The role and your resume both mention " + ", ".join(matched) + ". "
                "Put a concrete example using these skills near the top of your experience.",
            )
        )
    if missing:
        suggestions.append(
            Suggestion(
                kind="gap",
                title="Check the gaps before applying",
                detail="The role mentions " + ", ".join(missing) + ", but these are not found in "
                "your reviewed resume. Add them only if you can support them with real experience.",
            )
        )
    if not requested:
        suggestions.append(
            Suggestion(
                kind="improvement",
                title="Review the role manually",
                detail="No terms from the supported technical-skills vocabulary were found. "
                "This matcher does not measure suitability, seniority, or hiring probability.",
            )
        )
    if not fields.summary:
        suggestions.append(
            Suggestion(
                kind="improvement",
                title="Write a focused introduction",
                detail="Add two or three sentences about your actual experience and the work you "
                "want to do. Use details you can demonstrate.",
            )
        )
    if not re.search(r"\d", fields.experience):
        suggestions.append(
            Suggestion(
                kind="improvement",
                title="Show the outcome of your work",
                detail="Describe the problem, your contribution, and the result. Include measured "
                "numbers only when you have evidence for them.",
            )
        )
    suggestions.append(
        Suggestion(
            kind="improvement",
            title="Keep the final version factual",
            detail="Review the extracted fields, preserve your own wording where appropriate, "
            "and download a PDF containing only the information you have confirmed.",
        )
    )
    return Analysis(
        provider="local", matched_skills=matched, missing_skills=missing, suggestions=suggestions
    )
