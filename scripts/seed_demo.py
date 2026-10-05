"""Create a separate fictional account against a local running server, without AI calls."""

import argparse
import getpass
import http.cookiejar
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://localhost:8080")
parser.add_argument("--email", default="demo@a2d.local")
parser.add_argument("--password-stdin", action="store_true")
args = parser.parse_args()
if urllib.parse.urlsplit(args.url).hostname not in {"localhost", "127.0.0.1", "::1"}:
    parser.error("Demo seeding is limited to a local server.")
password = (
    sys.stdin.readline().rstrip("\r\n")
    if args.password_stdin
    else getpass.getpass("Password for the separate demo account (12+ characters): ")
)
if len(password) < 12:
    parser.error("Password needs at least 12 characters.")
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def post(path, data):
    request = urllib.request.Request(
        args.url.rstrip("/") + "/api" + path,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with client.open(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise SystemExit(
            f"{path}: HTTP {exc.code}. Existing accounts are never overwritten. Use a new demo email if one already exists."
        ) from None


post("/session", {})
post("/auth/register", {"email": args.email, "password": password})
profile = json.loads((Path(__file__).resolve().parents[1] / "docs/demo/profile.json").read_text())
post("/user/profile/update", {"revision": 0, "profile": profile})
job = "Вымышленная учебная вакансия: Junior Backend Developer. Разработка API на Python и FastAPI, работа с PostgreSQL, тестирование pytest, Docker и основы CI/CD. Нужно уметь объяснять свои решения и разбирать ошибки."
application = post(
    "/applications",
    {
        "name": "Junior Backend Developer — пример",
        "company_name": "Учебная команда (вымышленная)",
        "description": job,
        "skills": ["Python", "FastAPI", "PostgreSQL", "pytest"],
        "status": "preparing",
        "next_action": "Проверить факты в резюме перед тренировкой",
        "notes": "Демонстрационная запись. Реальный отклик не отправлялся.",
    },
)
post(
    "/resume/create",
    {
        "title": "Учебное резюме — данные вымышлены",
        "position": "Junior Backend Developer",
        "job": job,
        "sections": ["summary", "experience", "education", "projects", "skills", "languages"],
        "use_ai": False,
        "vacancy_id": application["id"],
    },
)
print(f"Created separate demo account: {args.email}")
print(f"Open {args.url}/applications?id={application['id']}")
print(
    "Profile, vacancy and manual resume are stored. No fake interviews, scores or AI calls were created."
)
