import pytest

from app.domain import master
from app.domain.errors import Conflict


def profile(**changes):
    data = {
        "full_name": "Aru Example",
        "email": "aru@example.test",
        "summary": "Backend developer",
        "skills": ["Python", "SQL"],
        "interests": ["Chess"],
        "experience": [
            {"id": "job1", "company": "Library", "role": "Engineer", "responsibilities": "APIs"},
            {"id": "job2", "company": "Cafe", "role": "Barista", "responsibilities": "Coffee"},
        ],
        "awards": [{"id": "aw1", "title": "Hackathon winner", "detail": "", "year": 2024}],
    }
    return {**data, **changes}


def built(chosen=None, sections=("summary", "experience", "skills", "awards")):
    source = profile()
    fields = master.select(source, sections, chosen)
    return fields, master.build_link(source, 1, fields)


def test_ids_are_added_once_and_duplicates_replaced():
    result = master.with_ids({"projects": [{"title": "A"}, {"id": "x", "title": "B"}, {"id": "x"}]})
    ids = [p["id"] for p in result["projects"]]
    assert ids[1] == "x" and len(set(ids)) == 3 and all(ids)
    assert master.with_ids(result) == result


def test_selection_keeps_only_chosen_entries_and_contacts():
    fields, _ = built({"experience": ["job1"], "skills": ["python"]})
    assert [e["id"] for e in fields["experience"]] == ["job1"]
    assert fields["skills"] == ["Python"]
    assert fields["full_name"] == "Aru Example" and "interests" not in fields


def test_unchanged_resume_is_current():
    fields, link = built()
    assert master.plan(profile(), fields, link) == []
    assert master.status([]) == "current"


def test_profile_only_change_is_a_safe_update():
    fields, link = built()
    current = profile(
        experience=[
            {
                "id": "job1",
                "company": "Library",
                "role": "Senior Engineer",
                "responsibilities": "APIs",
            },
            profile()["experience"][1],
        ]
    )
    [change] = master.plan(current, fields, link)
    assert change["kind"] == "update" and change["key"] == "job1"
    updated, new_link = master.apply(current, 2, fields, link, [change["id"]], [])
    assert updated["experience"][0]["role"] == "Senior Engineer"
    assert master.plan(current, updated, new_link) == []


def test_both_sides_changed_needs_review_and_keep_mine_settles_it():
    fields, link = built()
    fields["experience"][0] = {**fields["experience"][0], "responsibilities": "APIs for search"}
    current = profile(summary="Backend developer, Python")
    current["experience"] = [
        {**current["experience"][0], "responsibilities": "APIs and reports"},
        current["experience"][1],
    ]
    changes = master.plan(current, fields, link)
    review = next(c for c in changes if c["section"] == "experience")
    assert review["kind"] == "review" and master.status(changes) == "review"
    kept, new_link = master.apply(current, 2, fields, link, [], [review["id"]])
    assert kept["experience"][0]["responsibilities"] == "APIs for search"
    assert all(c["section"] != "experience" for c in master.plan(current, kept, new_link))


def test_resume_only_edit_is_respected():
    fields, link = built()
    fields["summary"] = "Tailored for the search team"
    assert master.plan(profile(), fields, link) == []


def test_new_profile_facts_are_suggested_with_demand_order():
    fields, link = built({"experience": ["job1"]})
    current = profile(skills=["Python", "SQL", "Docker", "Go"])
    current["experience"] = [
        *current["experience"],
        {"id": "job3", "company": "Bank", "role": "Intern"},
    ]
    changes = master.plan(current, fields, link, demand={"docker": 3})
    new = [c for c in changes if c["kind"] == "new"]
    assert [c["key"] for c in new] == ["docker", "job3", "go"]
    assert new[0]["demand"] == 3
    # Job 2 was deliberately left out when the resume was created, so it is not offered.
    assert all(c["key"] != "job2" for c in changes)
    updated, new_link = master.apply(
        current, 2, fields, link, ["new:skills:docker"], ["new:skills:go"]
    )
    assert updated["skills"] == ["Python", "SQL", "Docker"]
    assert [c["key"] for c in master.plan(current, updated, new_link)] == ["job3"]


def test_deleted_profile_fact_is_offered_for_removal():
    fields, link = built()
    current = profile(awards=[], skills=["Python"])
    changes = master.plan(current, fields, link)
    assert {(c["kind"], c["key"]) for c in changes} == {("removed", "aw1"), ("removed", "sql")}
    updated, new_link = master.apply(
        current, 2, fields, link, ["removed:awards:aw1"], ["removed:skills:sql"]
    )
    assert updated["awards"] == [] and updated["skills"] == ["Python", "SQL"]
    assert master.plan(current, updated, new_link) == []


def test_unlinked_resume_matches_by_content_and_asks_for_review():
    fields = {
        "experience": [{"company": "Library", "role": "Engineer", "responsibilities": "Old text"}],
        "skills": ["Python"],
    }
    changes = master.plan(profile(), fields, None)
    assert [(c["kind"], c["key"]) for c in changes] == [
        ("review", "job1"),
        ("new", "sql"),
    ]
    updated, link = master.apply(profile(), 1, fields, None, ["review:experience:job1"], [])
    assert updated["experience"][0]["id"] == "job1"
    assert [c["key"] for c in master.plan(profile(), updated, link)] == ["sql"]


def test_rewritten_entries_get_their_ids_back():
    source = master.select(profile(), ["experience"])
    composed = {"experience": [{"company": "Cafe", "role": "Barista", "responsibilities": "x"}]}
    assert master.restore_ids(source, composed)["experience"][0]["id"] == "job2"
    invented = {"experience": [{"id": "zzz", "company": "Moon", "role": "Pilot"}]}
    assert master.restore_ids(source, invented)["experience"][0]["id"] == ""


def test_stale_decisions_are_rejected():
    fields, link = built()
    with pytest.raises(Conflict):
        master.apply(profile(), 2, fields, link, ["update:experience:job1"], [])
