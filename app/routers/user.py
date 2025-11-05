from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

from app.schemas.user import UserProfile
from app.services.firestore_service import get_doc, set_doc

router = APIRouter(prefix="/user", tags=["User"])
security = HTTPBearer()


# ---------------------------
# Auth helper
# ---------------------------
def get_uid(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# ---------------------------
# Get current user basic info
# ---------------------------
@router.get("/me")
def get_me(uid: str = Depends(get_uid)):
    return {"uid": uid}


# ---------------------------
# Full profile load
# ---------------------------
@router.get("/profile")
def get_profile(uid: str = Depends(get_uid)):
    profile = get_doc("users", uid)
    if not profile:
        profile = {}
    return profile


# ---------------------------
# Update full profile (partial OK)
# ---------------------------
@router.post("/profile/update")
def update_profile(profile: UserProfile, uid: str = Depends(get_uid)):
    set_doc("users", uid, profile.model_dump(exclude_none=True))
    return {"status": "ok", "uid": uid}
