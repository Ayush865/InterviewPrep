"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import LimitReachedModal from "./LimitReachedModal";

interface GenerateInterviewButtonProps {
  isPremium: boolean;
  interviewCount: number;
}

const GenerateInterviewButton = ({
  isPremium,
  interviewCount,
}: GenerateInterviewButtonProps) => {
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (!isPremium && interviewCount >= 1) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };

  return (
    <>
      <Button asChild className="btn-primary-generate max-sm:w-full" onClick={handleClick}>
        <Link href={(!isPremium && interviewCount >= 1) ? "#" : "/interview"}>
          Generate Interview
        </Link>
      </Button>

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        messageLine1="You have reached the free plan limit of 1 generated interview."
        messageLine2="Upgrade to Premium to generate unlimited interviews and master your skills!"
      />
    </>
  );
};

export default GenerateInterviewButton;

