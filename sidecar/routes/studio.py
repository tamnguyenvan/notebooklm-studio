"""
Studio routes — artifact generation, listing, data retrieval, streaming, download.
"""
from __future__ import annotations
import asyncio
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.client import get_client
from services.task_runner import task_runner

router = APIRouter(tags=["studio"])


# ── Request models ────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    type: str
    config: dict[str, Any] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

# Map API ArtifactType enum strings → frontend type keys
_API_TYPE_MAP = {
    "slide_deck":  "slides",
    "audio":       "audio",
    "video":       "video",
    "report":      "report",
    "quiz":        "quiz",
    "flashcards":  "flashcards",
    "mind_map":    "mind_map",
    "infographic": "infographic",
    "data_table":  "data_table",
}


class _MindMapArtifact:
    """Synthetic artifact object for mind maps (stored as notes in the API)."""
    def __init__(self, note_id: str):
        self.id = note_id
        self.title = "Mind Map"
        self.is_completed = True
        self.created_at = None
        self.url = None

    @property
    def kind(self):
        class _K:
            value = "mind_map"
        return _K()


def _artifact_to_dict(art) -> dict:
    # art.kind is a str-enum — .value gives the raw string e.g. "slide_deck", "flashcards"
    kind = art.kind
    raw_kind = kind.value if hasattr(kind, "value") else str(kind)
    return {
        "id": art.id,
        "title": art.title,
        "type": _API_TYPE_MAP.get(raw_kind, raw_kind),
        "status": "ready" if getattr(art, "is_completed", False) else "generating",
        "created_at": art.created_at.isoformat() if getattr(art, "created_at", None) else None,
        "url": getattr(art, "url", None),
    }


def _check_cancelled(task_id: str):
    task = task_runner.get_task(task_id)
    if task and task.get("status") == "cancelled":
        raise asyncio.CancelledError("Task cancelled by user")


# ── List artifacts ────────────────────────────────────────────────────────────

async def _list_all_artifacts(client, notebook_id: str) -> list:
    """
    Fetch artifacts using all type-specific list methods and merge.
    The generic list() may miss some types (quiz, flashcards, etc.),
    so we call each dedicated method and deduplicate by artifact id.
    """
    seen_ids: set[str] = set()
    results: list = []

    async def _fetch(coro):
        try:
            items = await coro
            for a in (items or []):
                aid = getattr(a, "id", None)
                if aid and aid not in seen_ids:
                    seen_ids.add(aid)
                    results.append(a)
        except Exception:
            pass  # individual type failures shouldn't break the whole list

    # Generic list first (covers audio, video, slides, infographic, report, data_table, mind_map)
    await _fetch(client.artifacts.list(notebook_id))

    # Type-specific lists for types that may not appear in the generic list
    await _fetch(client.artifacts.list_quizzes(notebook_id))
    await _fetch(client.artifacts.list_flashcards(notebook_id))
    await _fetch(client.artifacts.list_audio(notebook_id))
    await _fetch(client.artifacts.list_video(notebook_id))
    await _fetch(client.artifacts.list_reports(notebook_id))
    await _fetch(client.artifacts.list_infographics(notebook_id))
    await _fetch(client.artifacts.list_slide_decks(notebook_id))
    await _fetch(client.artifacts.list_data_tables(notebook_id))

    # Mind maps are stored as notes, not artifacts — check notes API
    try:
        mind_maps = await client.notes.list_mind_maps(notebook_id)
        for mm in (mind_maps or []):
            # mm[0] is the mind map ID per the docs
            mm_id = mm[0] if isinstance(mm, (list, tuple)) else getattr(mm, "id", None)
            if mm_id and mm_id not in seen_ids:
                seen_ids.add(mm_id)
                # Synthesize a fake artifact-like object
                results.append(_MindMapArtifact(mm_id))
    except Exception:
        pass

    return results


@router.get("/notebooks/{notebook_id}/artifacts")
async def list_artifacts(notebook_id: str, client=Depends(get_client)):
    try:
        artifacts = await _list_all_artifacts(client, notebook_id)
        return [_artifact_to_dict(a) for a in artifacts]
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post("/notebooks/{notebook_id}/generate")
async def generate(notebook_id: str, body: GenerateRequest, client=Depends(get_client)):
    artifact_type = body.type
    config = body.config

    async def _do(runner: Any, task_id: str):
        _check_cancelled(task_id)
        await runner.update_progress(task_id, 5, "Starting…")

        # source_ids — None means "all sources"
        source_ids: list[str] | None = config.get("source_ids") or None

        try:
            if artifact_type == "audio":
                from notebooklm import AudioFormat, AudioLength
                fmt_map = {
                    "deep_dive": AudioFormat.DEEP_DIVE,
                    "brief":     AudioFormat.BRIEF,
                    "critique":  AudioFormat.CRITIQUE,
                    "debate":    AudioFormat.DEBATE,
                }
                len_map = {
                    "short":  AudioLength.SHORT,
                    "medium": AudioLength.DEFAULT,
                    "long":   AudioLength.LONG,
                }
                status = await client.artifacts.generate_audio(
                    notebook_id,
                    audio_format=fmt_map.get(config.get("format", "deep_dive"), AudioFormat.DEEP_DIVE),
                    audio_length=len_map.get(config.get("length", "medium"), AudioLength.DEFAULT),
                    language=config.get("language", "en"),
                    instructions=config.get("instructions") or None,
                    source_ids=source_ids,
                )

            elif artifact_type == "video":
                from notebooklm import VideoFormat, VideoStyle
                fmt_map = {
                    "standard": VideoFormat.EXPLAINER,
                    "shorts":   VideoFormat.BRIEF,
                }
                style_map = {
                    "auto":        VideoStyle.AUTO_SELECT,
                    "classic":     VideoStyle.CLASSIC,
                    "whiteboard":  VideoStyle.WHITEBOARD,
                    "kawaii":      VideoStyle.KAWAII,
                    "anime":       VideoStyle.ANIME,
                    "watercolor":  VideoStyle.WATERCOLOR,
                    "retro":       VideoStyle.RETRO_PRINT,
                    "heritage":    VideoStyle.HERITAGE,
                    "paper_craft": VideoStyle.PAPER_CRAFT,
                }
                status = await client.artifacts.generate_video(
                    notebook_id,
                    video_format=fmt_map.get(config.get("format", "standard"), VideoFormat.EXPLAINER),
                    video_style=style_map.get(config.get("style", "auto"), VideoStyle.AUTO_SELECT),
                    language=config.get("language", "en"),
                    instructions=config.get("instructions") or None,
                    source_ids=source_ids,
                )

            elif artifact_type == "slides":
                from notebooklm import SlideDeckFormat, SlideDeckLength
                fmt_map = {
                    "detailed":  SlideDeckFormat.DETAILED_DECK,
                    "presenter": SlideDeckFormat.PRESENTER_SLIDES,
                }
                # SlideDeckLength only has DEFAULT and SHORT (no LONG)
                len_map = {
                    "short":  SlideDeckLength.SHORT,
                    "medium": SlideDeckLength.DEFAULT,
                }
                status = await client.artifacts.generate_slide_deck(
                    notebook_id,
                    slide_format=fmt_map.get(config.get("format", "detailed"), SlideDeckFormat.DETAILED_DECK),
                    slide_length=len_map.get(config.get("length", "medium"), SlideDeckLength.DEFAULT),
                    language=config.get("language", "en"),
                    instructions=config.get("instructions") or None,
                    source_ids=source_ids,
                )

            elif artifact_type == "quiz":
                from notebooklm import QuizQuantity, QuizDifficulty
                qty_map = {
                    "few":      QuizQuantity.FEWER,
                    "standard": QuizQuantity.STANDARD,
                    "many":     QuizQuantity.MORE,
                }
                diff_map = {
                    "easy":   QuizDifficulty.EASY,
                    "medium": QuizDifficulty.MEDIUM,
                    "hard":   QuizDifficulty.HARD,
                    "mixed":  QuizDifficulty.MEDIUM,
                }
                status = await client.artifacts.generate_quiz(
                    notebook_id,
                    quantity=qty_map.get(config.get("quantity", "standard"), QuizQuantity.STANDARD),
                    difficulty=diff_map.get(config.get("difficulty", "medium"), QuizDifficulty.MEDIUM),
                    instructions=config.get("instructions") or None,
                    source_ids=source_ids,
                )

            elif artifact_type == "flashcards":
                from notebooklm import QuizQuantity, QuizDifficulty
                qty_map = {
                    "few":      QuizQuantity.FEWER,
                    "standard": QuizQuantity.STANDARD,
                    "many":     QuizQuantity.MORE,
                }
                diff_map = {
                    "easy":   QuizDifficulty.EASY,
                    "medium": QuizDifficulty.MEDIUM,
                    "hard":   QuizDifficulty.HARD,
                    "mixed":  QuizDifficulty.MEDIUM,
                }
                status = await client.artifacts.generate_flashcards(
                    notebook_id,
                    quantity=qty_map.get(config.get("quantity", "standard"), QuizQuantity.STANDARD),
                    difficulty=diff_map.get(config.get("difficulty", "medium"), QuizDifficulty.MEDIUM),
                    instructions=config.get("instructions") or None,
                    source_ids=source_ids,
                )

            elif artifact_type == "infographic":
                from notebooklm import InfographicOrientation, InfographicDetail
                orient_map = {
                    "portrait":  InfographicOrientation.PORTRAIT,
                    "landscape": InfographicOrientation.LANDSCAPE,
                    "square":    InfographicOrientation.SQUARE,
                }
                detail_map = {
                    "overview": InfographicDetail.CONCISE,
                    "standard": InfographicDetail.STANDARD,
                    "detailed": InfographicDetail.DETAILED,
                }
                kwargs: dict[str, Any] = dict(
                    notebook_id=notebook_id,
                    orientation=orient_map.get(config.get("orientation", "portrait"), InfographicOrientation.PORTRAIT),
                    detail_level=detail_map.get(config.get("detail", "standard"), InfographicDetail.STANDARD),
                    language=config.get("language", "en"),
                    instructions=config.get("instructions") or None,
                    source_ids=source_ids,
                )
                # InfographicStyle is optional — only pass if the library exposes it
                try:
                    from notebooklm import InfographicStyle
                    style_val = config.get("style")
                    if style_val:
                        style_map = {s.name.lower(): s for s in InfographicStyle}
                        matched = style_map.get(style_val.lower())
                        if matched:
                            kwargs["style"] = matched
                except ImportError:
                    pass
                status = await client.artifacts.generate_infographic(**kwargs)

            elif artifact_type == "report":
                from notebooklm import ReportFormat
                fmt_map = {
                    "briefing":    ReportFormat.BRIEFING_DOC,
                    "study_guide": ReportFormat.STUDY_GUIDE,
                    "blog_post":   ReportFormat.BLOG_POST,
                    "custom":      ReportFormat.CUSTOM,
                }
                report_fmt = fmt_map.get(config.get("template", "study_guide"), ReportFormat.STUDY_GUIDE)
                extra = config.get("extra_instructions") or None
                status = await client.artifacts.generate_report(
                    notebook_id,
                    report_format=report_fmt,
                    # extra_instructions is ignored for CUSTOM; use custom_prompt instead
                    extra_instructions=extra if report_fmt != ReportFormat.CUSTOM else None,
                    custom_prompt=extra if report_fmt == ReportFormat.CUSTOM else None,
                    language=config.get("language", "en"),
                    source_ids=source_ids,
                )

            elif artifact_type == "data_table":
                # param is `instructions`, not `structure_prompt`
                status = await client.artifacts.generate_data_table(
                    notebook_id,
                    instructions=config.get("structure_prompt") or config.get("instructions") or None,
                    language=config.get("language", "en"),
                    source_ids=source_ids,
                )

            elif artifact_type == "mind_map":
                # Returns dict {"mind_map": ..., "note_id": ...}, not a GenerationStatus
                await client.artifacts.generate_mind_map(notebook_id, source_ids=source_ids)
                await runner.update_progress(task_id, 100, "Done")
                return {"artifact_type": artifact_type, "notebook_id": notebook_id}

            else:
                raise ValueError(f"Unknown artifact type: {artifact_type}")

            # Poll for completion (all types except mind_map which returned above)
            await runner.update_progress(task_id, 15, "Generating…")
            _check_cancelled(task_id)

            final = await client.artifacts.wait_for_completion(
                notebook_id,
                status.task_id,
                timeout=600,
                poll_interval=5,
            )

            if not final.is_complete:
                raise RuntimeError(f"Generation did not complete: {final.status}")

            await runner.update_progress(task_id, 100, "Done")
            return {"artifact_type": artifact_type, "notebook_id": notebook_id}

        except asyncio.CancelledError:
            raise
        except Exception as e:
            raise RuntimeError(str(e)) from e

    task_id = await task_runner.run(notebook_id, artifact_type, _do)
    return {"task_id": task_id}


# ── Task status ───────────────────────────────────────────────────────────────

@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    task = task_runner.get_task(task_id)
    if not task:
        raise HTTPException(404, {"error": "not_found", "message": "Task not found"})
    return task


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    ok = task_runner.cancel_task(task_id)
    if not ok:
        raise HTTPException(404, {"error": "not_found", "message": "Task not found or already complete"})
    return {"status": "cancelled"}


# ── Artifact data (structured JSON) ──────────────────────────────────────────

@router.get("/artifacts/data/{notebook_id}/{artifact_type}")
async def get_artifact_data(notebook_id: str, artifact_type: str, client=Depends(get_client)):
    """Return structured JSON for quiz, flashcards, mind_map, report, data_table."""
    try:
        tmp = tempfile.mktemp(suffix=_ext_for(artifact_type))

        if artifact_type == "quiz":
            path = await client.artifacts.download_quiz(notebook_id, tmp, output_format="json")
            return _read_json_or_text(path)

        elif artifact_type == "flashcards":
            path = await client.artifacts.download_flashcards(notebook_id, tmp, output_format="json")
            return _read_json_or_text(path)

        elif artifact_type == "mind_map":
            path = await client.artifacts.download_mind_map(notebook_id, tmp)
            return _read_json_or_text(path)

        elif artifact_type == "report":
            path = await client.artifacts.download_report(notebook_id, tmp)
            content = Path(path).read_text(encoding="utf-8")
            return {"content": content}

        elif artifact_type == "data_table":
            path = await client.artifacts.download_data_table(notebook_id, tmp)
            content = Path(path).read_text(encoding="utf-8-sig")
            return {"csv": content}

        else:
            raise HTTPException(400, {"error": "unsupported_type", "message": f"No data endpoint for {artifact_type}"})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


# ── Artifact stream (binary blob) ─────────────────────────────────────────────

@router.get("/artifacts/stream/{notebook_id}/{artifact_type}")
async def stream_artifact(notebook_id: str, artifact_type: str, client=Depends(get_client)):
    """Stream binary content for audio, video, infographic, slides."""
    try:
        suffix = _ext_for(artifact_type)
        tmp = tempfile.mktemp(suffix=suffix)

        if artifact_type == "audio":
            path = await client.artifacts.download_audio(notebook_id, tmp)
        elif artifact_type == "video":
            path = await client.artifacts.download_video(notebook_id, tmp)
        elif artifact_type == "infographic":
            path = await client.artifacts.download_infographic(notebook_id, tmp)
        elif artifact_type == "slides":
            path = await client.artifacts.download_slide_deck(notebook_id, tmp)
        else:
            raise HTTPException(400, {"error": "unsupported_type", "message": f"No stream for {artifact_type}"})

        media_type = _media_type_for(artifact_type, path)
        return FileResponse(path, media_type=media_type, filename=Path(path).name)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


# ── Download (save to disk) ───────────────────────────────────────────────────

@router.get("/artifacts/download/{notebook_id}/{artifact_type}")
async def download_artifact(
    notebook_id: str,
    artifact_type: str,
    format: str = "default",
    client=Depends(get_client),
):
    """Download artifact in the requested format."""
    try:
        suffix = _format_to_ext(artifact_type, format)
        tmp = tempfile.mktemp(suffix=suffix)

        if artifact_type == "audio":
            path = await client.artifacts.download_audio(notebook_id, tmp)
        elif artifact_type == "video":
            path = await client.artifacts.download_video(notebook_id, tmp)
        elif artifact_type == "slides":
            path = await client.artifacts.download_slide_deck(notebook_id, tmp)
        elif artifact_type == "infographic":
            path = await client.artifacts.download_infographic(notebook_id, tmp)
        elif artifact_type == "report":
            path = await client.artifacts.download_report(notebook_id, tmp)
        elif artifact_type == "data_table":
            path = await client.artifacts.download_data_table(notebook_id, tmp)
        elif artifact_type == "mind_map":
            path = await client.artifacts.download_mind_map(notebook_id, tmp)
        elif artifact_type == "quiz":
            fmt = format if format in ("json", "markdown", "html") else "json"
            path = await client.artifacts.download_quiz(notebook_id, tmp, output_format=fmt)
        elif artifact_type == "flashcards":
            fmt = format if format in ("json", "markdown", "html") else "json"
            path = await client.artifacts.download_flashcards(notebook_id, tmp, output_format=fmt)
        else:
            raise HTTPException(400, {"error": "unsupported_type", "message": f"Unknown type: {artifact_type}"})

        media_type = _media_type_for(artifact_type, path)
        return FileResponse(path, media_type=media_type, filename=Path(path).name)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ext_for(artifact_type: str) -> str:
    return {
        "audio":       ".mp4",
        "video":       ".mp4",
        "slides":      ".pdf",
        "infographic": ".png",
        "report":      ".md",
        "data_table":  ".csv",
        "mind_map":    ".json",
        "quiz":        ".json",
        "flashcards":  ".json",
    }.get(artifact_type, ".bin")


def _format_to_ext(artifact_type: str, fmt: str) -> str:
    if fmt in ("json", "markdown", "html", "csv", "pdf", "png", "mp3", "mp4"):
        return f".{fmt}"
    return _ext_for(artifact_type)


def _media_type_for(artifact_type: str, path: str) -> str:
    ext = Path(path).suffix.lower()
    return {
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".json": "application/json",
        ".md":  "text/markdown",
        ".csv": "text/csv",
        ".html": "text/html",
    }.get(ext, "application/octet-stream")


def _read_json_or_text(path: str):
    import json
    content = Path(path).read_text(encoding="utf-8")
    try:
        return json.loads(content)
    except Exception:
        return {"content": content}
