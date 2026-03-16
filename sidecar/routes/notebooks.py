"""
Notebook routes — list, create, rename, delete, pin
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.client import get_client

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


class CreateNotebookBody(BaseModel):
    title: str
    emoji: str | None = None


class RenameNotebookBody(BaseModel):
    title: str


class PinNotebookBody(BaseModel):
    pinned: bool


@router.get("")
async def list_notebooks(client=Depends(get_client)):
    try:
        notebooks = await client.notebooks.list()
        return [_serialize(nb) for nb in notebooks]
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("")
async def create_notebook(body: CreateNotebookBody, client=Depends(get_client)):
    try:
        title = body.title.strip() or "Untitled notebook"
        nb = await client.notebooks.create(title)
        return _serialize(nb)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.put("/{notebook_id}/rename")
async def rename_notebook(notebook_id: str, body: RenameNotebookBody, client=Depends(get_client)):
    try:
        nb = await client.notebooks.rename(notebook_id, body.title.strip())
        return _serialize(nb)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.delete("/{notebook_id}")
async def delete_notebook(notebook_id: str, client=Depends(get_client)):
    try:
        await client.notebooks.delete(notebook_id)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


# notebooklm-py doesn't expose a pin API — we track pin state locally in memory.
# A real implementation would persist to SQLite; for now an in-process set is fine.
_pinned: set[str] = set()


@router.put("/{notebook_id}/pin")
async def pin_notebook(notebook_id: str, body: PinNotebookBody):
    if body.pinned:
        _pinned.add(notebook_id)
    else:
        _pinned.discard(notebook_id)
    return {"status": "ok", "pinned": notebook_id in _pinned}


def _serialize(nb) -> dict:
    """Convert a notebooklm-py Notebook dataclass to a JSON-safe dict."""
    created = None
    updated = None
    try:
        if nb.created_at:
            created = nb.created_at.isoformat()
    except Exception:
        pass
    # notebooklm-py Notebook has no updated_at; use created_at as fallback
    updated = created

    return {
        "id": nb.id,
        "title": nb.title or "Untitled notebook",
        "emoji": None,  # notebooklm-py doesn't expose emoji
        "created_at": created,
        "updated_at": updated,
        "source_count": getattr(nb, "sources_count", 0),
        "is_pinned": nb.id in _pinned,
    }
