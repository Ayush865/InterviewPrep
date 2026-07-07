"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

import { getUserEntitlements } from "@/lib/actions/premium.action";
import { getResumeByUserId, type ParsedResumeData } from "@/lib/actions/resume.action";
import type { Plan } from "@/lib/plans";

/**
 * Shared gating state for the interview generation pages (/interview and
 * /interview/call): auth, plan limits, and resume context.
 */
export function useGenerationGate() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [canGenerate, setCanGenerate] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [resumeData, setResumeData] = useState<ParsedResumeData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isLoaded || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        const [entitlements, resume] = await Promise.all([
          getUserEntitlements(user.id),
          getResumeByUserId(user.id),
        ]);

        setResumeData(resume);
        setPlan(entitlements.plan);

        if (entitlements.canGenerate) {
          setCanGenerate(true);
        } else {
          // Fallback: Vapi credentials saved locally but not yet linked in
          // the DB still count as bring-your-own-key
          const assistantId = localStorage.getItem("vapi_assistant_id");
          const webToken = localStorage.getItem("vapi_web_token");
          if (assistantId && webToken) {
            setPlan("byok");
            setCanGenerate(true);
          } else {
            setCanGenerate(false);
          }
        }
      } catch (error) {
        console.error("Error fetching generation gate data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLoaded, user]);

  return {
    user,
    isLoaded,
    loading,
    plan,
    resumeData,
    limitReached: !canGenerate,
  };
}
