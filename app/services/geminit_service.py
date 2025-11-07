import json

from fastapi import HTTPException
from google import genai
from google.cloud import storage
from google.genai import types

from app.config import settings
from app.schemas.gemini_schemas import ResumeSchema, InterviewQuestionList, EvaluationResult, InterviewSummaryResponse

# ===========================================================
# ✅ Единый клиент Gemini Vertex AI
# ===========================================================
client = genai.Client(
    vertexai=True,
    project=settings.PROJECT_ID,  # "gdg-hackathon-aitu"
    location=settings.GCP_LOCATION  # "us-central1"
)

MODEL_NAME = settings.VERTEX_MODEL  # "gemini-1.5-flash"


def build_interview_prompt(messages, correct_answer, current_question):
    conv_text = ""
    for m in messages:
        conv_text += f"{m['role']}: {m['text']}\n"

    return (
            "Ниже полная переписка интервью:\n\n" +
            conv_text +
            "\nТекущий вопрос: " + current_question + "\n"
                                                      "Правильный ответ: " + correct_answer + "\n"
                                                                                              "Оцени ответ пользователя, затем если нужно — задай уточнение.\n"
    )


# ===========================================================
# ✅ Универсальный вызов Gemini
# ===========================================================
def _gemini_call(prompt: str, parts: list = None, config=None) -> str:
    """
    Унифицированный вызов Gemini.
    `parts` — дополнительные данные (PDF, изображения и т.д.)
    """
    print(prompt)

    if config is None:
        config = {}

    contents = [prompt]
    if parts:
        contents.extend(parts)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=config,
        )
    except Exception as e:
        raise HTTPException(500, f"Gemini Vertex error: {e}")

    # Gemini может вернуть кандидатов или одиночный текст
    text = getattr(response, "text", None)

    if not text:
        raise HTTPException(500, f"Gemini returned empty response: {response}")

    return text


# ===========================================================
# ✅ Скачать PDF из Cloud Storage
# ===========================================================
def _download_pdf_from_gcs(gcs_path: str) -> bytes:
    if not gcs_path.startswith("gs://"):
        raise HTTPException(400, "Invalid GCS path")

    _, _, bucket_name, *blob_path = gcs_path.split("/", 3)
    blob_path = blob_path[0]

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_path)

    return blob.download_as_bytes()


# ===========================================================
# ✅ Текст → JSON полей резюме
# ===========================================================
def gemini_extract_resume_fields(text: str) -> dict:
    prompt = f"""
You are a resume extraction engine.

Extract structured resume fields from the text below
and return ONLY valid JSON with schema:

{{
  "full_name": "",
  "email": "",
  "phone": "",
  "summary": "",
  "skills": [],
  "education": [],
  "experience": []
}}

Resume text:
{text}
"""

    response = _gemini_call(prompt)

    try:
        return json.loads(response)
    except:
        raise HTTPException(500, "Invalid JSON from Gemini")


# ===========================================================
# ✅ PDF → JSON полей резюме
# ===========================================================
def gemini_extract_resume_fields_from_pdf(gcs_path: str) -> dict:
    pdf_bytes = _download_pdf_from_gcs(gcs_path)

    prompt = """
Ты — система для структурированной обработки резюме.
Извлеки из PDF следующую структуру (чистый JSON!):

{
  "summary": "",
  "skills": [],
  "experience": [
      {
         "position": "",
         "company": "",
         "start_date": "",
         "end_date": "",
         "description": ""
      }
  ],
  "education": [
      {
         "institution": "",
         "degree": "",
         "start_date": "",
         "end_date": ""
      }
  ],
  "projects": [
      {
         "name": "",
         "description": "",
         "technologies": []
      }
  ]
}

Если данных нет — возвращай пустые строки или пустые массивы.
"""

    response = _gemini_call(
        prompt,
        parts=[
            types.Part.from_bytes(
                mime_type="application/pdf",
                data=pdf_bytes
            )
        ],
        config={
            "response_mime_type": "application/json",
            "response_json_schema": ResumeSchema.model_json_schema(),
        },
    )

    try:
        return json.loads(response)
    except Exception:
        raise HTTPException(500, f"Gemini returned non-JSON: {response}")


# ===========================================================
# ✅ Анализ резюме vs JD
# ===========================================================
def gemini_analyze_resume(fields_verified: dict, jd_text: str, user_profile: dict):
    # Подготовим схему для анализа
    prompt = f"""
   Ты — профессиональная система адаптации резюме.

Профиль пользователя:
{json.dumps(user_profile, ensure_ascii=False)}

Проверенные поля резюме:
{json.dumps(fields_verified, ensure_ascii=False)}

Описание вакансии:
{jd_text}

Твоя задача — предоставить улучшения для резюме на основе описания вакансии. Каждое улучшение должно быть конкретным, связанным с текущими данными резюме пользователя, и направленным на соответствие описанию вакансии. Не добавляй новую информацию, только корректируй уже существующие данные. Ты можешь предложить:

Какие навыки из списка пользователя стоит удалить или заменить, если они не соответствуют вакансии.

Какие навыки стоит добавить из списка пользователя, чтобы соответствовать вакансии (на основе требований).

Какие области опыта или знания стоит углубить или развить для повышения соответствия вакансии.

Как следует переписать раздел резюме (например, summary или job experience), чтобы акцентировать внимание на релевантном опыте.

Каждое улучшение должно быть конкретным и основываться исключительно на уже проверенных данных резюме пользователя. Не добавляй новых навыков или знаний, которых нет в резюме. Максимум 10 улучшений.

Пример улучшений:

Изменить summary, чтобы выделить опыт в машинном обучении, если это требуется вакансией.

Удалить навыки, связанные с Java, если вакансия требует только Python и Go.

Добавить в резюме опыт работы с Kubernetes, если в вакансии это указано как ключевое требование.

Переписать описание опыта работы в последней позиции, чтобы подчеркнуть роль лидера в проекте.

Добавить «SQL» в список навыков, если вакансия требует работы с базами данных.
    """
    print(prompt)

    # Отправляем запрос в Gemini API с использованием схемы
    response = _gemini_call(
        prompt,
        config={
            "response_mime_type": "application/json",
            "response_json_schema": {
                "type": "object",
                "properties": {
                    "improvements": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": ["improvements"]
            }
        }
    )

    try:
        # Парсим JSON ответ от Gemini
        data = json.loads(response)
        improvements = data["improvements"]
        return improvements
    except Exception as e:
        print(f"Error processing Gemini response: {e}")
        raise HTTPException(500, "Invalid JSON from Gemini (analyze)")


# ===========================================================
# ✅ Генерация HTML-резюме
# ===========================================================
def gemini_generate_html(fields, advices, jd):
    prompt = f"""
Generate resume HTML. You have to create full HTML page with styles (<style> tag) and sections.


FIELDS (JSON):
{json.dumps(fields, ensure_ascii=False)}

improvments:
{json.dumps(advices, ensure_ascii=False)}

Job description:
{json.dumps(jd, ensure_ascii=False)}

RULES:
- Replace placeholders like [FULL_NAME], [SUMMARY_HTML], [SKILLS_HTML]
- Only output final HTML
- No extra text
- Follow received Advices for improving CV
"""

    html = _gemini_call(prompt)
    html = html.replace("```html", "", 1)
    html = html.replace("```", "", 1)
    return html


def build_first_question_prompt(data):
    return f"""
Ты — технический интервьюер.
Сформируй первый вопрос интервью.

Компания: {data["company_description"]}
Вакансия: {data["job_description"]}
Стек: {data["tech_stack"]}
Стиль: {data["style"]}

Выведи строго JSON:
{{ "question": "..." }}
"""


def build_interview_prompt(data, new_user_answer=None):
    conv = data.get("conversation", [])

    prompt = f"""
Ты — технический интервьюер компании.
Компания: {data["company_description"]}
Вакансия: {data["job_description"]}
Стек: {data["tech_stack"]}
Стиль интервью: {data["style"]}

История диалога до текущего момента:
"""

    if len(conv) == 0:
        prompt += "Пока вопросов и ответов не было.\n"
    else:
        for turn in conv:
            prompt += f"""
Вопрос: {turn["question"]}
Ответ кандидата: {turn["answer"]}
Оценка: {turn["result"]}
"""

    if new_user_answer:
        prompt += f"""

Текущий вопрос: {data["current_question"]}
Ответ кандидата: {new_user_answer}

Твоя задача:
1. Оценить ответ: correct / partial / wrong  
2. Дать короткое объяснение  
3. Если partial — задать уточняющий follow-up вопрос  
4. Если wrong — выдать следующий вопрос  
5. Ответить строго в JSON:

{{
  "result": "...",
  "feedback": "...",
  "follow_up_question": "..." | null,
  "next_question": "..." | null
}}
"""

    return prompt


def generate_interview_questions(company, job, stack, style):
    prompt = f"""
Ты — технический интервьюер.

Сгенерируй список вопросов для технического интервью.
Для каждого вопроса сформируй:
- полную формулировку вопроса
- корректный эталонный ответ

Стиль интервью: {style}
Компания: {company}
Вакансия: {job}
Технологический стек: {stack}

Верни JSON строго по схеме.
    """

    schema = InterviewQuestionList.model_json_schema()

    text = _gemini_call(
        prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": schema
        }
    )

    data = InterviewQuestionList.model_validate_json(text)
    return data.items


def evaluate_with_llm(messages: list, correct_answer: str, current_question: str, user_answer: str):
    """
    messages — вся история переписки в формате:
    [
        {"role": "user", "text": "..."},
        {"role": "assistant", "text": "..."},
        ...
    ]
    """

    # ✅ Формируем текст переписки
    conversation_text = ""
    for m in messages:
        r = "Пользователь" if m["role"] == "user" else "Интервьюер"
        conversation_text += f"{r}: {m['text']}\n"

    # ✅ Новый промпт: полный контекст + текущий вопрос
    prompt = f"""
Ты — строгий технический интервьюер. Ниже приведена полная история диалога.

История интервью:
{conversation_text}

Текущий вопрос (который нужно оценить):
{current_question}

Правильный ответ:
{correct_answer}

Ответ кандидата на этот вопрос:
{user_answer}

Определи строго по реальному ответу:
1. Насколько ответ правильный: correct / partial / wrong
2. Короткое объяснение ошибки или успеха
3. Если partial — задай один уточняющий follow-up вопрос
4. Если wrong — предложи следующий вопрос
5. Ответ строго в JSON:

{{
  "result": "correct | partial | wrong",
  "feedback": "краткое объяснение",
  "follow_up_question": "..." | null,
  "next_question": "..." | null
}}
"""

    schema = EvaluationResult.model_json_schema()

    text = _gemini_call(
        prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": schema
        }
    )

    return EvaluationResult.model_validate_json(text)


def generate_interview_summary(dialog_text: str) -> InterviewSummaryResponse:
    """
    Принимает текст всего интервью и возвращает структурированный JSON-summary.
    """

    prompt = f"""
Ты — опытный технический интервьюер.

Проанализируй весь диалог технического интервью:

{dialog_text}

Требования:
1. Дай общую характеристику кандидата
2. Укажи сильные стороны
3. Определи слабые места
4. Дай рекомендации для роста
5. Предположи уровень (Junior/Middle/Senior)
6. Верни строго JSON по схеме
"""

    schema = InterviewSummaryResponse.model_json_schema()

    result = _gemini_call(
        prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": schema
        }
    )

    return InterviewSummaryResponse.model_validate_json(result)
