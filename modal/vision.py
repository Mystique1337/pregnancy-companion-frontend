# NOTE: NOT IN USE. Photo understanding now runs on NVIDIA's FREE vision model
# (see lib/vision.ts) to avoid GPU bills. This script is kept as a self-hosted /
# offline fallback: a small VLM (SmolVLM-Instruct, ~2B) on Modal, scale-to-zero.
# To use it instead of NVIDIA: `modal deploy modal/vision.py`, then point a client
# at its URL. On-brand for "build small": a tiny VLM, not a giant multimodal API.
#
# Serve a small vision-language model (SmolVLM-Instruct, ~2B) on Modal, GPU,
# scale-to-zero (pay only when a photo is read). Lets a mother send a photo of her
# ANC card / a drug packet / a test result and get a plain-language explanation.
#
# Deploy:  modal deploy modal/vision.py
#   -> https://chidi-ashinze--bumply-vision-read.modal.run
# App env (.env.local + Railway):
#   VISION_URL=https://chidi-ashinze--bumply-vision-read.modal.run
#   VISION_KEY=<same LLM_API_KEY from the bumply-llm secret>
#
# POST {"key":"...","image":"<base64>","prompt":"..."} -> {"text":"..."}

import modal

app = modal.App("bumply-vision")

MODEL = "HuggingFaceTB/SmolVLM-Instruct"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "transformers==4.46.3",
        "torch==2.5.1",
        "accelerate==1.1.1",
        "pillow==11.0.0",
        "num2words==0.5.13",
        "hf_transfer==0.1.9",
        "fastapi[standard]==0.115.6",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)
cache = modal.Volume.from_name("bumply-hf-cache", create_if_missing=True)

DEFAULT_PROMPT = (
    "You are a maternal health helper. This photo is from a pregnant or new mother. "
    "Read it and explain in simple English what it says. If it is an antenatal (ANC) "
    "card, read out her details, next visit and any results. If it is a drug/medicine, "
    "say what it is and how to take it. If it is a test result, say plainly if anything "
    "looks abnormal. If you see anything worrying, clearly tell her to see a health "
    "worker. Keep it short and kind. Do not diagnose."
)


@app.cls(
    image=image,
    volumes={"/root/.cache/huggingface": cache},
    gpu="t4",
    scaledown_window=120,        # pay-per-use: idle out after 2 min
    timeout=300,
    secrets=[modal.Secret.from_name("bumply-llm")],
)
@modal.concurrent(max_inputs=2)
class Vision:
    @modal.enter()
    def load(self):
        import torch
        from transformers import AutoProcessor, AutoModelForVision2Seq

        self.processor = AutoProcessor.from_pretrained(MODEL)
        self.model = AutoModelForVision2Seq.from_pretrained(
            MODEL, torch_dtype=torch.bfloat16
        ).to("cuda")

    @modal.fastapi_endpoint(method="POST")
    def read(self, data: dict):
        import os, base64, io
        from PIL import Image

        if data.get("key") != os.environ.get("LLM_API_KEY"):
            return {"error": "unauthorized"}
        b64 = data.get("image") or ""
        if not b64:
            return {"error": "no image"}
        prompt = (data.get("prompt") or DEFAULT_PROMPT).strip()
        try:
            raw = base64.b64decode(b64)
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            # SmolVLM caps very large images; downscale to keep it fast + cheap.
            img.thumbnail((1152, 1152))
            messages = [
                {"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt}]}
            ]
            text = self.processor.apply_chat_template(messages, add_generation_prompt=True)
            inputs = self.processor(text=text, images=[img], return_tensors="pt").to("cuda")
            out = self.model.generate(**inputs, max_new_tokens=300, do_sample=False)
            decoded = self.processor.batch_decode(out, skip_special_tokens=True)[0]
            # Keep only the assistant's answer after the final "Assistant:" marker.
            answer = decoded.split("Assistant:")[-1].strip() if "Assistant:" in decoded else decoded.strip()
            return {"text": answer}
        except Exception as e:
            return {"error": str(e)}
