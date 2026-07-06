"use client";

import { useState } from "react";
import Link from "next/link";
import LimitReachedModal from "./LimitReachedModal";

interface TakeInterviewButtonProps {
  isPremium: boolean;
  hasVapiCredentials: boolean;
  feedbackCount: number;
  interviewId: string;
  hasFeedback: boolean;
}

const buttonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-hairline-strong px-4 text-sm font-medium text-strong transition-colors duration-200 hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const TakeInterviewButton = ({
  isPremium,
  hasVapiCredentials,
  feedbackCount,
  interviewId,
  hasFeedback,
}: TakeInterviewButtonProps) => {
  const [showLimitModal, setShowLimitModal] = useState(false);

  const canTakeUnlimited = isPremium || hasVapiCredentials;
  const limitReached = !canTakeUnlimited && feedbackCount >= 1 && !hasFeedback;

  const handleClick = (e: React.MouseEvent) => {
    if (limitReached) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };

  // If user already has feedback for this interview, link to it
  if (hasFeedback) {
    return (
      <Link href={`/interview/${interviewId}/feedback`} className={buttonClass}>
        View feedback
      </Link>
    );
  }

  return (
    <>
      <Link
        href={limitReached ? "#" : `/interview/${interviewId}`}
        onClick={handleClick}
        className={buttonClass}
      >
        Take interview
      </Link>

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        messageLine1="You have reached the free plan limit of 1 taken interview."
        messageLine2="Upgrade to Premium to take unlimited interviews and master your skills!"
      />
    </>
  );
};

export default TakeInterviewButton;
