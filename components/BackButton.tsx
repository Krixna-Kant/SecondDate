"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="back-btn"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <span aria-hidden>←</span> {label}
    </button>
  );
}
