import sys
import threading
import traceback
import time

def dump_tracebacks():
    while True:
        time.sleep(10)
        print('--- TICK ---', file=sys.stderr, flush=True)
        for thread_id, frame in sys._current_frames().items():
            if thread_id != threading.get_ident():
                print(f'Thread {thread_id}:', file=sys.stderr, flush=True)
                traceback.print_stack(frame, file=sys.stderr)
        print('------------', file=sys.stderr, flush=True)

t = threading.Thread(target=dump_tracebacks, daemon=True)
t.start()

print("1", flush=True)
from src.app.ai.model_v2 import FloorPlanAgent
print("2", flush=True)
agent = FloorPlanAgent()
print("3", flush=True)
res = agent.start("Create a floor plan with 3 rooms: living room, kitchen, bedroom.", thread_id="DEBUG_RUN_2")
print("4", flush=True)