"""
Module 7 — Research
POST /notebooks/{id}/research         → start research (returns task_id)
GET  /notebooks/{id}/research/results → poll latest research results
POST /notebooks/{id}/research/{rid}/import → import a single result as source
POST /notebooks/{id}/research/import-many  → import multiple results as sources
"""
from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.client import get_client
from services.task_runner import task_runner
from services.ws_manager import ws_manager

router = APIRouter()

# ── in-memory store for latest research results per notebook ─────────────────
# { notebook_id: {"task_id": str, "status": str, "query": str, "sources": [...], "summary": str} }
_research_cache: dict[str, dict] = {}


# ── request / response models ─────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    query: str
    mode: Literal["web", "drive"] = "web"
    depth: Literal["fast", "deep"] = "fast"


class ImportRequest(BaseModel):
    url: str
    title: str


class ImportManyRequest(BaseModel):
    sources: list[ImportRequest]


# ── helpers ───────────────────────────────────────────────────────────────────

def _source_to_dict(src) -> dict:
    """Convert a notebooklm Source object to a plain dict."""
    return {
        "id": src.id,
        "title": src.title or "",
        "url": src.url or None,
        "type": str(src.kind) if hasattr(src, "kind") else "url",
        "status": "ready",
        "notebook_id": "",  # filled by caller
        "created_at": src.created_at.isoformat() if src.created_at else None,
        "filename": None,
    }


def _result_to_dict(r: dict) -> dict:
    """Normalise a research result dict from the API."""
    return {
        "url": r.get("url", ""),
        "title": r.get("title", r.get("url", "")),
        "domain": _extract_domain(r.get("url", "")),
        "snippet": r.get("snippet", ""),
    }


def _extract_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.lstrip("www.") or url
    except Exception:
        return url


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/notebooks/{notebook_id}/research")
async def start_research(
    notebook_id: str,
    body: ResearchRequest,
    client=Depends(get_client),
):
    """
    Start a research task. Returns {task_id} immediately.
    Progress is broadcast via WS task_progress / task_complete / task_error.
    Results are cached in _research_cache[notebook_id] on completion.
    """
    # Validate mode/depth combination
    if body.mode == "drive" and body.depth == "deep":
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_params", "message": "Drive search only supports 'fast' depth."},
        )

    async def _do(runner, task_id: str):
        await runner.update_progress(task_id, 5, "Starting research…")

        # Start research on the API
        result = await client.research.start(
            notebook_id,
            query=body.query,
            source=body.mode,
            mode=body.depth,
        )
        api_task_id = result.get("task_id", "")

        await runner.update_progress(task_id, 20, "Searching…")

        # Poll until complete (max ~3 min, 10s intervals)
        max_polls = 18
        for i in range(max_polls):
            await asyncio.sleep(10)
            status = await client.research.poll(notebook_id)
            poll_status = status.get("status", "in_progress")

            progress = 20 + int((i + 1) / max_polls * 70)
            await runner.update_progress(task_id, progress, "Searching…")

            if poll_status == "completed":
                sources = status.get("sources", [])
                summary = status.get("summary", "")
                _research_cache[notebook_id] = {
                    "task_id": api_task_id,
                    "status": "completed",
                    "query": body.query,
                    "sources": [_result_to_dict(s) for s in sources],
                    "summary": summary,
                }
                await runner.update_progress(task_id, 95, "Done")
                return {
                    "artifact_type": "research",
                    "notebook_id": notebook_id,
                    "result_count": len(sources),
                }

            if poll_status == "no_research":
                # Research was reset or not started — treat as empty
                _research_cache[notebook_id] = {
                    "task_id": api_task_id,
                    "status": "completed",
                    "query": body.query,
                    "sources": [],
                    "summary": "",
                }
                return {"artifact_type": "research", "notebook_id": notebook_id, "result_count": 0}

        # Timed out — return whatever we have
        last = await client.research.poll(notebook_id)
        sources = last.get("sources", [])
        _research_cache[notebook_id] = {
            "task_id": api_task_id,
            "status": "completed",
            "query": body.query,
            "sources": [_result_to_dict(s) for s in sources],
            "summary": last.get("summary", ""),
        }
        return {
            "artifact_type": "research",
            "notebook_id": notebook_id,
            "result_count": len(sources),
        }

    task_id = await task_runner.run(notebook_id, "research", _do)
    return {"task_id": task_id}


@router.get("/notebooks/{notebook_id}/research/results")
async def get_research_results(notebook_id: str):
    """
    Return the latest cached research results for this notebook.
    Returns empty results if no research has been run yet.
    """
    cached = _research_cache.get(notebook_id)
    if not cached:
        return {
            "task_id": None,
            "status": "no_research",
            "query": "",
            "sources": [],
            "summary": "",
        }
    return cached


@router.post("/notebooks/{notebook_id}/research/{result_url:path}/import")
async def import_research_result(
    notebook_id: str,
    result_url: str,
    client=Depends(get_client),
):
    """
    Import a single research result URL as a source in the notebook.
    """
    cached = _research_cache.get(notebook_id)
    if not cached:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "No research results found. Run a search first."},
        )

    # Find the result in cache
    result = next(
        (s for s in cached.get("sources", []) if s.get("url") == result_url),
        None,
    )
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Result not found in current research results."},
        )

    try:
        # Get the task_id from cache to pass to import_sources
        api_task_id = cached.get("task_id", "")
        imported = await client.research.import_sources(
            notebook_id,
            api_task_id,
            [{"url": result["url"], "title": result["title"]}],
        )
        if imported:
            src = imported[0]
            return {
                "id": src.get("id", ""),
                "title": src.get("title", result["title"]),
                "url": result["url"],
                "type": "url",
                "status": "indexing",
                "notebook_id": notebook_id,
                "created_at": None,
                "filename": None,
            }
        raise HTTPException(status_code=500, detail={"error": "import_failed", "message": "Import returned no results."})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "import_failed", "message": str(e)})


@router.post("/notebooks/{notebook_id}/research/import-many")
async def import_many_research_results(
    notebook_id: str,
    body: ImportManyRequest,
    client=Depends(get_client),
):
    """
    Import multiple research results as sources.
    Returns list of imported sources (partial success is allowed).
    """
    cached = _research_cache.get(notebook_id)
    if not cached:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "No research results found. Run a search first."},
        )

    api_task_id = cached.get("task_id", "")
    sources_to_import = [{"url": s.url, "title": s.title} for s in body.sources]

    try:
        imported = await client.research.import_sources(notebook_id, api_task_id, sources_to_import)
        return {
            "imported": [
                {
                    "id": src.get("id", ""),
                    "title": src.get("title", ""),
                    "url": src.get("url", ""),
                    "type": "url",
                    "status": "indexing",
                    "notebook_id": notebook_id,
                    "created_at": None,
                    "filename": None,
                }
                for src in imported
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "import_failed", "message": str(e)})
