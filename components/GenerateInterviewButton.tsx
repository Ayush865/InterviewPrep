"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import LimitReachedModal from "./LimitReachedModal";

interface GenerateInterviewButtonProps {
  isPremium: boolean;
  interviewCount: number;
  hasVapiCredentials: boolean;
}

const GenerateInterviewButton = ({
  isPremium,
  interviewCount,
  hasVapiCredentials,
}: GenerateInterviewButtonProps) => {
  const [showLimitModal, setShowLimitModal] = useState(false);

  const canGenerateUnlimited = isPremium || hasVapiCredentials;
  const limitReached = !canGenerateUnlimited && interviewCount >= 1;

  const handleClick = (e: React.MouseEvent) => {
    if (limitReached) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };

  return (
    <>
      <Link
        href={limitReached ? "#" : "/interview"}
        onClick={handleClick}
        className="btn-accent max-sm:w-full"
      >
        <Plus className="size-4" aria-hidden="true" />
        Generate interview
      </Link>

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        messageLine1="You have reached the free plan limit of 1 interview generation."
        messageLine2="Upgrade to Premium or use your own Vapi API key to generate unlimited interviews!"
      />
    </>
  );
};

export default GenerateInterviewButton;
