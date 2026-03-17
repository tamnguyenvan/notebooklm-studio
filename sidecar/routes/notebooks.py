"""
Notebook routes — list, create, rename, delete, pin
"""
from __future__ import annotations
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.client import get_client

router = APIRouter(prefix="/notebooks", tags=["notebooks"])

# ── Pin state persistence ─────────────────────────────────────────────────────
# Stored in the same directory as this file so it survives sidecar restarts.
_PIN_FILE = Path(__file__).parent.parent / "data" / "pinned.json"

def _load_pinned() -> dict[str, int]:
    """Returns {notebook_id: pin_timestamp} — higher = pinned later = shown first."""
    try:
        _PIN_FILE.parent.mkdir(parents=True, exist_ok=True)
        if _PIN_FILE.exists():
            return json.loads(_PIN_FILE.read_text())
    except Exception:
        pass
    return {}

def _save_pinned(data: dict[str, int]) -> None:
    try:
        _PIN_FILE.parent.mkdir(parents=True, exist_ok=True)
        _PIN_FILE.write_text(json.dumps(data))
    except Exception:
        pass

_pinned: dict[str, int] = _load_pinned()


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
        # Clean up pin state
        if notebook_id in _pinned:
            del _pinned[notebook_id]
            _save_pinned(_pinned)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.put("/{notebook_id}/pin")
async def pin_notebook(notebook_id: str, body: PinNotebookBody):
    import time
    if body.pinned:
        _pinned[notebook_id] = int(time.time() * 1000)  # ms timestamp
    else:
        _pinned.pop(notebook_id, None)
    _save_pinned(_pinned)
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
    updated = created

    return {
        "id": nb.id,
        "title": nb.title or "Untitled notebook",
        "emoji": None,
        "created_at": created,
        "updated_at": updated,
        "source_count": getattr(nb, "sources_count", 0),
        "is_pinned": nb.id in _pinned,
        "pin_order": _pinned.get(nb.id, 0),  # frontend uses this for ordering
    }
