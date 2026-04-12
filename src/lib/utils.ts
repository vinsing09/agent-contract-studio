import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseApiError(err: any): string {
  const msg = err?.message || String(err);
  try {
    const parsed = JSON.parse(msg.replace(/^API error \d+: /, ""));
    return parsed.detail || msg;
  } catch {
    return msg;
  }
}
