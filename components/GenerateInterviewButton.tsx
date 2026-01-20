"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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

  const handleClick = (e: React.MouseEvent) => {
    if (!canGenerateUnlimited && interviewCount >= 1) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };
  
  console.log("GenerateInterviewButton - Props:", { isPremium, interviewCount, hasVapiCredentials, canGenerateUnlimited });

  return (
    <>
      <Button asChild className="btn-primary-generate max-sm:w-full" onClick={handleClick}>
        <Link href={(!canGenerateUnlimited && interviewCount >= 1) ? "#" : "/interview"}>
          Generate Interview
        </Link>
      </Button>

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

