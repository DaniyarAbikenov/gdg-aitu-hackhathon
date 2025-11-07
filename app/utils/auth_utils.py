from fastapi import Request, HTTPException
from firebase_admin import auth, credentials

cred = credentials.ApplicationDefault()


async def verify_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = auth_header.split("Bearer ")[1]
    try:
        decoded = auth.verify_id_token(token)
        request.state.user = decoded
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
