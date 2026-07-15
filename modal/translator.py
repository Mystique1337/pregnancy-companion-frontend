# Serve HelpMum's open-source English<->Yoruba translators (M2M100/NLLB, 0.6B) on
# Modal, CPU-only, scale-to-zero (pay only when translating). One POST endpoint.
#
# Deploy:  modal deploy modal/translator.py
#   -> https://chidi-ashinze--bumply-translator-translate.modal.run
# App env (.env.local + Railway):
#   TRANSLATE_URL=https://chidi-ashinze--bumply-translator-translate.modal.run
#   TRANSLATE_KEY=<same LLM_API_KEY from the bumply-llm secret>
#
# POST {"key":"<LLM_API_KEY>","direction":"en2yo"|"yo2en","text":"..."} -> {"text":"..."}

import modal

MODELS = {
    "en2yo": ("HelpMumHQ/AI-translator-eng-to-9ja", "en", "yo"),
    "yo2en": ("HelpMumHQ/AI-translator-9ja-to-eng", "yo", "en"),
}

app = modal.App("bumply-translator")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("transformers==4.46.3", "torch==2.5.1", "sentencepiece==0.2.0", "hf_transfer==0.1.9", "fastapi[standard]==0.115.6")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)
cache = modal.Volume.from_name("bumply-hf-cache", create_if_missing=True)


@app.cls(
    image=image,
    volumes={"/root/.cache/huggingface": cache},
    cpu=2,
    memory=4096,
    scaledown_window=120,        # pay-per-use: idle out after 2 min
    secrets=[modal.Secret.from_name("bumply-llm")],
)
@modal.concurrent(max_inputs=4)
class Translator:
    @modal.enter()
    def load(self):
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        self.tok, self.mdl = {}, {}
        for k, (name, _src, _tgt) in MODELS.items():
            self.tok[k] = AutoTokenizer.from_pretrained(name)
            self.mdl[k] = AutoModelForSeq2SeqLM.from_pretrained(name)

    @modal.fastapi_endpoint(method="POST")
    def translate(self, data: dict):
        import os
        if data.get("key") != os.environ.get("LLM_API_KEY"):
            return {"error": "unauthorized"}
        direction = data.get("direction", "en2yo")
        text = (data.get("text") or "").strip()
        if direction not in MODELS or not text:
            return {"error": "bad request"}
        name, src, tgt = MODELS[direction]
        tok, mdl = self.tok[direction], self.mdl[direction]
        try:
            tok.src_lang = src
            enc = tok(text, return_tensors="pt")
            gen = mdl.generate(**enc, forced_bos_token_id=tok.get_lang_id(tgt), max_new_tokens=256)
            return {"text": tok.batch_decode(gen, skip_special_tokens=True)[0]}
        except Exception as e:
            # Some fine-tunes bake the direction in and reject lang codes — retry plainly.
            try:
                enc = tok(text, return_tensors="pt")
                gen = mdl.generate(**enc, max_new_tokens=256)
                return {"text": tok.batch_decode(gen, skip_special_tokens=True)[0]}
            except Exception as e2:
                return {"error": f"{e} / {e2}"}
