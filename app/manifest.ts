import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bumply — AI Pregnancy Companion",
    short_name: "Bumply",
    description: "A WhatsApp-first pregnancy midwife: danger-sign checks, weekly care and reminders, in your language — works offline.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en",
    categories: ["health", "medical", "lifestyle"],
    background_color: "#FBF7F1",
    theme_color: "#C97B5A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
