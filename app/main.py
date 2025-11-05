from fastapi import FastAPI
from app.routers import auth, profile, plan, resume, jd, interview, progress, admin, media
from app.utils.error_handler import add_exception_handlers

app = FastAPI(
    title="CareerBot AI Backend",
    version="0.1.0",
    description="API для CareerBot AI (FastAPI + Google Cloud)",
)

# Подключаем роутеры
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(profile.router, prefix="/profile", tags=["Profile"])
app.include_router(plan.router, prefix="/plan", tags=["Plan"])
app.include_router(resume.router, prefix="/resume", tags=["Resume"])
app.include_router(jd.router, prefix="/jd", tags=["Job Description"])
app.include_router(interview.router, prefix="/interview", tags=["Interview"])
app.include_router(progress.router, prefix="/progress", tags=["Progress"])
app.include_router(media.router, prefix="/media", tags=["Media"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

add_exception_handlers(app)
