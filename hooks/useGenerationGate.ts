"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

import { getUserEntitlements } from "@/lib/actions/premium.action";
import { getResumeByUserId, type ParsedResumeData } from "@/lib/actions/resume.action";
import { PLAN_FEATURES, type Plan, type PlanFeatures } from "@/lib/plans";

/**
 * Shared gating state for the interview generation pages (/interview and
 * /interview/call): auth, plan limits per method, and resume context.
 *
 * Free plan: form generation is unlimited, the hiring-manager call is
 * limited to 1. Pro: 10/period either way. BYOK: unlimited.
 */
export function useGenerationGate() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [canGenerateForm, setCanGenerateForm] = useState(false);
  const [canGenerateCall, setCanGenerateCall] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [features, setFeatures] = useState<PlanFeatures>(PLAN_FEATURES.free);
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
        setFeatures(entitlements.features);

        // Fallback: Vapi credentials saved locally but not yet linked in
        // the DB still count as bring-your-own-key
        const hasLocalByok =
          !!localStorage.getItem("vapi_assistant_id") &&
          !!localStorage.getItem("vapi_web_token");

        if (hasLocalByok && entitlements.plan === "free") {
          setPlan("byok");
          setFeatures(PLAN_FEATURES.byok);
          setCanGenerateForm(true);
          setCanGenerateCall(true);
        } else {
          setCanGenerateForm(entitlements.canGenerateForm);
          setCanGenerateCall(entitlements.canGenerateCall);
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
    features,
    resumeData,
    canGenerateForm,
    canGenerateCall,
  };
}
