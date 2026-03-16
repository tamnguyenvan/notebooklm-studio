"""
Module 9 — Sharing
GET  /notebooks/{id}/sharing          → get share status
POST /notebooks/{id}/sharing/public   → set public on/off
POST /notebooks/{id}/sharing/users    → add/update user
DEL  /notebooks/{id}/sharing/users/{email} → remove user
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.client import get_client

router = APIRouter(prefix="/notebooks", tags=["sharing"])


# ── models ────────────────────────────────────────────────────────────────────

class SetPublicBody(BaseModel):
    public: bool


class AddUserBody(BaseModel):
    email: str
    permission: str = "viewer"   # "viewer" | "editor"
    notify: bool = True
    welcome_message: str = ""


# ── helpers ───────────────────────────────────────────────────────────────────

def _status_to_dict(status) -> dict:
    users = []
    if hasattr(status, "shared_users") and status.shared_users:
        for u in status.shared_users:
            users.append({
                "email": u.email if hasattr(u, "email") else str(u),
                "permission": str(u.permission) if hasattr(u, "permission") else "viewer",
            })
    return {
        "is_public": bool(status.is_public) if hasattr(status, "is_public") else False,
        "share_url": status.share_url if hasattr(status, "share_url") else None,
        "shared_users": users,
    }


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/{notebook_id}/sharing")
async def get_sharing_status(notebook_id: str, client=Depends(get_client)):
    try:
        status = await client.sharing.get_status(notebook_id)
        return _status_to_dict(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sharing/public")
async def set_public(notebook_id: str, body: SetPublicBody, client=Depends(get_client)):
    try:
        status = await client.sharing.set_public(notebook_id, body.public)
        return _status_to_dict(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sharing/users")
async def add_user(notebook_id: str, body: AddUserBody, client=Depends(get_client)):
    try:
        from notebooklm import SharePermission
        perm = SharePermission.EDITOR if body.permission == "editor" else SharePermission.VIEWER
        status = await client.sharing.add_user(
            notebook_id,
            body.email,
            perm,
            notify=body.notify,
            welcome_message=body.welcome_message,
        )
        return _status_to_dict(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.delete("/{notebook_id}/sharing/users/{email}")
async def remove_user(notebook_id: str, email: str, client=Depends(get_client)):
    try:
        # email may be URL-encoded
        from urllib.parse import unquote
        decoded_email = unquote(email)
        status = await client.sharing.remove_user(notebook_id, decoded_email)
        return _status_to_dict(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})
