# OPTIONAL / OPT-IN — costs a little GPU time (one short run, ~a few cents on a T4).
# Fine-tune a TINY base model (SmolLM2-360M-Instruct) into a maternal helper for the
# OFFLINE Android experience, using the same curated Q&A that grounds the on-device
# model (public/offline/maternal-qa.json). This is the "distil into SmolLM-size" path:
# bake maternal knowledge into the weights so the offline model answers well even
# before retrieval. Not deployed / not always-on — you run it only when you want a
# new checkpoint.
#
# Run:   modal run modal/finetune.py            (trains, saves a LoRA adapter to the volume)
#        modal run modal/finetune.py --merge    (also merges + exports full weights)
#
# To use the result offline you would convert the merged model to ONNX for
# transformers.js (Xenova/optimum) and host it; the app's OfflineHelper would then
# point VLM/gen at your model id. Until then, the on-device KB retrieval already
# lifts offline quality with zero training.

import json
import modal

app = modal.App("bumply-finetune")

BASE = "HuggingFaceTB/SmolLM2-360M-Instruct"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.5.1",
        "transformers==4.46.3",
        "datasets==3.1.0",
        "peft==0.13.2",
        "trl==0.12.1",
        "accelerate==1.1.1",
        "hf_transfer==0.1.9",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    # Bake the curated Q&A into the image so training has data with no upload step.
    .add_local_file("public/offline/maternal-qa.json", "/root/maternal-qa.json", copy=True)
)
vol = modal.Volume.from_name("bumply-finetune", create_if_missing=True)
cache = modal.Volume.from_name("bumply-hf-cache", create_if_missing=True)

SYSTEM = "You are Bumply, a kind pregnancy and newborn helper for Nigerian mothers. Answer in 1-2 short, simple sentences. For any danger sign, tell her to go to a clinic or hospital now."


def build_examples() -> list[dict]:
    data = json.load(open("/root/maternal-qa.json"))
    rows = []
    for it in data.get("items", []):
        rows.append({"messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": it["q"]},
            {"role": "assistant", "content": it["a"]},
        ]})
    # Add danger-sign reinforcement.
    d = data.get("danger", {})
    for sign in d.get("signs", []):
        rows.append({"messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"I have {sign.lower()}, what should I do?"},
            {"role": "assistant", "content": d.get("advice", "Go to the nearest hospital now — do not wait.")},
        ]})
    return rows


@app.function(image=image, gpu="t4", timeout=60 * 60, volumes={"/out": vol, "/root/.cache/huggingface": cache})
def train(merge: bool = False):
    import torch
    from datasets import Dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig
    from trl import SFTConfig, SFTTrainer

    rows = build_examples()
    print(f"training on {len(rows)} examples")
    ds = Dataset.from_list(rows)

    tok = AutoTokenizer.from_pretrained(BASE)
    model = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.bfloat16)

    peft_cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules=["q_proj", "v_proj", "k_proj", "o_proj"], task_type="CAUSAL_LM")
    cfg = SFTConfig(
        output_dir="/out/adapter",
        num_train_epochs=8,           # small dataset → more passes; keep it short + cheap
        per_device_train_batch_size=4,
        learning_rate=2e-4,
        logging_steps=5,
        save_strategy="no",
        bf16=True,
        max_seq_length=512,
    )
    trainer = SFTTrainer(model=model, args=cfg, train_dataset=ds, peft_config=peft_cfg, processing_class=tok)
    trainer.train()
    trainer.save_model("/out/adapter")
    tok.save_pretrained("/out/adapter")
    print("saved LoRA adapter -> /out/adapter")

    if merge:
        from peft import PeftModel
        base = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.bfloat16)
        merged = PeftModel.from_pretrained(base, "/out/adapter").merge_and_unload()
        merged.save_pretrained("/out/merged")
        tok.save_pretrained("/out/merged")
        print("merged full model -> /out/merged (convert to ONNX for transformers.js)")
    vol.commit()


@app.local_entrypoint()
def main(merge: bool = False):
    train.remote(merge=merge)
