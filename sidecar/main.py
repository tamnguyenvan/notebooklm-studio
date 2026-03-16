import os
import signal
import sys
import asyncio
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from uvicorn import Config, Server

PORT_API = 8008
server_instance = None


# ── lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: try to init client from existing storage_state.json
    from services.client import init_client
    await init_client()
    yield
    # Shutdown: close client
    from services.client import clear_client
    await clear_client()


# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="NotebookLM Studio API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to tauri://localhost for production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── routes ────────────────────────────────────────────────────────────────────

from routes.auth import router as auth_router
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "ok", "port": PORT_API, "pid": os.getpid()}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    from services.ws_manager import ws_manager
    await ws_manager.connect(ws)
    try:
        while True:
            # Heartbeat: echo pings back
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


# ── process management ────────────────────────────────────────────────────────

def kill_process():
    os.kill(os.getpid(), signal.SIGINT)


def stdin_loop():
    print("[sidecar] Waiting for commands...", flush=True)
    while True:
        user_input = sys.stdin.readline().strip()
        match user_input:
            case "sidecar shutdown":
                print("[sidecar] Received 'sidecar shutdown' command.", flush=True)
                kill_process()
            case _:
                if user_input:
                    print(f"[sidecar] Unknown command: [{user_input}]", flush=True)


def start_input_thread():
    try:
        t = threading.Thread(target=stdin_loop, daemon=True)
        t.start()
    except Exception:
        print("[sidecar] Failed to start input handler.", flush=True)


def start_api_server(**kwargs):
    global server_instance
    port = kwargs.get("port", PORT_API)
    if server_instance is not None:
        print("[sidecar] Server already running.", flush=True)
        return
    print(f"[sidecar] Starting API server on port {port}...", flush=True)
    config = Config(app, host="127.0.0.1", port=port, log_level="info")
    server_instance = Server(config)
    asyncio.run(server_instance.serve())


if __name__ == "__main__":
    start_input_thread()
    start_api_server()
