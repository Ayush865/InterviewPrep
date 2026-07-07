"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, Loader2 } from "lucide-react";

interface DrillButtonProps {
  userId: string;
  role: string;
  level: string;
  techstack: string[];
  focusArea: string;
}

/** Map a feedback category to the closest interview type for the drill */
function drillType(focusArea: string): string {
  const technical = ["Technical Knowledge", "Problem Solving"];
  return technical.includes(focusArea) ? "technical" : "behavioural";
}

/**
 * One-click targeted drill: generates a short interview focused on the
 * user's weakest category and takes them straight to it.
 */
const DrillButton = ({
  userId,
  role,
  level,
  techstack,
  focusArea,
}: DrillButtonProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: drillType(focusArea),
          role,
          level,
          techstack: techstack.join(", "),
          amount: 5,
          userid: userId,
          focus_area: focusArea,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to generate drill");
      }

      toast.success("Drill ready — good luck!");
      router.push(`/interview/${result.interviewId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate drill"
      );
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="btn-accent !h-10 text-sm"
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Building your drill…
        </>
      ) : (
        <>
          <Crosshair className="size-4" aria-hidden="true" />
          Drill my weakest area
        </>
      )}
    </button>
  );
};

export default DrillButton;
