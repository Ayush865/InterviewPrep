"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

import { getUserPremiumStatus } from "@/lib/actions/premium.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";
import { hasUserVapiCredentials } from "@/lib/actions/vapi.action";
import { getResumeByUserId, type ParsedResumeData } from "@/lib/actions/resume.action";

/**
 * Shared gating state for the interview generation pages (/interview and
 * /interview/call): auth, free-plan limit, and resume context.
 */
export function useGenerationGate() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [interviewCount, setInterviewCount] = useState(0);
  const [hasVapiCredentials, setHasVapiCredentials] = useState(false);
  const [resumeData, setResumeData] = useState<ParsedResumeData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isLoaded || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        const [premium, interviews, hasDbCredentials, resume] = await Promise.all([
          getUserPremiumStatus(user.id),
          getInterviewsByUserId(user.id),
          hasUserVapiCredentials(user.id),
          getResumeByUserId(user.id),
        ]);

        setIsPremium(premium);
        setInterviewCount(interviews?.length || 0);
        setResumeData(resume);

        if (hasDbCredentials) {
          setHasVapiCredentials(true);
        } else {
          // Fallback: credentials saved locally but not yet linked in the DB
          const assistantId = localStorage.getItem("vapi_assistant_id");
          const webToken = localStorage.getItem("vapi_web_token");
          setHasVapiCredentials(!!(assistantId && webToken));
        }
      } catch (error) {
        console.error("Error fetching generation gate data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLoaded, user]);

  const canGenerateUnlimited = isPremium || hasVapiCredentials;
  const limitReached = !canGenerateUnlimited && interviewCount >= 1;

  return {
    user,
    isLoaded,
    loading,
    isPremium,
    interviewCount,
    hasVapiCredentials,
    resumeData,
    limitReached,
  };
}
