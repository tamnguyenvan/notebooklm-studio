"""
Module 8 — Notes
GET  /notebooks/{id}/notes
POST /notebooks/{id}/notes
PUT  /notebooks/{id}/notes/{nid}
DEL  /notebooks/{id}/notes/{nid}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.client import get_client

router = APIRouter(prefix="/notebooks", tags=["notes"])


# ── models ────────────────────────────────────────────────────────────────────

class CreateNoteBody(BaseModel):
    title: str = "New Note"
    content: str = ""


class UpdateNoteBody(BaseModel):
    title: str
    content: str


# ── helpers ───────────────────────────────────────────────────────────────────

def _note_to_dict(note) -> dict:
    return {
        "id": note.id,
        "title": note.title or "Untitled",
        "content": note.content or "",
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if hasattr(note, "updated_at") and note.updated_at else None,
    }


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/{notebook_id}/notes")
async def list_notes(notebook_id: str, client=Depends(get_client)):
    try:
        notes = await client.notes.list(notebook_id)
        return [_note_to_dict(n) for n in notes]
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/notes")
async def create_note(notebook_id: str, body: CreateNoteBody, client=Depends(get_client)):
    try:
        note = await client.notes.create(notebook_id, title=body.title, content=body.content)
        return _note_to_dict(note)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.put("/{notebook_id}/notes/{note_id}")
async def update_note(notebook_id: str, note_id: str, body: UpdateNoteBody, client=Depends(get_client)):
    try:
        await client.notes.update(notebook_id, note_id, content=body.content, title=body.title)
        # Fetch the updated note to return current state
        note = await client.notes.get(notebook_id, note_id)
        if note is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Note not found"})
        return _note_to_dict(note)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.delete("/{notebook_id}/notes/{note_id}")
async def delete_note(notebook_id: str, note_id: str, client=Depends(get_client)):
    try:
        await client.notes.delete(notebook_id, note_id)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})
