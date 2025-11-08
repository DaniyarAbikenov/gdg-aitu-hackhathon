import uuid

from fastapi import APIRouter, HTTPException
from google.cloud import firestore

from app.schemas.gemini_schemas import InterviewStartRequest, InterviewAnswerRequest, InterviewSummaryResponse
from app.services.geminit_service import generate_interview_questions, evaluate_with_llm, generate_interview_summary

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
def answer_question(session_id: str, payload: InterviewAnswerRequest):
    db = firestore.Client()
    ref = db.collection("interviews").document(session_id)
    snap = ref.get()

    if not snap.exists:
        raise HTTPException(404, "Session not found")

    data = snap.to_dict()

    if data.get("finished"):
        return {"finished": True}

    index = data["current_index"]
    question_obj = data["questions"][index]

    correct_answer = question_obj["answer"]
    current_question = question_obj["question"]
    user_answer = payload.answer

    # ✅ История переписки (единый формат)
    messages = data.get("messages", [])

    # ✅ Добавляем ответ пользователя
    messages.append({
        "role": "user",
        "text": user_answer
    })

    # ✅ Строим LLM-контекст (вся переписка + текущий вопрос)

    # ✅ LLM-оценка
    llm_eval = evaluate_with_llm(
        messages=messages,  # полный контекст
        correct_answer=correct_answer,
        current_question=current_question,
        user_answer=user_answer
    )

    result = llm_eval.result

    # ✅ Добавляем ответ ассистента (feedback)
    messages.append({
        "role": "assistant",
        "text": llm_eval.feedback
    })

    # ✅ Сохраняем историю
    data["messages"] = messages

    # ===========================
    # CASE 1: CORRECT
    # ===========================
    if result == "correct":
        data["score"] += 1
        index += 1

        # Перешли конец
        if index >= len(data["questions"]):
            data["finished"] = True
            ref.set(data)
            return {
                "finished": True,
                "feedback": llm_eval.feedback,
                "follow_up": None,
                "next_question": None
            }

        next_question = data["questions"][index]["question"]
        data["current_index"] = index
        ref.set(data)
        messages.append({
            "role": "assistant",
            "text": next_question
        })
        return {
            "finished": False,
            "feedback": llm_eval.feedback,
            "follow_up": None,
            "next_question": next_question
        }

    # ===========================
    # CASE 2: PARTIAL
    # ===========================
    if result == "partial":
        # Assisstant follow-up question → также сохраняем!
        messages.append({
            "role": "assistant",
            "text": llm_eval.follow_up_question
        })

        data["messages"] = messages
        ref.set(data)

        return {
            "finished": False,
            "feedback": llm_eval.feedback,
            "follow_up": llm_eval.follow_up_question,
            "next_question": None
        }

    # ===========================
    # CASE 3: WRONG
    # ===========================
    if result == "wrong":
        index += 1
        if index >= len(data["questions"]):
            data["finished"] = True
            ref.set(data)
            return {
                "finished": True,
                "feedback": llm_eval.feedback,
                "follow_up": None,
                "next_question": None
            }
        next_question = data["questions"][index]["question"]
        messages.append({
            "role": "assistant",
            "text": next_question
        })
        data["current_index"] = index
        ref.set(data)

        return {
            "finished": False,
            "feedback": llm_eval.feedback,
            "follow_up": None,
            "next_question": next_question
        }


@router.post("/{session_id}/summary")
def interview_summary(session_id: str):
    db = firestore.Client()
    ref = db.collection("interviews").document(session_id)
    snap = ref.get()

    if not snap.exists:
        raise HTTPException(404, "Session not found")

    data = snap.to_dict()
    conversation = data.get("messages", [])

    if not conversation:
        raise HTTPException(400, "Conversation is empty")

    # ✅ Формируем текст диалога
    conversation_text = ""
    for m in conversation:
        r = "Пользователь" if m["role"] == "user" else "Интервьюер"
        conversation_text += f"{r}: {m['text']}\n"

    # ✅ Генерируем summary через отдельный сервис
    summary: InterviewSummaryResponse = generate_interview_summary(conversation_text)

    return {
        "correct": data.get("score", 0),
        "wrong": data.get("current_index", 0) - data.get("score", 0),
        "summary": summary
    }
