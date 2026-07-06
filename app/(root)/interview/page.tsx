"use client";

import Link from "next/link";
import { Phone, ArrowRight } from "lucide-react";

import InterviewForm from "@/components/interview/InterviewForm";
import {
  GateLoading,
  GateAuthRequired,
  GateLimitReached,
} from "@/components/interview/GenerationGateStates";
import { useGenerationGate } from "@/hooks/useGenerationGate";

const Page = () => {
  const { user, isLoaded, loading, resumeData, limitReached } =
    useGenerationGate();

  if (!isLoaded || loading) return <GateLoading />;
  if (!user?.id) return <GateAuthRequired />;
  if (limitReached) return <GateLimitReached />;

  return (
    <div className="mx-auto w-full max-w-xl pb-24 pt-12 max-sm:pt-8">
      <header className="text-center">
        <h1 className="display text-3xl">Create an interview</h1>
        <p className="mt-2 text-soft">
          Set up your practice session in under a minute.
        </p>
      </header>

      {/* Alternative: voice-based generation */}
      <Link
        href="/interview/call"
        className="panel panel-hover group mt-8 flex items-center gap-4 p-4"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
          <Phone className="size-5 text-accent" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-strong">
            Prefer to talk it through?
          </p>
          <p className="text-sm text-faint">
            Describe your interview to our AI hiring manager on a call.
          </p>
        </div>
        <ArrowRight
          className="size-5 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-strong"
          aria-hidden="true"
        />
      </Link>

      <div className="mt-8">
        <InterviewForm userId={user.id} resumeData={resumeData} />
      </div>
    </div>
  );
};

export default Page;
