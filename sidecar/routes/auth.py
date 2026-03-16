"""
Auth routes — /auth/status, /auth/login, /auth/logout, /auth/verify
"""
from __future__ import annotations
import asyncio
import stat
from pathlib import Path

from fastapi import APIRouter, HTTPException

from services.client import init_client, reinit_client, clear_client

router = APIRouter(prefix="/auth", tags=["auth"])

# ── helpers ──────────────────────────────────────────────────────────────────

async def _fetch_account_info() -> dict:
    """Return basic account info from the active client."""
    from services.client import _client as c
    if c is None:
        return {}
    try:
        auth = c.auth
        # Try common attribute names for email
        email = (
            getattr(auth, "email", None)
            or getattr(auth, "account_email", None)
            or getattr(auth, "user_email", None)
        )
        # Try to extract from cookies if available
        if not email:
            cookies = getattr(auth, "cookies", {})
            if isinstance(cookies, dict):
                # Some builds store email in a cookie
                email = cookies.get("email") or cookies.get("GMAIL_AT")
        return {
            "email": email or "signed-in",
            "display_name": None,
            "avatar_url": None,
        }
    except Exception:
        return {"email": "signed-in", "display_name": None, "avatar_url": None}


def _run_playwright_login():
    """Run the async Playwright login in a fresh event loop (thread-pool safe)."""
    asyncio.run(_async_playwright_login())


async def _async_playwright_login():
    """
    Launch a headed Playwright Chromium window for Google sign-in.
    Saves storage_state.json and chmod 0600 on success.
    """
    import os

    # When running as a PyInstaller frozen binary, Playwright's driver is
    # extracted to a temp dir and can't find the browsers installed by the
    # user. Point it at the real browser cache explicitly.
    browsers_path = os.path.expanduser("~/.cache/ms-playwright")
    if os.path.isdir(browsers_path):
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = browsers_path

    from playwright.async_api import async_playwright
    try:
        from notebooklm.auth import load_auth_from_storage
        from notebooklm._url_utils import is_google_auth_redirect
    except ImportError:
        # Fallback if internal helpers aren't exposed
        def load_auth_from_storage(path): pass
        def is_google_auth_redirect(url): return "accounts.google.com" in url

    NOTEBOOKLM_URL = "https://notebooklm.google.com/"
    GOOGLE_ACCOUNTS_URL = "https://accounts.google.com/"

    home = Path.home() / ".notebooklm"
    home.mkdir(mode=0o700, parents=True, exist_ok=True)
    storage_path = home / "storage_state.json"
    browser_profile = home / "browser_profile"
    browser_profile.mkdir(mode=0o700, parents=True, exist_ok=True)

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(browser_profile),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--password-store=basic",
            ],
            ignore_default_args=["--enable-automation"],
        )

        page = context.pages[0] if context.pages else await context.new_page()
        login_complete = asyncio.Event()

        async def on_navigation(frame):
            if frame != page.main_frame:
                return
            url = frame.url
            if (
                url.startswith(NOTEBOOKLM_URL)
                and "accounts.google.com" not in url
                and not is_google_auth_redirect(url)
            ):
                login_complete.set()

        page.on("framenavigated", on_navigation)
        await page.goto(NOTEBOOKLM_URL, wait_until="domcontentloaded")

        try:
            await asyncio.wait_for(login_complete.wait(), timeout=300)
        except asyncio.TimeoutError:
            await context.close()
            raise ValueError("Login timed out after 5 minutes. Please try again.")

        # Regional cookie fix
        await page.goto(GOOGLE_ACCOUNTS_URL, wait_until="domcontentloaded")
        await page.goto(NOTEBOOKLM_URL, wait_until="domcontentloaded")

        await context.storage_state(path=str(storage_path))
        storage_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
        await context.close()

    # Validate SID present
    try:
        load_auth_from_storage(str(storage_path))
    except Exception:
        pass  # best-effort; reinit_client will validate


# ── routes ───────────────────────────────────────────────────────────────────

@router.get("/status")
async def auth_status():
    """Return current auth state."""
    from services.client import _client as c
    if c is None:
        return {"is_logged_in": False, "account": None}
    try:
        account = await _fetch_account_info()
        return {"is_logged_in": True, "account": account}
    except Exception:
        return {"is_logged_in": False, "account": None}


@router.post("/login")
async def login():
    """
    Launch headed Playwright browser for Google sign-in.
    Blocks until the user completes login (up to 5 min).
    """
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_playwright_login)
        await reinit_client()
        account = await _fetch_account_info()
        return {"status": "ok", "account": account}
    except Exception as e:
        raise HTTPException(status_code=400, detail={"error": "login_failed", "message": str(e)})


@router.post("/verify")
async def verify():
    """Re-init client from existing storage_state.json (CI/CD / re-launch path)."""
    success = await init_client()
    if not success:
        raise HTTPException(status_code=401, detail={"error": "auth_required", "message": "No valid session found. Please log in."})
    account = await _fetch_account_info()
    return {"status": "ok", "account": account}


@router.post("/logout")
async def logout():
    """Clear the client and delete storage_state.json."""
    await clear_client()
    storage_path = Path.home() / ".notebooklm" / "storage_state.json"
    try:
        if storage_path.exists():
            storage_path.unlink()
    except Exception as e:
        print(f"[sidecar] Could not delete storage_state.json: {e}", flush=True)
    return {"status": "ok"}
