"""
Sources routes — list, add (url/youtube/file/text/gdrive), refresh, delete, fulltext
Background polling broadcasts source_status events via ws_manager.
"""
from __future__ import annotations
import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.client import get_client
from services.ws_manager import ws_manager

router = APIRouter(prefix="/notebooks", tags=["sources"])

# ── background polling ────────────────────────────────────────────────────────
# Tracks source IDs that are currently being polled for indexing completion.
_polling: set[str] = set()


async def _poll_source_status(notebook_id: str, source_id: str, client) -> None:
    """Poll a source until it transitions out of 'indexing' state, then broadcast."""
    if source_id in _polling:
        return
    _polling.add(source_id)
    try:
        for _ in range(60):  # max ~5 min (5s * 60)
            await asyncio.sleep(5)
            try:
                src = await client.sources.get(notebook_id, source_id)
                kind = str(getattr(src, "kind", "")) if src else ""
                # notebooklm-py Source doesn't expose an explicit status field;
                # a source that exists and has a title is considered ready.
                title = getattr(src, "title", None)
                if title:
                    await ws_manager.broadcast("source_status", {
                        "notebook_id": notebook_id,
                        "source_id": source_id,
                        "status": "ready",
                    })
                    return
            except Exception:
                pass
        # Timed out — broadcast error
        await ws_manager.broadcast("source_status", {
            "notebook_id": notebook_id,
            "source_id": source_id,
            "status": "error",
        })
    finally:
        _polling.discard(source_id)


def _start_poll(notebook_id: str, source_id: str, client) -> None:
    asyncio.create_task(_poll_source_status(notebook_id, source_id, client))


# ── serialiser ────────────────────────────────────────────────────────────────

def _serialize_source(src, notebook_id: str) -> dict:
    created = None
    try:
        if src.created_at:
            created = src.created_at.isoformat()
    except Exception:
        pass

    # Determine type from kind property
    kind = "url"
    try:
        kind = str(src.kind)
    except Exception:
        pass

    return {
        "id": src.id,
        "notebook_id": notebook_id,
        "type": kind,
        "title": getattr(src, "title", None) or "Untitled source",
        "url": getattr(src, "url", None),
        "filename": None,
        "status": "ready",  # notebooklm-py doesn't expose indexing state; assume ready
        "created_at": created,
    }


# ── request bodies ────────────────────────────────────────────────────────────

class AddUrlBody(BaseModel):
    url: str

class AddTextBody(BaseModel):
    title: str
    content: str

class AddFileBody(BaseModel):
    file_path: str

class AddGdriveBody(BaseModel):
    drive_url: str


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/{notebook_id}/sources")
async def list_sources(notebook_id: str, client=Depends(get_client)):
    try:
        sources = await client.sources.list(notebook_id)
        return [_serialize_source(s, notebook_id) for s in sources]
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sources/url")
async def add_source_url(notebook_id: str, body: AddUrlBody, client=Depends(get_client)):
    try:
        src = await client.sources.add_url(notebook_id, body.url)
        result = _serialize_source(src, notebook_id)
        result["status"] = "indexing"
        _start_poll(notebook_id, src.id, client)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sources/youtube")
async def add_source_youtube(notebook_id: str, body: AddUrlBody, client=Depends(get_client)):
    try:
        # notebooklm-py has no add_youtube — YouTube URLs are handled by add_url
        src = await client.sources.add_url(notebook_id, body.url)
        result = _serialize_source(src, notebook_id)
        result["status"] = "indexing"
        result["type"] = "youtube"
        _start_poll(notebook_id, src.id, client)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sources/file")
async def add_source_file(notebook_id: str, body: AddFileBody, client=Depends(get_client)):
    try:
        file_path = Path(body.file_path).expanduser()
        if not file_path.exists():
            raise HTTPException(status_code=400, detail={"error": "file_not_found", "message": f"File not found: {file_path}"})
        src = await client.sources.add_file(notebook_id, file_path)
        result = _serialize_source(src, notebook_id)
        result["status"] = "indexing"
        result["filename"] = file_path.name
        _start_poll(notebook_id, src.id, client)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sources/text")
async def add_source_text(notebook_id: str, body: AddTextBody, client=Depends(get_client)):
    try:
        src = await client.sources.add_text(notebook_id, body.title, body.content)
        result = _serialize_source(src, notebook_id)
        result["status"] = "indexing"
        _start_poll(notebook_id, src.id, client)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sources/gdrive")
async def add_source_gdrive(notebook_id: str, body: AddGdriveBody, client=Depends(get_client)):
    """
    Accepts a Google Drive share URL and extracts file_id, title, mime_type.
    Supports: docs, sheets, slides, and generic drive files.
    """
    try:
        import re
        url = body.drive_url
        # Extract file ID from various Drive URL formats
        match = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
        if not match:
            match = re.search(r"id=([a-zA-Z0-9_-]+)", url)
        if not match:
            raise HTTPException(status_code=400, detail={"error": "invalid_url", "message": "Could not extract Google Drive file ID from URL"})

        file_id = match.group(1)

        # Determine mime type from URL pattern
        if "docs.google.com/document" in url:
            mime_type = "application/vnd.google-apps.document"
            title = "Google Doc"
        elif "docs.google.com/spreadsheets" in url:
            mime_type = "application/vnd.google-apps.spreadsheet"
            title = "Google Sheet"
        elif "docs.google.com/presentation" in url:
            mime_type = "application/vnd.google-apps.presentation"
            title = "Google Slides"
        else:
            mime_type = "application/octet-stream"
            title = "Google Drive File"

        src = await client.sources.add_drive(notebook_id, file_id, title, mime_type)
        result = _serialize_source(src, notebook_id)
        result["status"] = "indexing"
        _start_poll(notebook_id, src.id, client)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.post("/{notebook_id}/sources/{source_id}/refresh")
async def refresh_source(notebook_id: str, source_id: str, client=Depends(get_client)):
    try:
        await client.sources.refresh(notebook_id, source_id)
        _start_poll(notebook_id, source_id, client)
        return {"status": "ok", "source_id": source_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.delete("/{notebook_id}/sources/{source_id}")
async def delete_source(notebook_id: str, source_id: str, client=Depends(get_client)):
    try:
        await client.sources.delete(notebook_id, source_id)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.get("/{notebook_id}/sources/{source_id}/fulltext")
async def get_source_fulltext(notebook_id: str, source_id: str, client=Depends(get_client)):
    try:
        fulltext = await client.sources.get_fulltext(notebook_id, source_id)
        return {"content": fulltext.content, "char_count": fulltext.char_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})
