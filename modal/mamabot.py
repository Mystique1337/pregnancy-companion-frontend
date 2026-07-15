# Serve HelpMum's open-source maternal LLM (mamabot-llama-1) on Modal, as an
# OpenAI-compatible endpoint, SCALE-TO-ZERO (you pay only while it's serving a
# request; it shuts down after a short idle window — never always-on).
#
# Deploy (once):
#   pip install modal && modal setup
#   modal secret create bumply-llm LLM_API_KEY=<pick-a-long-random-token> HF_TOKEN=<your hf token>
#   modal deploy modal/mamabot.py
#   -> endpoint printed, e.g. https://chidi-ashinze--bumply-mamabot-serve.modal.run
#
# Then in the app env (.env.local + Railway):
#   MAMABOT_URL=https://chidi-ashinze--bumply-mamabot-serve.modal.run/v1
#   MAMABOT_KEY=<the LLM_API_KEY you chose>
#   MAMABOT_MODEL=mamabot
#
# To also serve vax-llama, copy this file, change MODEL_NAME + app name.

import modal

MODEL_NAME = "HelpMumHQ/mamabot-llama-1"
MODEL_REVISION = "main"
PORT = 8000

app = modal.App("bumply-mamabot")

# vLLM image. Pin versions so deploys are reproducible.
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("vllm==0.7.2", "huggingface_hub[hf_transfer]==0.28.1")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# Cache the weights so only the FIRST cold start downloads them.
hf_cache = modal.Volume.from_name("bumply-hf-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("bumply-vllm-cache", create_if_missing=True)


@app.function(
    image=image,
    gpu="A10G",                # an 8B model fits on a 24GB A10G; bump to "L40S"/"A100" if OOM
    scaledown_window=120,      # ← PAY-PER-USE: shut the GPU down 2 min after the last request
    timeout=15 * 60,
    volumes={"/root/.cache/huggingface": hf_cache, "/root/.cache/vllm": vllm_cache},
    secrets=[modal.Secret.from_name("bumply-llm")],  # provides LLM_API_KEY (+ HF_TOKEN)
    # NOTE: no `min_containers` / no `keep_warm` → it scales to ZERO when idle.
)
@modal.concurrent(max_inputs=8)   # one warm GPU can handle several requests at once
@modal.web_server(port=PORT, startup_timeout=15 * 60)
def serve():
    import os
    import subprocess

    cmd = (
        f"vllm serve {MODEL_NAME} --revision {MODEL_REVISION} "
        f"--host 0.0.0.0 --port {PORT} "
        f"--served-model-name mamabot "
        f"--api-key {os.environ['LLM_API_KEY']} "
        f"--max-model-len 4096 --gpu-memory-utilization 0.92"
    )
    subprocess.Popen(cmd, shell=True)

# Older Modal SDKs: replace `scaledown_window` with `container_idle_timeout`,
# and `@modal.concurrent(max_inputs=8)` with `allow_concurrent_inputs=8` in the
# @app.function(...) decorator. Everything else stays the same.
