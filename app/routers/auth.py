from fastapi import APIRouter, HTTPException, Header
from firebase_admin import auth as firebase_auth
from app.firebase import verify_token
from app.services.firestore_service import get_doc, set_doc

router = APIRouter(prefix="/auth", tags=["Auth"])

# --------------------------------------------------
# 1. Регистрация (через Firebase)
# --------------------------------------------------

@router.post("/register")
def register_user(email: str, password: str, full_name: str = ""):
    """
    Регистрирует пользователя в Firebase Auth.
    Возвращает uid и email.
    """
    try:
        user = firebase_auth.create_user(
            email=email,
            password=password,
            display_name=full_name
        )
        return {"uid": user.uid, "email": user.email}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --------------------------------------------------
# 2. Логин — делает фронтенд через Firebase SDK
# --------------------------------------------------
# Бэкенд принимает только idToken


@router.get("/me")
def get_current_user(authorization: str = Header(...)):
    """
    Проверка токена Firebase и возврат данных профиля.
    """
    id_token = authorization.replace("Bearer ", "")
    uid = verify_token(id_token)

    # ищем профиль в Firestore
    profile = get_doc("users", uid)

    if not profile:
        # создаём пустой профиль
        profile = {
            "full_name": "",
            "email": firebase_auth.get_user(uid).email,
            "avatar_url": "",
            "skills": [],
            "profession_goal": "",
            "experience_level": ""
        }
        set_doc("users", uid, profile)

    return {"uid": uid, "profile": profile}
