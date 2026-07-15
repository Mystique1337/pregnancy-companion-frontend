"use client";
// Caches a compact profile on the phone (localStorage) whenever she's online, so
// the OFFLINE helper on /sos can answer with her context (week, name, language)
// even with no signal.
import { useEffect } from "react";

export type CachedProfile = {
  firstName: string;
  week: number;
  trimester: string;
  language: string;
  firstPregnancy: boolean;
  dueDate: string | null;
  updatedAt: number;
};

export default function ProfileCache(p: Omit<CachedProfile, "updatedAt">) {
  useEffect(() => {
    try {
      localStorage.setItem("bumply_profile", JSON.stringify({ ...p, updatedAt: Date.now() }));
    } catch { /* ignore */ }
  }, [p]);
  return null;
}

// Helper for reading it back (used by the offline helper).
export function readCachedProfile(): CachedProfile | null {
  try {
    const raw = localStorage.getItem("bumply_profile");
    return raw ? (JSON.parse(raw) as CachedProfile) : null;
  } catch {
    return null;
  }
}
