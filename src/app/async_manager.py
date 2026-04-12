import threading
import uuid
import logging
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

MAX_CONCURRENT_GENERATIONS = 3


def _update_task_in_db(task_id: str, status: str, result: Any = None, error: str = None):
    """Write task status to the database.  Caller must have an active app context.

    Failures are logged and swallowed — a missed status update must never crash
    the worker thread or leave it in an unrecoverable state.
    """
    from src.app.extensions import db
    from src.app.models import Task

    try:
        task = db.session.get(Task, task_id)
        if task is None:
            logger.warning(f"_update_task_in_db: task {task_id!r} not found in DB")
            return
        task.status = status
        if result is not None:
            task.result = result
        if error is not None:
            task.result = {"error": error}
        task.updated_at = datetime.utcnow()
        db.session.commit()
    except Exception as exc:
        logger.warning(f"_update_task_in_db failed for {task_id!r} (status={status}): {exc}")
        try:
            db.session.rollback()
        except Exception:
            pass


class AsyncManager:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_GENERATIONS)
            self._active_count = 0
            self._queue_lock = threading.Lock()
            # Ordered dict of task_id -> True for tasks that are waiting or running
            self._pending_tasks: OrderedDict[str, bool] = OrderedDict()
            self.initialized = True

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @property
    def active_count(self) -> int:
        with self._queue_lock:
            return self._active_count

    @property
    def queue_depth(self) -> int:
        with self._queue_lock:
            return max(0, len(self._pending_tasks) - self._active_count)

    def get_queue_position(self, task_id: str) -> int:
        """Return 0-based queue position. 0 means actively running. -1 means unknown."""
        with self._queue_lock:
            if task_id not in self._pending_tasks:
                return -1
            pos = list(self._pending_tasks.keys()).index(task_id)
            if pos < self._active_count:
                return 0
            return pos - self._active_count + 1

    def submit_task(self, func, *args, _db_chat_id: int = None, **kwargs) -> str:
        """
        Submits a function to be executed in the background.
        Returns a unique task_id.  Task status is persisted to the database.
        """
        from flask import current_app
        from src.app.extensions import db
        from src.app.models import Task

        task_id = str(uuid.uuid4())

        task_row = Task(task_id=task_id, chat_id=_db_chat_id, status="PENDING")
        db.session.add(task_row)
        db.session.commit()

        with self._queue_lock:
            self._pending_tasks[task_id] = True

        app = current_app._get_current_object()

        def wrapper():
            with app.app_context():
                with self._queue_lock:
                    self._active_count += 1
                try:
                    _update_task_in_db(task_id, "STARTED")
                    result = func(*args, **kwargs)
                    if isinstance(result, dict) and result.get("status") == "error":
                        _update_task_in_db(task_id, "FAILURE", error=result.get("error", "Unknown error"))
                    else:
                        _update_task_in_db(task_id, "SUCCESS", result=result)
                except Exception as e:
                    logger.exception(f"Task {task_id} failed")
                    from src.app.extensions import db as _db
                    try:
                        _db.session.rollback()
                    except Exception:
                        pass
                    _update_task_in_db(task_id, "FAILURE", error=str(e))
                finally:
                    with self._queue_lock:
                        self._active_count -= 1
                        self._pending_tasks.pop(task_id, None)

        self.executor.submit(wrapper)
        return task_id

    def get_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Returns the status dictionary for a given task_id from the database.
        """
        from src.app.models import Task

        task = Task.query.filter_by(task_id=task_id).first()
        if task is None:
            return None
        return {
            "status": task.status,
            "result": task.result,
            "queue_position": self.get_queue_position(task_id),
        }


async_manager = AsyncManager.get_instance()
