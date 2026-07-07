"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import LimitReachedModal from "./LimitReachedModal";
import type { Plan } from "@/lib/plans";

interface GenerateInterviewButtonProps {
  canGenerate: boolean;
  plan: Plan;
}

const GenerateInterviewButton = ({
  canGenerate,
  plan,
}: GenerateInterviewButtonProps) => {
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (!canGenerate) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };

  return (
    <>
      <Link
        href={canGenerate ? "/interview" : "#"}
        onClick={handleClick}
        className="btn-accent max-sm:w-full"
      >
        <Plus className="size-4" aria-hidden="true" />
        Generate interview
      </Link>

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        messageLine1={
          plan === "pro"
            ? "You've used all 10 interview generations for this billing period."
            : "You have reached the free plan limit of 1 interview generation."
        }
        messageLine2={
          plan === "pro"
            ? "Your quota resets when your subscription renews, or connect your own Vapi key for unlimited access."
            : "Upgrade to Pro for 10 interviews a month, or use your own Vapi API key for unlimited access."
        }
      />
    </>
  );
};

export default GenerateInterviewButton;
