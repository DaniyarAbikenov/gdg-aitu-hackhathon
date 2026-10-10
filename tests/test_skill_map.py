from app.domain import skill_map


def vacancy(*skills, status="saved", name="Backend", company="Atlas"):
    return {"status": status, "skills": list(skills), "name": name, "company_name": company}


def interview(stack, *answers, finished=True):
    return {
        "finished": finished,
        "score": 70,
        "context": {"tech_stack": stack, "vacancy_title": "Backend"},
        "answers": [{"question": q, "score": s} for q, s in answers],
    }


def nodes(result):
    return {n["key"]: n for n in result["nodes"]}


def test_stack_text_is_split_into_short_skill_names():
    assert skill_map.split_stack(
        "Python, FastAPI / Google Cloud Platform; experience with many tools"
    ) == ["Python", "FastAPI", "Google Cloud Platform"]
    assert skill_map.split_stack("we use postgres and docker in production daily") == [
        "PostgreSQL",
        "Docker",
    ]


def test_mentions_respect_word_boundaries_and_symbols():
    names = {"c++": "C++", "c": "C", "go": "Go", "sql": "SQL"}
    assert skill_map.mentioned("Explain RAII in C++", names) == {"c++"}
    assert skill_map.mentioned("Write a good SQL query", names) == {"sql"}


def test_statuses_demand_and_links():
    result = skill_map.build(
        ["Python", "Git"],
        [
            ("v1", vacancy("Python", "Docker", "SQL")),
            ("v2", vacancy("python", "Docker", name="Platform")),
            ("v3", vacancy("Kotlin", status="rejected")),
        ],
        [("p1", {"stacks": ["SQL"], "modules": [{"completed": True}, {"completed": False}]})],
        [],
    )
    by_key = nodes(result)
    assert result["vacancies"] == 2
    assert by_key["python"]["status"] == "strength" and by_key["python"]["demand"] == 2
    assert by_key["git"]["status"] == "have"
    assert by_key["docker"]["status"] == "gap"
    assert by_key["sql"]["status"] == "learning"
    assert by_key["sql"]["learning"] == {"plans": ["p1"], "completed": 1, "total": 2}
    assert "kotlin" not in by_key  # closed vacancies are not demand
    assert {"source": "docker", "target": "python", "weight": 2} in result["links"]
    assert result["strongest"] == "python"
    assert result["next_to_learn"] == ["docker"]
    # Most requested first.
    assert [n["key"] for n in result["nodes"]][:2] == ["python", "docker"]


def test_practice_scores_follow_the_skill_named_in_each_question():
    result = skill_map.build(
        ["Python"],
        [("v1", vacancy("Python", "PostgreSQL"))],
        [],
        [
            (
                "i2",
                "2026-10-08T10:00:00+00:00",
                interview("Python, PostgreSQL", ("Index a PostgreSQL table", 80), ("Teamwork", 60)),
            ),
            (
                "i1",
                "2026-10-01T10:00:00+00:00",
                interview("Python", ("Explain Python generators", 40)),
            ),
            (
                "i3",
                "2026-10-09T10:00:00+00:00",
                interview("Go", ("Go channels", 90), finished=False),
            ),
        ],
    )
    by_key = nodes(result)
    assert [(p["interview_id"], p["score"]) for p in by_key["python"]["practice"]] == [
        ("i1", 40),
        ("i2", 60),  # the unnamed teamwork answer counts for the session's stack
    ]
    assert [(p["interview_id"], p["score"]) for p in by_key["postgresql"]["practice"]] == [
        ("i2", 70)
    ]
    assert [s["interview_id"] for s in result["scores"]] == ["i1", "i2"]
    assert "go" not in by_key


def test_map_is_limited_to_the_most_relevant_skills():
    many = [f"Skill {i}" for i in range(60)]
    result = skill_map.build(many, [("v1", vacancy("Skill 59", "Rust"))], [], [])
    assert len(result["nodes"]) == skill_map.MAX_NODES
    keys = [n["key"] for n in result["nodes"]]
    assert keys[:2] == ["skill 59", "rust"]
    assert all(link["source"] in keys and link["target"] in keys for link in result["links"])
