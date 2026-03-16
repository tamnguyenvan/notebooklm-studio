"""
Singleton NotebookLMClient — shared across all route handlers.
"""
from __future__ import annotations
from typing import Optional

_client = None  # type: Optional[any]


async def get_client():
    """FastAPI dependency — yields the active client or raises 401."""
    from fastapi import HTTPException
    if _client is None:
        raise HTTPException(status_code=401, detail={"error": "auth_required", "message": "Not logged in"})
    return _client


async def init_client() -> bool:
    """Try to initialise the client from existing storage_state.json. Returns True on success."""
    global _client
    try:
        from notebooklm import NotebookLMClient
        _client = await NotebookLMClient.from_storage()
        await _client.__aenter__()
        print("[sidecar] Client initialised from storage.", flush=True)
        return True
    except Exception as e:
        print(f"[sidecar] Could not init client from storage: {e}", flush=True)
        _client = None
        return False


async def reinit_client() -> None:
    """Re-initialise after login — closes old client if any."""
    global _client
    if _client is not None:
        try:
            await _client.__aexit__(None, None, None)
        except Exception:
            pass
    _client = None
    await init_client()


async def clear_client() -> None:
    """Clear the client (logout)."""
    global _client
    if _client is not None:
        try:
            await _client.__aexit__(None, None, None)
        except Exception:
            pass
    _client = None
