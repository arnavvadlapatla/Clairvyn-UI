# ──────────────────────────────────────────────────────────────
#  Gunicorn configuration for ClairvynAI
# ──────────────────────────────────────────────────────────────
import multiprocessing

# Bind to all interfaces inside the container
bind = "0.0.0.0:5000"

# Workers — must be 1 because AsyncManager uses an in-process ThreadPoolExecutor.
# Multiple workers = multiple independent thread pools and _pending_tasks dicts.
# Task submissions and polls would hit different workers → queue_position always -1.
# Scale vertically (more threads via MAX_CONCURRENT_GENERATIONS) not horizontally.
workers = 1

# Floor plan generation is slow — 120s for the AI call alone is realistic
timeout = 360

# Preload the app so the AI model is loaded once
preload_app = True

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Graceful restart
graceful_timeout = 380

# Worker class — sync is correct. Flask routes return quickly (generation is
# offloaded to ThreadPoolExecutor threads). Frontend polls a separate endpoint.
worker_class = "sync"
