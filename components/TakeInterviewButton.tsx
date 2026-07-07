"use client";

import { useState } from "react";
import Link from "next/link";
import LimitReachedModal from "./LimitReachedModal";
import type { Plan } from "@/lib/plans";

interface TakeInterviewButtonProps {
  canPractice: boolean;
  plan: Plan;
  interviewId: string;
  hasFeedback: boolean;
}

const buttonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-hairline-strong px-4 text-sm font-medium text-strong transition-colors duration-200 hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const TakeInterviewButton = ({
  canPractice,
  plan,
  interviewId,
  hasFeedback,
}: TakeInterviewButtonProps) => {
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Already completed — always allow viewing the feedback
  if (hasFeedback) {
    return (
      <Link href={`/interview/${interviewId}/feedback`} className={buttonClass}>
        View feedback
      </Link>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if (!canPractice) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };

  return (
    <>
      <Link
        href={canPractice ? `/interview/${interviewId}` : "#"}
        onClick={handleClick}
        className={buttonClass}
      >
        Take interview
      </Link>

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        messageLine1={
          plan === "pro"
            ? "You've used all 10 practice sessions for this billing period."
            : "You have reached the free plan limit of 1 practice session."
        }
        messageLine2={
          plan === "pro"
            ? "Your quota resets when your subscription renews, or connect your own Vapi key for unlimited sessions."
            : "Upgrade to Pro for 10 sessions a month, or use your own Vapi API key for unlimited access."
        }
      />
    </>
  );
};

export default TakeInterviewButton;
