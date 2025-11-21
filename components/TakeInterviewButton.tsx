"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import LimitReachedModal from "./LimitReachedModal";

interface TakeInterviewButtonProps {
  isPremium: boolean;
  feedbackCount: number;
  interviewId: string;
  hasFeedback: boolean;
}

const TakeInterviewButton = ({
  isPremium,
  feedbackCount,
  interviewId,
  hasFeedback,
}: TakeInterviewButtonProps) => {
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (!isPremium && feedbackCount >= 1 && !hasFeedback) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };

  // If user already has feedback for this interview, show "Check Feedback"
  if (hasFeedback) {
    return (
      <Button className="btn-primary">
        <Link href={`/interview/${interviewId}/feedback`}>
          Check Feedback
        </Link>
      </Button>
    );
  }

  // Otherwise show "Take Interview" with limit check
  return (
    <>
      <Button asChild className="btn-primary" onClick={handleClick}>
        <Link href={(!isPremium && feedbackCount >= 1) ? "#" : `/interview/${interviewId}`}>
          Take Interview
        </Link>
      </Button>

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

