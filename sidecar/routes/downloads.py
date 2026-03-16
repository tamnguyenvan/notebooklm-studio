"""
Downloads routes — record, list, delete downloads from the local library DB.
"""
from __future__ import annotations
import os
import sqlite3
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/downloads", tags=["downloads"])

# ── DB helpers ────────────────────────────────────────────────────────────────

def _db_path() -> Path:
    home = Path(os.environ.get("NOTEBOOKLM_HOME", Path.home() / ".notebooklm"))
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    return home / "library.db"


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            notebook_id TEXT NOT NULL,
            notebook_title TEXT NOT NULL DEFAULT '',
            artifact_type TEXT NOT NULL,
            format TEXT NOT NULL,
            local_path TEXT NOT NULL,
            file_size_bytes INTEGER DEFAULT 0,
            downloaded_at TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    # Check if file still exists on disk
    d["file_exists"] = Path(d["local_path"]).exists()
    return d


# ── Request models ────────────────────────────────────────────────────────────

class RecordDownloadRequest(BaseModel):
    notebook_id: str
    notebook_title: str
    artifact_type: str
    format: str
    local_path: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/record")
async def record_download(body: RecordDownloadRequest):
    """Record a completed download into the library DB."""
    try:
        db = _get_db()
        path = Path(body.local_path)
        file_size = path.stat().st_size if path.exists() else 0
        row_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            """INSERT OR REPLACE INTO downloads
               (id, notebook_id, notebook_title, artifact_type, format, local_path, file_size_bytes, downloaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (row_id, body.notebook_id, body.notebook_title, body.artifact_type,
             body.format, body.local_path, file_size, now),
        )
        db.commit()
        return _row_to_dict(db.execute("SELECT * FROM downloads WHERE id = ?", (row_id,)).fetchone())
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


@router.get("")
async def list_downloads(
    artifact_type: str | None = None,
    notebook_id: str | None = None,
    search: str | None = None,
):
    """List all downloads, optionally filtered."""
    try:
        db = _get_db()
        query = "SELECT * FROM downloads WHERE 1=1"
        params: list[Any] = []
        if artifact_type:
            query += " AND artifact_type = ?"
            params.append(artifact_type)
        if notebook_id:
            query += " AND notebook_id = ?"
            params.append(notebook_id)
        if search:
            query += " AND (notebook_title LIKE ? OR artifact_type LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        query += " ORDER BY downloaded_at DESC"
        rows = db.execute(query, params).fetchall()
        return [_row_to_dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


@router.delete("/{download_id}")
async def delete_download(download_id: str, delete_file: bool = False):
    """Remove a download record. Optionally delete the file from disk."""
    try:
        db = _get_db()
        row = db.execute("SELECT * FROM downloads WHERE id = ?", (download_id,)).fetchone()
        if not row:
            raise HTTPException(404, {"error": "not_found", "message": "Download not found"})
        if delete_file:
            path = Path(row["local_path"])
            if path.exists():
                path.unlink()
        db.execute("DELETE FROM downloads WHERE id = ?", (download_id,))
        db.commit()
        return {"status": "deleted", "id": download_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


@router.post("/{download_id}/reveal")
async def reveal_in_finder(download_id: str):
    """Open the file's containing folder in the OS file manager."""
    try:
        db = _get_db()
        row = db.execute("SELECT * FROM downloads WHERE id = ?", (download_id,)).fetchone()
        if not row:
            raise HTTPException(404, {"error": "not_found", "message": "Download not found"})
        path = Path(row["local_path"])
        if not path.exists():
            raise HTTPException(410, {"error": "file_gone", "message": "File no longer exists on disk"})
        _reveal_path(path)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, {"error": "internal_error", "message": str(e)})


def _reveal_path(path: Path):
    """Cross-platform reveal file in OS file manager."""
    if sys.platform == "darwin":
        subprocess.Popen(["open", "-R", str(path)])
    elif sys.platform == "win32":
        subprocess.Popen(["explorer", "/select,", str(path)])
    else:
        # Linux: open the parent directory
        subprocess.Popen(["xdg-open", str(path.parent)])
