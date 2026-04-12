from src.app.ai.model_v2 import FloorPlanAgent
import os
import time
import csv
from datetime import datetime
import pandas as pd
import src.app.core.layer2_pipeline as layer2_pipeline
import json

base_dir = os.path.join(os.path.dirname(__file__))
csv_file = os.path.join(base_dir, "data", "samples", "data.csv")
asset_directory = os.path.join(base_dir, "data", "asset")
LATENCY_LOG = os.path.join(base_dir, "data", "latency_log.csv")

HEADERS = [
    "timestamp", "prompt_type", "prompt",
    "dxf_file", "total_s",
    "spec_s", "polygon_llm_s", "polygon_assemble_s",
    "validate_s_total", "validate_runs",
    "critique_s_total", "critique_runs",
    "fix_llm_s_total", "fix_assemble_s_total", "fix_runs",
]

def log_latency(prompt_type, prompt, dxf_files, total_s, timings):
    file_exists = os.path.isfile(LATENCY_LOG)

    validate_list = timings.get("validate_s_list", [])
    critique_list = timings.get("critique_s_list", [])
    fix_llm_list  = timings.get("fix_llm_s_list", [])
    fix_asm_list  = timings.get("fix_assemble_s_list", [])

    row_base = {
        "timestamp":           datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "prompt_type":         prompt_type,
        "prompt":              prompt[:120],
        "total_s":             f"{total_s:.1f}",
        "spec_s":              timings.get("spec_s", ""),
        "polygon_llm_s":       timings.get("polygon_llm_s", ""),
        "polygon_assemble_s":  timings.get("polygon_assemble_s", ""),
        "validate_s_total":    f"{sum(validate_list):.1f}" if validate_list else "",
        "validate_runs":       len(validate_list),
        "critique_s_total":    f"{sum(critique_list):.1f}" if critique_list else "",
        "critique_runs":       len(critique_list),
        "fix_llm_s_total":     f"{sum(fix_llm_list):.1f}" if fix_llm_list else "",
        "fix_assemble_s_total": f"{sum(fix_asm_list):.1f}" if fix_asm_list else "",
        "fix_runs":            len(fix_llm_list),
    }

    with open(LATENCY_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        if not file_exists:
            writer.writeheader()
        for dxf in (dxf_files or ["unknown"]):
            writer.writerow({**row_base, "dxf_file": dxf})

    polygon_llm_list = timings.get("polygon_llm_s_list", [])
    polygon_asm_list = timings.get("polygon_assemble_s_list", [])
    outcomes = timings.get("validate_outcomes", [])
    print(
        f"\n[LATENCY] total={total_s:.1f}s | "
        f"spec={timings.get('spec_s', '?')}s | "
        f"poly_llm={round(sum(polygon_llm_list), 1)}s(x{len(polygon_llm_list)}) | "
        f"poly_asm={round(sum(polygon_asm_list), 1)}s(x{len(polygon_asm_list)}) | "
        f"validate={round(sum(validate_list), 1)}s(x{len(validate_list)}) | "
        f"fix_llm={round(sum(fix_llm_list), 1)}s(x{len(fix_llm_list)}) | "
        f"fix_asm={round(sum(fix_asm_list), 1)}s(x{len(fix_asm_list)}) | "
        f"outcomes={outcomes}"
        f"\n  DXFs: {dxf_files}"
        f"\n  Logged → latency_log.csv\n"
    )


# first_prompt = "I need a house with 4 bedrooms with attached bathrooms, a kitchen and a balcony in one room."
# first_prompt = "generate a house with 3 rooms each having bathroom and balcony and kitchen and hall together" \
# "and whole house shape can be irregular in front so that it can be used for lawn or parking so the overall house " \
# "dimensions should be 12x14m. i want a balcony atleast 1.5m wide and 4m long."
first_prompt = "generate a 2bhk with utility, pantry and parking"
agent = FloorPlanAgent()
thread_id = "test1"
_t0 = time.time()
result = agent.start(first_prompt, thread_id=thread_id)
total_s = time.time() - _t0
dxf_files = agent._node_timings.get("dxfs_generated", [])
log_latency("initial", first_prompt, dxf_files, total_s, agent._node_timings)
agent.print_token_summary()
print(result)

image_path = os.path.join(base_dir, 'data', 'generated', f'{thread_id}_{len(result["result"]["user_prompts"])}.png')
dxf_path = os.path.splitext(image_path)[0] + ".dxf"
structure_json = {"layout": result["result"]["layout"], "total_area": result["result"]["spec"]["total_area"], "doors": result["result"]["spec"].get("doors", []), "windows": result["result"]["spec"].get("windows", [])}
componests = pd.read_csv(csv_file)

# layer2_pipeline.run_layer2_on_dxf(dxf_path, structure_json, componests, asset_directory, dxf_path)

while True:
    user_input = input("Enter your prompt (or 'exit' to quit): ")
    if user_input.lower() == 'exit':
        break
    _t0 = time.time()
    result = agent.continue_with_modification(user_input)
    total_s = time.time() - _t0
    dxf_files = agent._node_timings.get("dxfs_generated", [])
    log_latency("modification", user_input, dxf_files, total_s, agent._node_timings)
    agent.print_token_summary()
    print(result)
    image_path = os.path.join(base_dir, 'data', 'generated', f'{thread_id}_{len(result["user_prompts"])}.png')
    dxf_path = os.path.splitext(image_path)[0] + ".dxf"
    structure_json = {"layout": result["layout"], "total_area": result["spec"]["total_area"], "doors": result["spec"].get("doors", []), "windows": result["spec"].get("windows", [])}
    componests = pd.read_csv(csv_file)
    # layer2_pipeline.run_layer2_on_dxf(dxf_path, structure_json, componests, asset_directory, dxf_path)
