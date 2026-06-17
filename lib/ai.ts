import OpenAI from "openai";

// OpenAI-compatible client. Points at NVIDIA NIM by default; swap base URL/key/model
// via env to use any other OpenAI-compatible provider (e.g. freemodel.dev) — no code change.
// Fallback apiKey so the client constructs at import even before env is set
// (otherwise `next build` page-data collection throws). Real key required at runtime.
export const ai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "not-configured",
  baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
});

export const AI_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
