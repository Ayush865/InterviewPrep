"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, Lock, Settings } from "lucide-react";
import Link from "next/link";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  messageLine1: string;
  messageLine2: string;
}

const LimitReachedModal = ({
  isOpen,
  onClose,
  title = "Limit reached",
  messageLine1,
  messageLine2,
}: LimitReachedModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="limit-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-in fade-in zoom-in-95 relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-surface-overlay p-7 shadow-2xl duration-200"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-500 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-4">
          <div className="flex size-11 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
            <Lock className="size-5 text-accent" aria-hidden="true" />
          </div>

          <h2
            id="limit-modal-title"
            className="text-xl font-semibold tracking-tight text-white"
          >
            {title}
          </h2>

          <p className="text-sm leading-relaxed text-zinc-400">{messageLine1}</p>
          <p className="text-sm leading-relaxed text-zinc-400">{messageLine2}</p>

          <div className="mt-2 flex flex-col gap-2.5">
            <button type="button" className="btn-accent !h-10 w-full text-sm">
              Upgrade to Premium
            </button>
            <Link
              href="/settings/vapi"
              className="btn-quiet !h-10 w-full text-sm"
            >
              <Settings className="size-4" aria-hidden="true" />
              Use my Vapi key
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LimitReachedModal;
