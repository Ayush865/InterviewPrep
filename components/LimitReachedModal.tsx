"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, Lock, Settings, Check } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import UpgradeButton from "./UpgradeButton";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  messageLine1: string;
  messageLine2: string;
}

const premiumPerks = [
  "10 interview generations every month",
  "10 practice sessions (30 min) every month",
  "Only $5/month — cancel anytime",
];

const LimitReachedModal = ({
  isOpen,
  onClose,
  title = "You've hit the free limit",
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

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="limit-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface-overlay shadow-2xl"
          >
            {/* Soft accent glow */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-32"
              style={{
                background:
                  "radial-gradient(320px 120px at 50% 0%, rgba(237,91,35,0.12), transparent 70%)",
              }}
              aria-hidden="true"
            />

            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 cursor-pointer rounded-full p-1.5 text-faint transition-colors duration-200 hover:bg-hover hover:text-strong"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden="true" />
            </button>

            <div className="relative flex flex-col gap-5 p-7">
              <div className="flex size-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
                <Lock className="size-5 text-accent" aria-hidden="true" />
              </div>

              <div>
                <h2
                  id="limit-modal-title"
                  className="text-xl font-semibold tracking-tight text-strong"
                >
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-soft">
                  {messageLine1}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-soft">
                  {messageLine2}
                </p>
              </div>

              {/* Premium perks */}
              <ul className="flex list-none flex-col gap-2 rounded-xl border border-hairline bg-raise p-4">
                {premiumPerks.map((perk) => (
                  <li
                    key={perk}
                    className="flex items-center gap-2.5 text-sm text-body"
                  >
                    <Check
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    {perk}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2.5">
                <UpgradeButton className="!h-11 w-full text-sm" />
                <Link
                  href="/settings/vapi"
                  className="btn-quiet !h-11 w-full text-sm"
                >
                  <Settings className="size-4" aria-hidden="true" />
                  Use my own Vapi key
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default LimitReachedModal;
