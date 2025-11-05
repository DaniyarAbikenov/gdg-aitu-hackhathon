from google import genai
from app.config import settings

client = genai.Client(api_key=settings.GOOGLE_API_KEY)

def ask_gemini(prompt: str, model=settings.AI_MODEL):
    resp = client.models.generate_content(
        model=model,
        contents=prompt
    )
    return resp.text
