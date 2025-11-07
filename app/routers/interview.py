import uuid

from fastapi import APIRouter, HTTPException
from google.cloud import firestore

from app.schemas.gemini_schemas import InterviewStartRequest
from app.services.geminit_service import generate_interview_questions

router = APIRouter(prefix="/interview", tags=["Interview"])


@router.post("/start")
def start_interview(payload: InterviewStartRequest):
    db = firestore.Client()

    # Запрашиваем список вопросов у Gemini
    questions = generate_interview_questions(
        company=payload.company_description,
        job=payload.job_description,
        stack=payload.tech_stack,
        style=payload.style
    )

    if not questions:
        raise HTTPException(500, "Gemini did not return any questions")

    session_id = str(uuid.uuid4())

    doc = {
        "company_description": payload.company_description,
        "job_description": payload.job_description,
        "tech_stack": payload.tech_stack,
        "style": payload.style,
        "questions": [q.dict() for q in questions],  # list of {"question", "answer"}
        "current_index": 0,
        "score": 0,
        "finished": False
    }

    db.collection("interviews").document(session_id).set(doc)

    return {
        "session_id": session_id,
        "question": questions[0].question,
        "total_questions": len(questions)
    }


@router.post("/{session_id}/answer")
def answer_question(session_id: str):
    db = firestore.Client()
    ref = db.collection("interviews").document(session_id)
    snap = ref.get()

    if not snap.exists:
        raise HTTPException(404, "Session not found")

    data = snap.to_dict()

    if data["finished"]:
        return {"finished": True}

    index = data["current_index"]
    question_obj = data["questions"][index]

    correct_answer = question_obj["answer"]

    # Переходим к следующему вопросу
    index += 1

    # Если вопросов больше нет → конец
    if index >= len(data["questions"]):
        data["finished"] = True
        ref.set(data)
        return {
            "finished": True,
            "correct_answer": correct_answer,
            "next_question": None
        }

    # Обновляем индекс
    data["current_index"] = index
    ref.set(data)

    next_question = data["questions"][index]["question"]

    return {
        "finished": False,
        "correct_answer": correct_answer,
        "next_question": next_question
    }
