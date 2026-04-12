import warnings
warnings.filterwarnings("ignore")
from src.app.ai.model_v2 import FloorPlanAgent

agent = FloorPlanAgent()
a = agent.start("Create a small floor plan with 1 living room, 1 kitchen, and 1 bedroom.", thread_id="test1")
print("First call done.")
b = agent.start("Make the living room larger.", thread_id="test1")
print("Second call done.")