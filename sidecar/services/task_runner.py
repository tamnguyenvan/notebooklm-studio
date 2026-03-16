"""
Task runner — manages long-running generation tasks and broadcasts WS progress.
"""
from __future__ import annotations
import asyncio
import uuid
from typing import Any, Callable, Coroutine


class TaskRunner:
    def __init__(self):
        self.tasks: dict[str, dict[str, Any]] = {}

    async def run(
        self,
        notebook_id: str,
        task_type: str,
        coro_factory: Callable[["TaskRunner", str], Coroutine],
    ) -> str:
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "id": task_id,
            "notebook_id": notebook_id,
            "type": task_type,
            "status": "pending",
            "progress": 0,
        }
        asyncio.create_task(self._execute(task_id, notebook_id, coro_factory))
        return task_id

    async def _execute(
        self,
        task_id: str,
        notebook_id: str,
        coro_factory: Callable[["TaskRunner", str], Coroutine],
    ):
        from services.ws_manager import ws_manager

        self.tasks[task_id]["status"] = "running"
        try:
            result = await coro_factory(self, task_id)
            self.tasks[task_id].update({"status": "complete", "progress": 100})
            await ws_manager.broadcast("task_complete", {
                "task_id": task_id,
                "notebook_id": notebook_id,
                **(result or {}),
            })
        except Exception as e:
            self.tasks[task_id].update({"status": "error", "error": str(e)})
            await ws_manager.broadcast("task_error", {
                "task_id": task_id,
                "notebook_id": notebook_id,
                "error": str(e),
            })

    async def update_progress(self, task_id: str, progress: int, message: str = ""):
        from services.ws_manager import ws_manager

        if task_id in self.tasks:
            self.tasks[task_id]["progress"] = progress
            nb_id = self.tasks[task_id].get("notebook_id", "")
            await ws_manager.broadcast("task_progress", {
                "task_id": task_id,
                "notebook_id": nb_id,
                "progress": progress,
                "message": message,
            })

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        return self.tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if task and task["status"] in ("pending", "running"):
            task["status"] = "cancelled"
            return True
        return False


task_runner = TaskRunner()
