"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

interface ResumeReviewButtonProps {
  disabled?: boolean;
}

/** Runs an AI resume review and refreshes the page with the result */
const ResumeReviewButton = ({ disabled }: ResumeReviewButtonProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/resume/review", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to review resume");
      }

      toast.success("Review ready!");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to review resume"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className="btn-accent !h-10 text-sm"
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Reviewing your resume…
        </>
      ) : (
        <>
          <Sparkles className="size-4" aria-hidden="true" />
          Run AI review
        </>
      )}
    </button>
  );
};

export default ResumeReviewButton;
