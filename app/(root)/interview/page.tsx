"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getUserPremiumStatus } from "@/lib/actions/premium.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";
import { hasUserVapiCredentials } from "@/lib/actions/vapi.action";
import Agent from "@/components/Agent";
import InterviewForm from "@/components/interview/InterviewForm";
import GenerationMethodModal from "@/components/interview/GenerationMethodModal";

type GenerationMethod = "call" | "form" | null;

const Page = () => {
  const { user: clerkUser, isLoaded } = useUser();
  const [isPremium, setIsPremium] = useState(false);
  const [interviewCount, setInterviewCount] = useState(0);
  const [hasVapiCredentials, setHasVapiCredentials] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<GenerationMethod>(null);

  // Fetch user data on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!isLoaded || !clerkUser?.id) {
        setLoading(false);
        return;
      }

      try {
        const [premium, interviews, hasDbCredentials] = await Promise.all([
          getUserPremiumStatus(clerkUser.id),
          getInterviewsByUserId(clerkUser.id),
          hasUserVapiCredentials(clerkUser.id),
        ]);

        setIsPremium(premium);
        setInterviewCount(interviews?.length || 0);

        // Check database first, then fallback to localStorage for Vapi credentials
        if (hasDbCredentials) {
          console.log('✅ User has VAPI credentials in database');
          setHasVapiCredentials(true);
        } else {
          // Fallback: Check localStorage for Vapi credentials
          const assistantId = localStorage.getItem('vapi_assistant_id');
          const webToken = localStorage.getItem('vapi_web_token');
          const hasLocalCredentials = !!(assistantId && webToken);
          console.log(hasLocalCredentials ? '✅ User has VAPI credentials in localStorage' : 'ℹ️ No VAPI credentials found');
          setHasVapiCredentials(hasLocalCredentials);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLoaded, clerkUser]);

  // Show loading state
  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  // Ensure user is authenticated
  if (!clerkUser || !clerkUser.id) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h2 className="text-2xl font-bold text-white">Authentication Required</h2>
        <p className="text-gray-400 text-center max-w-md">
          Please sign in to generate interviews.
        </p>
        <Link href="/sign-in" className="px-4 py-2 bg-slate-purple rounded-lg text-white hover:bg-cream hover:text-black transition-colors">
          Sign In
        </Link>
      </div>
    );
  }

  // Check limits: Can generate if premium OR has Vapi credentials
  const canGenerateUnlimited = isPremium || hasVapiCredentials;
  const limitReached = !canGenerateUnlimited && interviewCount >= 1;

  if (limitReached) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <h2 className="text-2xl font-bold text-white">Free Plan Limit Reached</h2>
          <p className="text-gray-400 text-center max-w-md">
            You have already generated 1 interview on the free plan.
          </p>
          <p className="text-gray-300 text-sm text-center max-w-md">
            Choose one of the options below to continue:
          </p>
          <div className="flex gap-4">
            <Link href="/" className="px-4 py-2 bg-dark-300 rounded-lg text-white hover:bg-dark-400 transition-colors">
              Go Home
            </Link>
            <Link href="/settings/vapi" className="px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Use My Vapi Key
            </Link>
            <button className="px-4 py-2 bg-slate-purple rounded-lg text-white hover:bg-cream hover:text-black transition-colors">
              Upgrade to Premium
            </button>
          </div>
        </div>
      );
  }

  const handleMethodSelect = (method: "call" | "form") => {
    setSelectedMethod(method);
  };

  return (
    <>
      <div className="relative flex flex-col items-center gap-4 mb-4">
        <div className="flex items-center gap-4 text-lg justify-center">
          <h3>Interview generation</h3>
        </div>
      </div>

      {/* Show modal when no method selected */}
      <GenerationMethodModal
        isOpen={selectedMethod === null}
        onSelect={handleMethodSelect}
      />

      {/* Render Agent for call method */}
      {selectedMethod === "call" && (
        <Agent
          userName={clerkUser.firstName || clerkUser.username || "User"}
          userId={clerkUser.id}
          userImage={clerkUser.imageUrl}
          type="generate"
        />
      )}

      {/* Render Form for form method */}
      {selectedMethod === "form" && (
        <InterviewForm userId={clerkUser.id} />
      )}
    </>
  );
};

export default Page;
